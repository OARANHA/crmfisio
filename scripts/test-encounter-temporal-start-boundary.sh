#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=encounter_temporal_start_boundary_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "encounter_temporal_start_boundary_test" ]]; then
  echo "Refusing to run #400 harness outside encounter_temporal_start_boundary_test" >&2
  exit 1
fi

MIGRATION="supabase-migrations/20260910_encounter_temporal_start_boundary.sql"
GENERATED="/tmp/encounter_temporal_start_boundary_400.sql"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

python3 - <<'PY'
from pathlib import Path
import re

sql = Path('supabase-migrations/20260910_encounter_temporal_start_boundary.sql').read_text()

for pattern, message in [
    (r'(?i)\bUPDATE\s+public\.appointments\b', 'corrective appointment data update'),
    (r'(?i)(?:CREATE|DROP)\s+POLICY[\s\S]{0,300}?ON\s+public\.nexus_', 'Nexus policy mutation'),
    (r'(?i)ALTER\s+TABLE\s+public\.nexus_', 'Nexus table alteration'),
    (r'(?i)(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.nexus_', 'Nexus data mutation'),
    (r'(?i)CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.clinical_instrument_base_authorized\s*\(', 'base instrument authorization redesign'),
    (r'(?i)clinical_instrument_catalog', 'instrument catalog redesign'),
    (r'(?i)\bcurrent_date\b', 'timezone-blind current_date use'),
    (r'(?i)enfermagem|enfermeir|COREN', 'unapproved nursing expansion'),
]:
    if re.search(pattern, sql):
        raise SystemExit(f'#400 static safety failed: {message}')

required = [
    "timezone('America/Sao_Paulo', now())::date",
    'current_clinic_operational_date',
    'guard_appointment_encounter_temporal_start',
    "NEW.status IS DISTINCT FROM 'em_atendimento'",
    'NEW.data > v_operational_date',
    'appointment_future_encounter_start_forbidden',
    'can_apply_clinical_instrument_in_encounter',
    'a.data <= public.current_clinic_operational_date()',
    "a.status = 'em_atendimento'",
    'a.professional_id = v_uid',
    "v_jwt_role = 'service_role'",
    "session_user IN ('postgres', 'supabase_admin')",
    "SET LOCAL lock_timeout = '5s'",
    "SET LOCAL statement_timeout = '30s'",
]
for token in required:
    if token not in sql:
        raise SystemExit(f'#400 static safety failed: missing {token}')

# The #399 helper may be hardened only with the date predicate; its base
# authorization, catalog and Nexus contracts must not be redefined here.
if sql.count('CREATE OR REPLACE FUNCTION public.can_apply_clinical_instrument_in_encounter') != 1:
    raise SystemExit('#400 static safety failed: #399 helper replacement count')

print('#400 static safety: temporal-only boundary; operational timezone and internal bypass preserved')
PY

python3 scripts/build-encounter-temporal-start-sql-test.py > "$GENERATED"
"${PSQL[@]}" -f "$GENERATED"
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260910_ENCOUNTER_TEMPORAL_START_BOUNDARY.sql

echo "#400 PostgreSQL 16: 12 temporal behavior cases + migration replay + read-only verifier passed"
