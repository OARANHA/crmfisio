#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=cage_clinician_assisted_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "cage_clinician_assisted_v1_test" || ! "$PGHOST" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
  echo 'Refusing to run CAGE V1 harness outside its disposable local database' >&2
  exit 1
fi

GENERATED="/tmp/cage_clinician_assisted_v1.sql"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

python3 - <<'PY'
from pathlib import Path
import re
migration = Path('supabase-migrations/20260916_cage_clinician_assisted_v1.sql').read_text()
engine = Path('supabase/functions/_shared/clinical-instrument-engine.ts').read_text()
public_catalog = Path('src/lib/nexus/publicSelfAssessmentCatalog.ts').read_text()
assisted_catalog = Path('src/lib/nexus/clinicianAssistedInstrumentCatalog.ts').read_text()

for token in ['cage', 'nexus.cage', 'nexus-cage-2026-09-16', 'clinical_instrument_catalog']:
    if token not in migration:
        raise SystemExit(f'CAGE static safety failed: migration missing {token}')
for forbidden in ['professional_capabilities', 'clinic_clinical_instrument_settings(', 'clinical_instrument_patient_self_contracts(']:
    if re.search(r'(?i)INSERT\s+INTO\s+public\.' + re.escape(forbidden), migration):
        raise SystemExit(f'CAGE static safety failed: migration writes {forbidden}')
for token in ["toolKey: 'cage'", "ruleKey: 'nexus.cage'", "ruleVersion: CAGE_RULE_VERSION", 'maxScore: 4', "requireIntegerRange(answers, ['q1', 'q2', 'q3', 'q4'], 0, 1, 'CAGE')"]:
    if token not in engine:
        raise SystemExit(f'CAGE static safety failed: engine missing {token}')
if "'cage'" in public_catalog:
    raise SystemExit('CAGE static safety failed: public patient-self catalog widened')
if "toolKey: 'cage'" not in assisted_catalog:
    raise SystemExit('CAGE static safety failed: clinician-assisted catalog missing CAGE')
print('CAGE static safety: complete answers + assisted-only exposure + default-deny preserved')
PY

python3 scripts/build-cage-clinician-assisted-v1-sql-test.py > "$GENERATED"
"${PSQL[@]}" -f "$GENERATED"
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260910_CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_CLINICIAN_ASSISTED_CLINICAL_INSTRUMENTS_V1.sql
"${PSQL[@]}" -f supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260916_CAGE_CLINICIAN_ASSISTED_V1.sql

echo 'CAGE_CLINICIAN_ASSISTED_V1_POSTGRES16_OK'
