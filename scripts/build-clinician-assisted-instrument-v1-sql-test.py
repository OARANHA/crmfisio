"""Emit the disposable PostgreSQL 16 Clinician-Assisted Administration V1 suite.

The existing #399 builder supplies the effective #399 -> #400 authorization stack,
fixtures, 38 approved cases and four Nexus-only negative controls. This builder
then applies the V1 administration migration twice and executes its behavior cases.
"""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]

baseline = subprocess.run(
    [sys.executable, str(root / "scripts/build-clinical-instrument-encounter-sql-test.py")],
    check=True,
    capture_output=True,
    text=True,
)
print(baseline.stdout)

migration = root / "supabase-migrations/20260913_clinician_assisted_clinical_instruments_v1.sql"
print(migration.read_text())
print(migration.read_text())

print((root / "tests/sql/clinician_assisted_clinical_instruments_v1_cases.sql").read_text())
