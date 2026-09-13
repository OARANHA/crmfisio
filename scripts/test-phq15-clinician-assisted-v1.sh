#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=phq15_clinician_assisted_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "phq15_clinician_assisted_v1_test" || ! "$PGHOST" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
  echo 'Refusing to run PHQ-15 V1 harness outside its disposable local database' >&2
  exit 1
fi

GENERATED="/tmp/phq15_clinician_assisted_v1.sql"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

python3 - <<'PY'
from pathlib import Path
import re

migration = Path('supabase-migrations/20260913_phq15_clinician_assisted_v1.sql').read_text()
engine = Path('supabase/functions/_shared/clinical-instrument-engine.ts').read_text()
public_catalog = Path('src/lib/nexus/publicSelfAssessmentCatalog.ts').read_text()
assisted_catalog = Path('src/lib/nexus/clinicianAssistedInstrumentCatalog.ts').read_text()
ui = Path('src/components/ClinicianAssistedInstrumentApplyNow.tsx').read_text()

for token in ['phq15', 'nexus.phq15', 'nexus-phq15-2026-09-13', 'clinical_instrument_catalog']:
    if token not in migration:
        raise SystemExit(f'PHQ15 static safety failed: migration missing {token}')

if re.search(r'(?i)INSERT\s+INTO\s+public\.professional_capabilities', migration):
    raise SystemExit('PHQ15 static safety failed: migration grants professional capability')
if re.search(r'(?i)INSERT\s+INTO\s+public\.clinic_clinical_instrument_settings', migration):
    raise SystemExit('PHQ15 static safety failed: migration auto-enables clinic setting')

for token in ["toolKey: 'phq15'", "ruleKey: 'nexus.phq15'", "ruleVersion: PHQ15_RULE_VERSION", "maxScore: 30"]:
    if token not in engine:
        raise SystemExit(f'PHQ15 static safety failed: engine missing {token}')

if "'phq15'" in public_catalog:
    raise SystemExit('PHQ15 static safety failed: public self-assessment allowlist widened')
if "toolKey: 'phq15'" not in assisted_catalog:
    raise SystemExit('PHQ15 static safety failed: clinician-assisted catalog missing PHQ-15')
if 'getClinicianAssistedInstrumentDefinition' not in ui or 'getPublicSelfAssessmentDefinition' in ui:
    raise SystemExit('PHQ15 static safety failed: Apply Now still coupled to public catalog')

for verifier_name in [
    'supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql',
    'supabase-migrations/20260908_verify_nexus_c03_clinical_lifecycle.sql',
    'supabase-migrations/20260908_verify_nexus_c04_clinical_record_incorporation.sql',
]:
    text = Path(verifier_name).read_text()
    if re.search(r'count\(\*\).*nexus_result_contracts[^\n]*<>\s*3', text, re.I):
        raise SystemExit(f'PHQ15 static safety failed: historical verifier freezes contract cardinality: {verifier_name}')

print('PHQ15 static safety: assisted-only exposure + additive engine contract + default-deny preserved')
PY

python3 scripts/build-phq15-clinician-assisted-v1-sql-test.py > "$GENERATED"
"${PSQL[@]}" -f "$GENERATED"
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260910_CLINICAL_INSTRUMENT_ENCOUNTER_AUTHORIZATION.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_CLINICIAN_ASSISTED_CLINICAL_INSTRUMENTS_V1.sql
"${PSQL[@]}" -f supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_PHQ15_CLINICIAN_ASSISTED_V1.sql

echo 'PHQ15_CLINICIAN_ASSISTED_V1_POSTGRES16_OK'
