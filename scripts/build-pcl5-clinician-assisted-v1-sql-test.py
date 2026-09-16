"""Emit the disposable PostgreSQL 16 PCL-5 clinician-assisted V1 suite."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]

baseline = subprocess.run(
    [sys.executable, str(root / 'scripts/build-phq15-clinician-assisted-v1-sql-test.py')],
    check=True,
    capture_output=True,
    text=True,
)
baseline_sql = baseline.stdout.replace(
    "CREATE ROLE authenticated NOLOGIN;\nCREATE ROLE anon NOLOGIN;\nCREATE ROLE service_role NOLOGIN BYPASSRLS;",
    """DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF; END $$;""",
)
print(baseline_sql)

print("""
CREATE TEMP TABLE pcl5_pre_capabilities AS
SELECT clinic_id, professional_id, capability_key, granted
FROM public.professional_capabilities;

CREATE TEMP TABLE pcl5_pre_settings AS
SELECT clinic_id, instrument_key, enabled, configured_by
FROM public.clinic_clinical_instrument_settings;
""")

migration = root / 'supabase-migrations/20260916_pcl5_clinician_assisted_v1.sql'
print(migration.read_text())
print(migration.read_text())
print("""
DO $$ BEGIN
  IF EXISTS (
    (SELECT * FROM pcl5_pre_capabilities EXCEPT SELECT clinic_id, professional_id, capability_key, granted FROM public.professional_capabilities)
    UNION ALL
    (SELECT clinic_id, professional_id, capability_key, granted FROM public.professional_capabilities EXCEPT SELECT * FROM pcl5_pre_capabilities)
  ) THEN RAISE EXCEPTION 'PCL5 migration changed professional capabilities'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinic_clinical_instrument_settings
    WHERE instrument_key='pcl5'
  ) THEN RAISE EXCEPTION 'PCL5 migration auto-enabled clinic setting'; END IF;

  IF EXISTS (
    (SELECT * FROM pcl5_pre_settings EXCEPT SELECT clinic_id, instrument_key, enabled, configured_by FROM public.clinic_clinical_instrument_settings)
    UNION ALL
    (SELECT clinic_id, instrument_key, enabled, configured_by FROM public.clinic_clinical_instrument_settings EXCEPT SELECT * FROM pcl5_pre_settings)
  ) THEN RAISE EXCEPTION 'PCL5 migration changed existing clinic settings'; END IF;
END $$;
""")

print((root / 'tests/sql/pcl5_clinician_assisted_v1_cases.sql').read_text())
