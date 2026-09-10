#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_instrument_encounter_authorization_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_instrument_encounter_authorization_test" ]]; then
  echo "Refusing to run #399 harness outside clinical_instrument_encounter_authorization_test" >&2
  exit 1
fi

MIGRATION="supabase-migrations/20260910_clinical_instrument_encounter_authorization.sql"
GENERATED="/tmp/clinical_instrument_encounter_authorization_399.sql"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

python3 - <<'PY'
from pathlib import Path
import re

path = Path('supabase-migrations/20260910_clinical_instrument_encounter_authorization.sql')
sql = path.read_text()

for pattern, message in [
    (r'(?i)CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.(?:has_professional_capability|can_access_patient_clinical_record|current_nexus_)', 'protected Nexus/C06 helper replacement'),
    (r'(?i)(?:CREATE|DROP)\s+POLICY[\s\S]{0,300}?ON\s+public\.nexus_', 'Nexus policy mutation'),
    (r'(?i)ALTER\s+TABLE\s+public\.nexus_', 'Nexus table alteration'),
    (r'(?i)(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.nexus_', 'Nexus data mutation'),
    (r'(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.clinical_instrument_(?:results|deliveries)', 'unapproved instrument persistence'),
    (r'(?i)enfermagem|enfermeir|COREN', 'unapproved nursing identity expansion'),
]:
    if re.search(pattern, sql):
        raise SystemExit(f'#399 static safety failed: {message}')

required = [
    "'clinical.instrument.apply'",
    'clinical_instrument_catalog',
    'clinic_clinical_instrument_settings',
    'clinical_instrument_base_authorized',
    'can_apply_clinical_instrument_in_encounter',
    "a.status = 'em_atendimento'",
    'a.professional_id = v_uid',
    'SET LOCAL lock_timeout',
]
for token in required:
    if token not in sql:
        raise SystemExit(f'#399 static safety failed: missing {token}')

base = re.search(
    r'CREATE OR REPLACE FUNCTION public\.clinical_instrument_base_authorized\([\s\S]*?\$\$;',
    sql,
    re.I,
)
encounter = re.search(
    r'CREATE OR REPLACE FUNCTION public\.can_apply_clinical_instrument_in_encounter\([\s\S]*?\$\$;',
    sql,
    re.I,
)
setting_validator = re.search(
    r'CREATE OR REPLACE FUNCTION public\.validate_clinic_clinical_instrument_setting\([\s\S]*?\$\$;',
    sql,
    re.I,
)
setting_rpc = re.search(
    r'CREATE OR REPLACE FUNCTION public\.set_clinic_clinical_instrument_enabled\([\s\S]*?\$\$;',
    sql,
    re.I,
)
if not base or not encounter or not setting_validator or not setting_rpc:
    raise SystemExit('#399 static safety failed: authorization/config helper extraction')

for name, fn in [
    ('base authorization', base),
    ('settings validator', setting_validator),
    ('settings RPC', setting_rpc),
]:
    if 'nexus_result_contracts' in fn.group():
        raise SystemExit(f'#399 static safety failed: {name} uses Nexus registry as exposure authority')
    if 'clinical_instrument_catalog' not in fn.group():
        raise SystemExit(f'#399 static safety failed: {name} bypasses neutral instrument catalog')

if 'can_access_patient_clinical_record' in base.group() or 'can_access_patient_clinical_record' in encounter.group():
    raise SystemExit('#399 static safety failed: read boundary used as act authority')
if 'fisio_id' in encounter.group():
    raise SystemExit('#399 static safety failed: compatibility fisio_id used as act authority')
if "'nexus.scales'" in base.group():
    raise SystemExit('#399 static safety failed: Nexus capability used by neutral base boundary')

if not re.search(
    r'REVOKE ALL ON FUNCTION public\.clinical_instrument_base_authorized\(uuid, text\)\s+FROM PUBLIC, anon, authenticated;',
    sql,
    re.I,
):
    raise SystemExit('#399 static safety failed: internal base helper browser ACL')

catalog_seed = re.findall(
    r"\('(?:phq9|gad7)'\s*,\s*'nexus'\s*,\s*'scales'",
    sql,
    re.I,
)
if len(catalog_seed) != 2 or 'nexus_only_scale' in sql:
    raise SystemExit('#399 static safety failed: neutral catalog seed is not explicitly PHQ-9/GAD-7 only')

print('#399 static safety: neutral exposure catalog separated from Nexus registry; protected surface untouched')
PY

python3 scripts/build-clinical-instrument-encounter-sql-test.py > "$GENERATED"
"${PSQL[@]}" -f "$GENERATED"
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260910_CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.sql

echo "#399 PostgreSQL 16: 38 approved behavior cases + 4 Nexus-only exposure negative controls + read-only verifier passed"
