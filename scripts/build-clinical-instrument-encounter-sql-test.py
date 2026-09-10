"""Emit the disposable PostgreSQL 16 #399 behavior suite.

The established C-02 builder supplies the real C-01/C-06/C-02 Nexus security
baseline and behavior harness. #399 then installs the effective generic clinical
identity/capability helpers without changing any Nexus helper, adds only the
appointment status field required by the contextual act probe, introduces one
synthetic Nexus-only scale before #399, snapshots Nexus guards/contracts, applies
the #399 migration twice, and runs the new cases.
"""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
migrations = root / "supabase-migrations"

baseline = subprocess.run(
    [sys.executable, str(root / "scripts/build-nexus-c02-sql-test.py")],
    check=True,
    capture_output=True,
    text=True,
)
print(baseline.stdout)

# The C-06 fixture intentionally models only fields needed by Nexus. Extend that
# disposable table with canonical fields used by #399; do not redefine product DDL.
print("""
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS especialidade text;
""")

def effective_function(name: str) -> str:
    pattern = rf"CREATE OR REPLACE FUNCTION public\.{name}\([\s\S]*?\$\$;"
    matches: list[tuple[Path, str]] = []
    for path in sorted(migrations.glob("20*.sql")):
        if path.name == "20260910_clinical_instrument_encounter_authorization.sql":
            continue
        text = path.read_text()
        for match in re.finditer(pattern, text, re.I):
            matches.append((path, match.group()))
    if not matches:
        raise SystemExit(f"Missing effective clinical helper: {name}")
    path, sql = matches[-1]
    print(f"-- Effective #399 prerequisite helper: {path.name}")
    return sql

print(effective_function("current_user_has_valid_clinical_identity"))
print(
    "REVOKE ALL ON FUNCTION public.current_user_has_valid_clinical_identity() "
    "FROM PUBLIC, anon;\n"
    "GRANT EXECUTE ON FUNCTION public.current_user_has_valid_clinical_identity() "
    "TO authenticated;"
)
print(effective_function("current_user_has_clinical_capability"))
print(
    "REVOKE ALL ON FUNCTION public.current_user_has_clinical_capability(text) "
    "FROM PUBLIC, anon;\n"
    "GRANT EXECUTE ON FUNCTION public.current_user_has_clinical_capability(text) "
    "TO authenticated;"
)

# Enrich only disposable appointment/profile fixtures for contextual behavior.
print("""
UPDATE public.appointments
SET status = CASE id
  WHEN '00000000-0000-0000-0000-000000000501'::uuid THEN 'em_atendimento'
  WHEN '00000000-0000-0000-0000-000000000502'::uuid THEN 'em_atendimento'
  WHEN '00000000-0000-0000-0000-000000000503'::uuid THEN 'em_atendimento'
  WHEN '00000000-0000-0000-0000-000000000504'::uuid THEN 'em_atendimento'
  WHEN '00000000-0000-0000-0000-000000000505'::uuid THEN 'em_atendimento'
  ELSE status
END;

UPDATE public.profiles
SET especialidade = 'Psiquiatria'
WHERE id = '00000000-0000-0000-0000-000000000102';

INSERT INTO public.appointments(
  id, clinic_id, paciente_id, fisio_id, professional_id, status
) VALUES
  ('00000000-0000-0000-0000-000000000506','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000104','em_atendimento'),
  ('00000000-0000-0000-0000-000000000507','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000105','em_atendimento'),
  ('00000000-0000-0000-0000-000000000508','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101','agendado'),
  ('00000000-0000-0000-0000-000000000509','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101','confirmado'),
  ('00000000-0000-0000-0000-000000000510','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000102','em_atendimento'),
  ('00000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101','em_atendimento'),
  ('00000000-0000-0000-0000-000000000512','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101','finalizado');

-- Negative control for blocker review: this is a valid Nexus scale contract, but
-- it is intentionally absent from the neutral clinical_instrument_catalog that
-- #399 is about to install. Nexus engine membership must not imply exposure.
INSERT INTO public.nexus_result_contracts(
  module_key, tool_key, rule_key, rule_version, required_capability
) VALUES (
  'scales', 'nexus_only_scale', 'nexus.nexus_only_scale',
  'nexus-only-2026-09-10', 'nexus.scales'
);
""")

# Snapshot the protected Nexus surface after the synthetic Nexus-only contract is
# part of the disposable baseline. #399 must not mutate any Nexus policy/helper or
# contract row, including that extra scale.
print("""
CREATE TEMP TABLE ci399_nexus_policy_snapshot AS
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'nexus_clinical_results',
    'nexus_red_flags',
    'nexus_self_assessment_invites'
  );

CREATE TEMP TABLE ci399_nexus_helper_snapshot AS
SELECT p.oid::regprocedure::text AS signature, md5(p.prosrc) AS body_md5
FROM pg_proc p
WHERE p.oid IN (
  'public.has_professional_capability(text)'::regprocedure,
  'public.can_access_patient_clinical_record(uuid)'::regprocedure
);

CREATE TEMP TABLE ci399_nexus_contract_snapshot AS
SELECT module_key, tool_key, rule_key, rule_version, required_capability
FROM public.nexus_result_contracts;
""")

migration = migrations / "20260910_clinical_instrument_encounter_authorization.sql"
print(migration.read_text())
print(migration.read_text())
print((root / "tests/sql/clinical_instrument_encounter_authorization_cases.sql").read_text())
print((root / "tests/sql/clinical_instrument_exposure_negative_cases.sql").read_text())
