"""Emit the disposable PostgreSQL 16 regression suite for Nexus C-06.

Dependency tables are reduced fixtures. Canonical Nexus table DDL, effective
authorization helper bodies, historical Nexus policies and the shared clinical
read policies are extracted from versioned migrations. C-01 is applied once as
the prerequisite; C-06 is then applied without replaying C-01. Later C-02 write
contract changes are excluded so this gate keeps owning the C-06 baseline.
"""
from pathlib import Path
import re
import sys

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
    # This builder deliberately reconstructs the pre-C06 state. Later
    # reconciliations must not be mistaken for C06 prerequisites merely because
    # they redefine one of the same runtime helpers.
    if path.name <= c06.name and path not in {c01, c06, c02, c02_verifier}
]

nexus_tables = (
    "capability_catalog",
    "professional_capabilities",
    "nexus_evidence_sources",
    "nexus_clinical_results",
    "nexus_red_flags",
    "nexus_self_assessment_invites",
)

helpers = (
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
        raise SystemExit(
            f"Expected one canonical Nexus table definition: {table}, found {len(matches)}"
        )
    print(matches[0])
    print(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;")

for helper in helpers:
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
        "uuid"
        if helper == "can_access_patient_clinical_record"
        else "text"
        if helper == "has_professional_capability"
        else ""
    )
    print(f"REVOKE ALL ON FUNCTION public.{helper}({signature}) FROM PUBLIC, anon;")
    print(f"GRANT EXECUTE ON FUNCTION public.{helper}({signature}) TO authenticated;")

# Replay historical Nexus policies in migration order, but not C-01/C-06/C-02.
for path, text in contents:
    for match in re.finditer(r"(?:CREATE|DROP) POLICY\s+[\s\S]*?;", text, re.I):
        sql = match.group()
        if any(
            re.search(rf"ON\s+public\.{table}\b", sql, re.I)
            for table in nexus_tables
        ):
            print(f"-- {path.name}")
            print(sql)

# Load only the effective shared clinical read policies that delegate to the
# canonical care helper. Write-policy replay is intentionally outside C-06.
care_source = (
    migrations / "20260907_clinical_care_relationship_read_boundary.sql"
).read_text()
for policy_name in shared_read_policies:
    match = re.search(
        rf"CREATE POLICY\s+{policy_name}\b[\s\S]*?;",
        care_source,
        re.I,
    )
    if not match:
        raise SystemExit(f"Missing shared clinical read policy: {policy_name}")
    print(match.group())

print("GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;")
print("GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;")
print(
    "GRANT SELECT ON public.nexus_clinical_results, public.nexus_red_flags, "
    "public.nexus_self_assessment_invites, public.physiotherapy_evaluations, "
    "public.physiotherapy_evolutions, public.clinical_assessments, "
    "public.assessment_body_points TO anon;"
)

print((root / "tests/sql/nexus_c06_seed.sql").read_text())

c01_sql = c01.read_text()

if "--before" in sys.argv:
    # The disposable pre-fix run is wrapped by psql --single-transaction so its
    # expected failure can roll back fixture roles/schema completely. Strip only
    # C-01's transaction wrapper in this generated copy; its SQL body, guards and
    # helper fingerprint checks remain byte-for-byte sourced from the migration.
    c01_before = re.sub(r"(?m)^BEGIN;\s*$", "", c01_sql, count=1)
    c01_before = re.sub(r"(?m)^COMMIT;\s*$", "", c01_before, count=1)
    print(c01_before)
    print((root / "tests/sql/nexus_c06_before.sql").read_text())
else:
    # Normal after-fix test applies the real C-01 migration exactly once, then
    # C-06. C-01 is never replayed to update the later helper fingerprints.
    print(c01_sql)
    print(c06.read_text())
    print(c06.read_text())  # C-06 must be safely re-runnable.
    print((root / "tests/sql/nexus_c06_cases.sql").read_text())
