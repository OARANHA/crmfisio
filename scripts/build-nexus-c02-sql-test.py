"""Emit a disposable PostgreSQL 16 suite for Nexus C-02.

The suite builds the effective C-06 baseline from versioned migrations, reproduces
the caller-controlled required_capability exploit, removes only synthetic Nexus
rows, applies C-02 and runs the post-fix write matrix. No authorization helper is
mocked as a boolean shortcut.
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
migrations = root / "supabase-migrations"
c01 = migrations / "20260908_nexus_c01_read_boundary.sql"
c06 = migrations / "20260908_nexus_c06_professional_authorization.sql"
c02 = migrations / "20260908_nexus_c02_trusted_result_contract.sql"
c02_verifier = migrations / "20260908_verify_nexus_c02_trusted_result_contract.sql"

sources = sorted(migrations.glob("20*.sql"))
contents = [
    (path, path.read_text())
    for path in sources
    if path not in {c01, c06, c02, c02_verifier}
]

nexus_tables = (
    "capability_catalog",
    "professional_capabilities",
    "nexus_evidence_sources",
    "nexus_clinical_results",
    "nexus_red_flags",
    "nexus_self_assessment_invites",
)

pre_c06_helpers = (
    "current_clinic_id",
    "current_app_role",
    "current_nexus_medical_identity_valid",
    "current_nexus_entitlement_allowed",
    "has_professional_capability",
    "can_access_patient_clinical_record",
    "list_patient_clinical_snapshot",
)

shared_read_policies = (
    "evaluations_select_care_relationship",
    "evolutions_select_care_relationship",
    "clinical_assessments_read_care_relationship",
    "assessment_body_points_read_care_relationship",
)

print((root / "tests/sql/nexus_c06_fixture.sql").read_text())

for table in nexus_tables:
    pattern = rf"CREATE TABLE IF NOT EXISTS public\.{table}\s*\([\s\S]*?\n\);"
    matches = [m.group() for _, text in contents for m in re.finditer(pattern, text, re.I)]
    if len(matches) != 1:
        raise SystemExit(f"Expected one canonical Nexus table definition: {table}, found {len(matches)}")
    print(matches[0])
    print(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;")

for helper in pre_c06_helpers:
    pattern = rf"CREATE OR REPLACE FUNCTION public\.{helper}\([\s\S]*?\$\$;"
    matches = [
        (path, match.group())
        for path, text in contents
        for match in re.finditer(pattern, text, re.I)
    ]
    if not matches:
        raise SystemExit(f"Missing effective helper: {helper}")
    path, sql = matches[-1]
    print(f"-- Effective pre-C06 helper: {path.name}")
    print(sql)
    signature = (
        "uuid" if helper == "can_access_patient_clinical_record"
        else "text" if helper == "has_professional_capability"
        else ""
    )
    print(f"REVOKE ALL ON FUNCTION public.{helper}({signature}) FROM PUBLIC, anon;")
    print(f"GRANT EXECUTE ON FUNCTION public.{helper}({signature}) TO authenticated;")

# Replay historical Nexus policies, excluding the C-01/C-06/C-02 migrations that
# are applied explicitly below.
for path, text in contents:
    for match in re.finditer(r"(?:CREATE|DROP) POLICY\s+[\s\S]*?;", text, re.I):
        sql = match.group()
        if any(re.search(rf"ON\s+public\.{table}\b", sql, re.I) for table in nexus_tables):
            print(f"-- {path.name}")
            print(sql)

care_source = (migrations / "20260907_clinical_care_relationship_read_boundary.sql").read_text()
for policy_name in shared_read_policies:
    match = re.search(rf"CREATE POLICY\s+{policy_name}\b[\s\S]*?;", care_source, re.I)
    if not match:
        raise SystemExit(f"Missing shared clinical read policy: {policy_name}")
    print(match.group())

print("GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;")
print("GRANT INSERT, UPDATE ON public.nexus_clinical_results TO authenticated;")
print("GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;")
print(
    "GRANT SELECT ON public.nexus_clinical_results, public.nexus_red_flags, "
    "public.nexus_self_assessment_invites, public.physiotherapy_evaluations, "
    "public.physiotherapy_evolutions, public.clinical_assessments, "
    "public.assessment_body_points TO anon;"
)

# Seed before context triggers, matching the established C-06 disposable harness.
print((root / "tests/sql/nexus_c06_seed.sql").read_text())

# Establish exactly the effective production security baseline before C-02.
print(c01.read_text())
print(c06.read_text())

# Add the effective write-context and finalized immutability triggers that the
# C-06 read harness does not need, but C-02 must exercise.
context_source = (migrations / "20260906_nexus_appointment_authorship_boundary.sql").read_text()
context_fn = re.search(
    r"CREATE OR REPLACE FUNCTION public\.validate_nexus_result_context\(\)[\s\S]*?\$\$;",
    context_source,
    re.I,
)
if not context_fn:
    raise SystemExit("Missing pre-C02 validate_nexus_result_context")
print(context_fn.group())
print("REVOKE ALL ON FUNCTION public.validate_nexus_result_context() FROM PUBLIC, anon;")
print("DROP TRIGGER IF EXISTS trg_nexus_result_context ON public.nexus_clinical_results;")
print("CREATE TRIGGER trg_nexus_result_context BEFORE INSERT OR UPDATE OF clinic_id, patient_id, professional_id, appointment_id, required_capability ON public.nexus_clinical_results FOR EACH ROW EXECUTE FUNCTION public.validate_nexus_result_context();")

foundation = (migrations / "20260903_nexus_wave0_foundation.sql").read_text()
immutable_fn = re.search(
    r"CREATE OR REPLACE FUNCTION public\.guard_nexus_result_immutability\(\)[\s\S]*?\$\$;",
    foundation,
    re.I,
)
if not immutable_fn:
    raise SystemExit("Missing guard_nexus_result_immutability")
print(immutable_fn.group())
print("DROP TRIGGER IF EXISTS trg_nexus_result_immutable ON public.nexus_clinical_results;")
print("CREATE TRIGGER trg_nexus_result_immutable BEFORE UPDATE ON public.nexus_clinical_results FOR EACH ROW EXECUTE FUNCTION public.guard_nexus_result_immutability();")

# Load the existing specific EEM writer unchanged.
eem_source = (migrations / "20260906_nexus_eem_atomic_finalization.sql").read_text()
eem_fn = re.search(
    r"CREATE OR REPLACE FUNCTION public\.finalize_nexus_eem_result\([\s\S]*?\$\$;",
    eem_source,
    re.I,
)
if not eem_fn:
    raise SystemExit("Missing finalize_nexus_eem_result")
print(eem_fn.group())
print("REVOKE ALL ON FUNCTION public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) FROM PUBLIC, anon;")
print("GRANT EXECUTE ON FUNCTION public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) TO authenticated;")

# Prove the exploit on the effective pre-C02 baseline, then clean synthetic Nexus
# rows before the fail-closed historical-data preflight.
print((root / "tests/sql/nexus_c02_before.sql").read_text())

# The migration is intentionally safe to replay before behavior creates rows.
print(c02.read_text())
print(c02.read_text())
print((root / "tests/sql/nexus_c02_cases.sql").read_text())
