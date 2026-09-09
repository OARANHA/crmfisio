#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_authorization_reconciliation_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_authorization_reconciliation_test" ]]; then
  echo "Refusing to run authorization reconciliation harness outside clinical_authorization_reconciliation_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)

"${PSQL[@]}" -f tests/sql/clinical_authorization_reconciliation_fixture.sql
"${PSQL[@]}" -f tests/sql/clinical_authorization_reconciliation_precondition.sql

# The migration is intentionally replayed twice to prove safe reapplication of
# its additive column, CREATE OR REPLACE functions and canonical policy rebuilds.
"${PSQL[@]}" -f supabase-migrations/20260909_clinical_authorization_reconciliation.sql
"${PSQL[@]}" -f supabase-migrations/20260909_clinical_authorization_reconciliation.sql

"${PSQL[@]}" -f tests/sql/clinical_authorization_reconciliation_cases.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260909_CLINICAL_AUTHORIZATION_RECONCILIATION.sql

run_negative_control() {
  local name="$1"
  local mutation_file="$2"
  local negative_db="${PGDATABASE}_${name}"

  dropdb --maintenance-db=postgres --if-exists "$negative_db" >/dev/null 2>&1 || true
  createdb --maintenance-db=postgres --template="$PGDATABASE" "$negative_db"

  PGDATABASE="$negative_db" "${PSQL[@]}" -f "$mutation_file"

  set +e
  PGDATABASE="$negative_db" "${PSQL[@]}" \
    -f supabase-verifiers/VERIFY_20260909_CLINICAL_AUTHORIZATION_RECONCILIATION.sql \
    >"/tmp/${name}.log" 2>&1
  local status=$?
  set -e

  if [[ $status -eq 0 ]]; then
    cat "/tmp/${name}.log"
    echo "Negative control '$name' unexpectedly passed verifier" >&2
    exit 1
  fi

  echo "negative control '$name': verifier failed as expected"
  dropdb --maintenance-db=postgres --if-exists "$negative_db" >/dev/null
}

run_negative_control legacy_role tests/sql/clinical_authorization_negative_legacy_role.sql
run_negative_control missing_professional_policy tests/sql/clinical_authorization_negative_policy.sql
run_negative_control missing_ownership tests/sql/clinical_authorization_negative_ownership.sql
