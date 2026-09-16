#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_encounter_record_foundation_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_encounter_record_foundation_test" ]]; then
  echo "Refusing to run addendum gate outside clinical_encounter_record_foundation_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)

# Reuse the exact #394 effective-stack harness first. Addendum V1 is only valid
# if the original Record/Evolution finalization contract remains green.
if [[ "${ENCOUNTER_RECORD_FOUNDATION_READY:-0}" != "1" ]]; then
  SKIP_ENCOUNTER_RECORD_ADDENDUM_V1=1 bash scripts/test-clinical-encounter-record-foundation.sh
fi

# Replay twice to prove rollout idempotency before behavior cases.
"${PSQL[@]}" -f supabase-migrations/20260915_clinical_encounter_record_addendum_v1.sql
"${PSQL[@]}" -f supabase-migrations/20260915_clinical_encounter_record_addendum_v1.sql

"${PSQL[@]}" -f tests/sql/clinical_encounter_record_addendum_v1_cases.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260915_CLINICAL_ENCOUNTER_RECORD_ADDENDUM_V1.sql

echo "Encounter Record Correction/Addendum V1 PostgreSQL gate PASS"
