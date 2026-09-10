"""Emit the disposable PostgreSQL 16 #400 Encounter Temporal Start suite.

The established #399 builder supplies the effective Nexus/clinical authorization
baseline and neutral instrument foundation. #400 then adds only the appointment
columns required by the current appointment guards, installs the effective
appointment mutation/status functions from the canonical authorization migration,
adds temporal fixtures, replays #400 twice, and runs the new behavior matrix.
"""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
migrations = root / "supabase-migrations"

baseline = subprocess.run(
    [sys.executable, str(root / "scripts/build-clinical-instrument-encounter-sql-test.py")],
    check=True,
    capture_output=True,
    text=True,
)
print(baseline.stdout)

# Supabase provides auth.role() in production. The older C-06 disposable fixture
# needs the minimal equivalent so the current appointment maintenance bypass can
# be exercised without weakening the product function in the harness.
print(r"""
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')
$$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS data date,
  ADD COLUMN IF NOT EXISTS room_id uuid,
  ADD COLUMN IF NOT EXISTS inicio time,
  ADD COLUMN IF NOT EXISTS fim time,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS valor numeric,
  ADD COLUMN IF NOT EXISTS pacote_id uuid,
  ADD COLUMN IF NOT EXISTS serie_id uuid,
  ADD COLUMN IF NOT EXISTS is_fit_in boolean,
  ADD COLUMN IF NOT EXISTS rescheduled_from_id uuid;

-- Existing #399 fixtures predate the temporal column in their reduced schema.
-- Keep them on today's established operational date so #400 does not turn old
-- unrelated #399 assertions into synthetic future-state failures.
UPDATE public.appointments
SET data = timezone('America/Sao_Paulo', now())::date
WHERE data IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
""")

# Reinstall only the effective appointment authorization guards needed to prove
# the forensic path: authorized actor + own appointment + clinical.attend can
# reach the temporal invariant. Product functions are extracted, not mocked.
auth_source = (migrations / "20260909_clinical_authorization_reconciliation.sql").read_text()
for name in (
    "guard_appointment_mutation_boundary",
    "guard_appointment_clinical_self_transition",
    "guard_appointment_status_transition",
):
    match = re.search(
        rf"CREATE OR REPLACE FUNCTION public\.{name}\(\)[\s\S]*?\$\$;",
        auth_source,
        re.I,
    )
    if not match:
        raise SystemExit(f"Missing effective appointment guard: {name}")
    print(match.group())
    print(f"REVOKE ALL ON FUNCTION public.{name}() FROM PUBLIC, anon, authenticated;")

print(r"""
DROP TRIGGER IF EXISTS trg_guard_appointment_mutation_boundary ON public.appointments;
CREATE TRIGGER trg_guard_appointment_mutation_boundary
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_mutation_boundary();

DROP TRIGGER IF EXISTS trg_appointment_clinical_self_transition ON public.appointments;
CREATE TRIGGER trg_appointment_clinical_self_transition
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_clinical_self_transition();

DROP TRIGGER IF EXISTS trg_appointment_status_transition ON public.appointments;
CREATE TRIGGER trg_appointment_status_transition
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_status_transition();

-- Test-only clinical.attend setup. These grants are disposable fixtures and are
-- never part of the #400 migration.
INSERT INTO public.capability_catalog(capability_key, domain, description, clinical, active)
VALUES ('clinical.attend','clinical','Synthetic #400 clinical attend',true,true)
ON CONFLICT (capability_key) DO UPDATE
SET domain=EXCLUDED.domain, clinical=true, active=true;

INSERT INTO public.professional_capabilities(clinic_id, professional_id, capability_key, granted)
VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000103','clinical.attend',true),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000104','clinical.attend',true),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000105','clinical.attend',true),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','clinical.attend',true)
ON CONFLICT (clinic_id, professional_id, capability_key) DO UPDATE SET granted=true;

-- PHQ-9 is explicitly enabled only for the disposable clinic so the #399
-- defense-in-depth assertions can reach the Encounter temporal predicate.
INSERT INTO public.clinic_clinical_instrument_settings(
  clinic_id, instrument_key, enabled, configured_by
) VALUES (
  '00000000-0000-0000-0000-000000000001','phq9',true,
  '00000000-0000-0000-0000-000000000104'
)
ON CONFLICT (clinic_id, instrument_key) DO UPDATE SET enabled=true;

-- Pre-#400 scheduled fixtures. Their dates are dynamic relative to the same
-- established America/Sao_Paulo convention that the product migration adopts.
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, fisio_id, professional_id, status, data
) VALUES
 ('00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000103','agendado',timezone('America/Sao_Paulo', now())::date + 1),
 ('00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000103','agendado',timezone('America/Sao_Paulo', now())::date),
 ('00000000-0000-0000-0000-000000000803','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000104','agendado',timezone('America/Sao_Paulo', now())::date + 1),
 ('00000000-0000-0000-0000-000000000804','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000105','agendado',timezone('America/Sao_Paulo', now())::date + 1),
 ('00000000-0000-0000-0000-000000000805','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000201','em_atendimento',timezone('America/Sao_Paulo', now())::date),
 ('00000000-0000-0000-0000-000000000806','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101','em_atendimento',timezone('America/Sao_Paulo', now())::date);
""")

migration = migrations / "20260910_encounter_temporal_start_boundary.sql"
print(migration.read_text())
print(migration.read_text())
print((root / "tests/sql/encounter_temporal_start_boundary_cases.sql").read_text())
