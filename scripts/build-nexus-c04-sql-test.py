"""Emit the disposable PostgreSQL 16 Nexus C-04 record-incorporation suite.

C-03 builder establishes the effective C-01/C-06/C-02/C-03 runtime, including
canonical signed immutability. C-04 is then applied additively and exercised
against the same realistic actor/result fixtures.
"""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]

baseline = subprocess.run(
    [sys.executable, str(root / "scripts/build-nexus-c03-sql-test.py")],
    check=True,
    capture_output=True,
    text=True,
)
print(baseline.stdout)
print((root / "supabase-migrations/20260908_nexus_c04_clinical_record_incorporation.sql").read_text())
print((root / "supabase-migrations/20260908_nexus_c04_clinical_record_incorporation.sql").read_text())
print((root / "tests/sql/nexus_c04_eem_soap_fixture.sql").read_text())
print((root / "tests/sql/nexus_c04_cases.sql").read_text())
