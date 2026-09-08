"""Emit the disposable PostgreSQL 16 Nexus C-03 lifecycle suite.

The C-02 builder establishes the real C-01/C-06/C-02 security baseline and its
behavioral regressions. This suite then installs the effective pre-C03 automatic
processor, proves that it can create a finalized result without human review,
applies C-03 and exercises the new lifecycle matrix.
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

# The C-02 write harness did not need processor bookkeeping columns/functions.
# Add only the historical processor dependencies before reproducing C-03.
print("""
ALTER TABLE public.nexus_self_assessment_invites
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_processing_error text;
""")

processor_source = (
    migrations / "20260906_nexus_clinic_lifecycle_boundary.sql"
).read_text()
processor_fn = re.search(
    r"CREATE OR REPLACE FUNCTION public\.complete_nexus_self_assessment_processing\([\s\S]*?\$\$;",
    processor_source,
    re.I,
)
if not processor_fn:
    raise SystemExit("Missing effective pre-C03 self-assessment processor")
print(processor_fn.group())
print(
    "REVOKE ALL ON FUNCTION public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb) "
    "FROM PUBLIC, anon, authenticated;"
)
print(
    "GRANT EXECUTE ON FUNCTION public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb) "
    "TO service_role;"
)

print((root / "tests/sql/nexus_c03_before.sql").read_text())

c03 = migrations / "20260908_nexus_c03_clinical_lifecycle.sql"
print(c03.read_text())
print(c03.read_text())  # additive/idempotent replay before new lifecycle rows
print((root / "tests/sql/nexus_c03_cases.sql").read_text())
