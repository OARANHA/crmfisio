"""Emit the disposable PostgreSQL 16 Patient Delivery V1 suite.

The clinician-assisted builder supplies the effective #399/#400 neutral
instrument stack and behavior matrix. This builder then adds only the legacy
self-assessment transport pieces needed to prove the new authority split.
"""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
migrations = root / "supabase-migrations"

baseline = subprocess.run(
    [sys.executable, str(root / "scripts/build-clinician-assisted-instrument-v1-sql-test.py")],
    check=True,
    capture_output=True,
    text=True,
)
baseline_sql = baseline.stdout
baseline_sql = baseline_sql.replace(
    "CREATE ROLE authenticated NOLOGIN;\nCREATE ROLE anon NOLOGIN;\nCREATE ROLE service_role NOLOGIN BYPASSRLS;",
    """DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF; END $$;""",
)
print(baseline_sql)
print(r"""
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS opt_in_whats boolean NOT NULL DEFAULT false;

UPDATE public.patients
SET nome='Paciente Teste', telefone='5551999999999', opt_in_whats=true
WHERE id='00000000-0000-0000-0000-000000000301'::uuid;

ALTER TABLE public.nexus_self_assessment_invites
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_processing_error text;

CREATE TABLE public.wa_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  appointment_id uuid REFERENCES public.appointments(id),
  self_assessment_invite_id uuid REFERENCES public.nexus_self_assessment_invites(id),
  template text NOT NULL CHECK (template IN ('confirmacao','nps','reativacao','vaga_espera','nexus_autoavaliacao','clinical_instrument_patient_self')),
  mensagem text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'fila',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The reduced Nexus baseline does not load the full multiprofessional catalog.
-- Seed only the canonical read capability required by the patient-history probe;
-- keep the FK active so the fixture still reflects production integrity.
INSERT INTO public.capability_catalog (capability_key, domain, description, clinical)
VALUES (
  'clinical.timeline.read',
  'clinical',
  'Consultar linha do tempo clínica conforme vínculo assistencial',
  true
)
ON CONFLICT (capability_key) DO NOTHING;
""")
transport = (migrations / "20260906_nexus_clinic_lifecycle_boundary.sql").read_text()
for name, signature, grants in [
    (
        "resolve_nexus_self_assessment",
        "public.resolve_nexus_self_assessment(text)",
        "REVOKE ALL ON FUNCTION public.resolve_nexus_self_assessment(text) FROM PUBLIC;\nGRANT EXECUTE ON FUNCTION public.resolve_nexus_self_assessment(text) TO anon, authenticated;",
    ),
    (
        "submit_nexus_self_assessment",
        "public.submit_nexus_self_assessment(text,jsonb)",
        "REVOKE ALL ON FUNCTION public.submit_nexus_self_assessment(text,jsonb) FROM PUBLIC;\nGRANT EXECUTE ON FUNCTION public.submit_nexus_self_assessment(text,jsonb) TO anon, authenticated;",
    ),
]:
    match = re.search(
        rf"CREATE OR REPLACE FUNCTION public\.{name}\([\s\S]*?\$\$;",
        transport,
        re.I,
    )
    if not match:
        raise SystemExit(f"Missing effective self-assessment transport function: {signature}")
    print(match.group())
    print(grants)

processor_transport = (migrations / "20260904_nexus_self_assessment_processor.sql").read_text()
match = re.search(
    r"CREATE OR REPLACE FUNCTION public\.complete_nexus_self_assessment_processing\([\s\S]*?\$\$;",
    processor_transport,
    re.I,
)
if not match:
    raise SystemExit("Missing effective legacy Nexus completion writer")
print(match.group())
print(
    "REVOKE ALL ON FUNCTION public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb) "
    "FROM PUBLIC, anon, authenticated;\n"
    "GRANT EXECUTE ON FUNCTION public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb) "
    "TO service_role;"
)

migration = migrations / "20260916_clinical_instrument_patient_delivery_v1.sql"
print(migration.read_text())
print(migration.read_text())
print((root / "tests/sql/clinical_instrument_patient_delivery_v1_cases.sql").read_text())
