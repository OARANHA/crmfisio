#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinician_assisted_instrument_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinician_assisted_instrument_v1_test" ]]; then
  echo "Refusing to run clinician-assisted V1 harness outside clinician_assisted_instrument_v1_test" >&2
  exit 1
fi

GENERATED="/tmp/clinician_assisted_instrument_v1.sql"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

python3 - <<'PY'
from pathlib import Path
import re

migration = Path('supabase-migrations/20260913_clinician_assisted_clinical_instruments_v1.sql').read_text()
edge = Path('supabase/functions/clinical-instrument-clinician-assisted/index.ts').read_text()
processor = Path('supabase/functions/nexus-self-assessment-processor/index.ts').read_text()
engine = Path('supabase/functions/_shared/clinical-instrument-engine.ts').read_text()

required_migration = [
    'clinical_instrument_administrations',
    'record_clinician_assisted_clinical_instrument',
    'can_apply_clinical_instrument_in_encounter',
    'clinical_instrument_catalog',
    "'clinician_assisted'",
    'guard_clinical_instrument_administration_immutable',
    'UNIQUE (professional_id, appointment_id, request_id)',
]
for token in required_migration:
    if token not in migration:
        raise SystemExit(f'CAI static safety failed: missing migration token {token}')

for pattern, label in [
    (r'(?i)(?:CREATE|DROP)\s+POLICY[\s\S]{0,250}?ON\s+public\.nexus_', 'Nexus policy mutation'),
    (r'(?i)ALTER\s+TABLE\s+public\.nexus_', 'Nexus table alteration'),
    (r'(?i)INSERT\s+INTO\s+public\.nexus_clinical_results', 'Nexus result persistence'),
]:
    if re.search(pattern, migration):
        raise SystemExit(f'CAI static safety failed: {label}')

writer = re.search(
    r'CREATE OR REPLACE FUNCTION public\.record_clinician_assisted_clinical_instrument\([\s\S]*?\$\$;',
    migration,
    re.I,
)
if not writer:
    raise SystemExit('CAI static safety failed: writer extraction')
writer_src = writer.group()
for forbidden in ['nexus.scales', 'nexus_clinical_results', 'current_app_role', 'professional_type', 'fisio_id']:
    if forbidden in writer_src:
        raise SystemExit(f'CAI static safety failed: writer depends on {forbidden}')

for token in [
    "../_shared/clinical-instrument-engine.ts",
    'admin.auth.getUser',
    'record_clinician_assisted_clinical_instrument',
    'getClinicalInstrumentProcessor',
]:
    if token not in edge:
        raise SystemExit(f'CAI static safety failed: Edge missing {token}')
for forbidden in ['nexus.scales', 'requiredCapability']:
    if forbidden in edge:
        raise SystemExit(f'CAI static safety failed: neutral Edge depends on {forbidden}')

if "../_shared/clinical-instrument-engine.ts" not in processor:
    raise SystemExit('CAI static safety failed: self-assessment processor does not reuse shared engine')
for duplicated in ['const PHQ9:', 'const GAD7:', 'function requireIntegerRange(']:
    if duplicated in processor:
        raise SystemExit(f'CAI static safety failed: scorer duplication remains: {duplicated}')

for token in ['nexus.phq9', 'nexus.gad7', 'nexus-2026-09-03', 'phq9.item9.positive']:
    if token not in engine:
        raise SystemExit(f'CAI static safety failed: shared engine missing {token}')

print('CAI static safety: #399 act boundary reused; Nexus scorer shared; neutral persistence isolated')
PY

python3 scripts/build-clinician-assisted-instrument-v1-sql-test.py > "$GENERATED"
"${PSQL[@]}" -f "$GENERATED"
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260910_CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_CLINICIAN_ASSISTED_CLINICAL_INSTRUMENTS_V1.sql

echo "Clinician-Assisted Administration V1 PostgreSQL 16: effective #399/#400 stack + replay + behavior + historical #399 verifier + V1 read-only verifier passed"
