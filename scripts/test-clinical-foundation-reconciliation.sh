#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_foundation_reconciliation_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_foundation_reconciliation_test" ]]; then
  echo "Refusing to run reconciliation harness outside clinical_foundation_reconciliation_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)

"${PSQL[@]}" -f tests/sql/clinical_foundation_reconciliation_fixture.sql
"${PSQL[@]}" -f tests/sql/clinical_foundation_reconciliation_precondition.sql

# CREATE OR REPLACE migration is deliberately replayed twice to prove safe reapplication.
"${PSQL[@]}" -f supabase-migrations/20260908_clinical_foundation_reconciliation.sql
"${PSQL[@]}" -f supabase-migrations/20260908_clinical_foundation_reconciliation.sql

"${PSQL[@]}" -f tests/sql/clinical_foundation_reconciliation_cases.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260908_CLINICAL_FOUNDATION_RECONCILIATION.sql
