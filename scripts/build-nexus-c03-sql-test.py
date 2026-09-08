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

# Terminal-state precedence is a small additive hardening layered after the base
# C-03 migration. Replay it too so the disposable suite catches idempotency drift.
signed_guard = migrations / "20260908_nexus_c03_signed_immutability_guard.sql"
print(signed_guard.read_text())
print(signed_guard.read_text())

cases = (root / "tests/sql/nexus_c03_cases.sql").read_text()
probe_start = "-- 7) Even a privileged direct write cannot forge a reviewer different from the"
probe_end = "-- 11) EEM remains atomic and its existing explicit human finalization action now"
if probe_start not in cases or probe_end not in cases:
    raise SystemExit("Missing C-03 privileged lifecycle probe markers")

# Production intentionally gives service_role no direct lifecycle UPDATE. The two
# destructive guard probes temporarily add that ACL only in this disposable DB so
# the trigger is exercised as a second line of defense, then restore least privilege
# before the verifier runs.
cases = cases.replace(
    probe_start,
    "GRANT UPDATE ON public.nexus_result_clinical_lifecycle TO service_role;\n\n" + probe_start,
    1,
)
cases = cases.replace(
    probe_end,
    "REVOKE UPDATE ON public.nexus_result_clinical_lifecycle FROM service_role;\n\n" + probe_end,
    1,
)
print(cases)

# A second, neutral mutation touches only updated_at. It proves signed immutability
# without relying on a timestamp-order violation to reach the terminal guard.
print((root / "tests/sql/nexus_c03_signed_immutability_probe.sql").read_text())
