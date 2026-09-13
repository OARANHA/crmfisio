"""Emit the disposable PostgreSQL 16 PHQ-15 clinician-assisted V1 suite."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]

baseline = subprocess.run(
    [sys.executable, str(root / 'scripts/build-clinician-assisted-instrument-v1-sql-test.py')],
    check=True,
    capture_output=True,
    text=True,
)
print(baseline.stdout)

print("""
CREATE TEMP TABLE phq15_pre_capabilities AS
SELECT clinic_id, professional_id, capability_key, granted
FROM public.professional_capabilities;

CREATE TEMP TABLE phq15_pre_settings AS
SELECT clinic_id, instrument_key, enabled, configured_by
FROM public.clinic_clinical_instrument_settings;
""")

migration = root / 'supabase-migrations/20260913_phq15_clinician_assisted_v1.sql'
print(migration.read_text())
print(migration.read_text())
print("""
DO $$ BEGIN
  IF EXISTS (
    (SELECT * FROM phq15_pre_capabilities EXCEPT SELECT clinic_id, professional_id, capability_key, granted FROM public.professional_capabilities)
    UNION ALL
    (SELECT clinic_id, professional_id, capability_key, granted FROM public.professional_capabilities EXCEPT SELECT * FROM phq15_pre_capabilities)
  ) THEN RAISE EXCEPTION 'PHQ15 migration changed professional capabilities'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinic_clinical_instrument_settings
    WHERE instrument_key='phq15'
  ) THEN RAISE EXCEPTION 'PHQ15 migration auto-enabled clinic setting'; END IF;

  IF EXISTS (
    (SELECT * FROM phq15_pre_settings EXCEPT SELECT clinic_id, instrument_key, enabled, configured_by FROM public.clinic_clinical_instrument_settings)
    UNION ALL
    (SELECT clinic_id, instrument_key, enabled, configured_by FROM public.clinic_clinical_instrument_settings EXCEPT SELECT * FROM phq15_pre_settings)
  ) THEN RAISE EXCEPTION 'PHQ15 migration changed existing clinic settings'; END IF;
END $$;
""")

print((root / 'tests/sql/phq15_clinician_assisted_v1_cases.sql').read_text())
