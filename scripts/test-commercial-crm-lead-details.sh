#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=commercial_crm_lead_details_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "commercial_crm_lead_details_test" ]]; then
  echo "Refusing to run Lead details harness outside commercial_crm_lead_details_test" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -X)
CORE_DB="commercial_crm_lead_details_core_regression_test"

cleanup() {
  dropdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" --if-exists "$CORE_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Prove the released Commercial Core behavior in an isolated sibling database.
# Its behavior fixture intentionally creates Patient-linked Contacts, so it must
# not contaminate the later Identity Resolution behavior suite.
cleanup
createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$CORE_DB"
PGDATABASE="$CORE_DB" "${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_core_foundation_fixture.sql"
PGDATABASE="$CORE_DB" "${PSQL[@]}" -f "$ROOT/supabase-migrations/20260927_updated_at_helper_reconciliation.sql"
PGDATABASE="$CORE_DB" "${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260927_UPDATED_AT_HELPER_RECONCILIATION.sql"
PGDATABASE="$CORE_DB" "${PSQL[@]}" -f "$ROOT/supabase-migrations/20260926_commercial_crm_core_foundation.sql"
PGDATABASE="$CORE_DB" "${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_CORE_FOUNDATION.sql"
PGDATABASE="$CORE_DB" "${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_core_foundation_cases.sql"
cleanup

# Build the final released Commercial CRM schema plus MED-CRM-008 in the primary
# isolated database, then run the remaining released regressions and new cases.
"${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_core_foundation_fixture.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260927_updated_at_helper_reconciliation.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260927_UPDATED_AT_HELPER_RECONCILIATION.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260926_commercial_crm_core_foundation.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260926_commercial_crm_command_boundary.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260927_commercial_crm_archived_pipeline_transition_guard.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260927_commercial_crm_contact_identity_resolution.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260928_commercial_crm_lead_details.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260928_commercial_crm_lead_details.sql"

"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_CORE_FOUNDATION.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_COMMAND_BOUNDARY.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_ARCHIVED_PIPELINE_TRANSITION_GUARD.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260927_COMMERCIAL_CRM_CONTACT_IDENTITY_RESOLUTION.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260928_COMMERCIAL_CRM_LEAD_DETAILS.sql"

"${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_command_boundary_cases.sql"
"${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_archived_pipeline_transition_guard_cases.sql"
"${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_contact_identity_resolution_cases.sql"
bash "$ROOT/scripts/test-commercial-crm-contact-identity-resolution-concurrency.sh"

# MED-CRM-008 behavior runs only after all released regressions pass.
"${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_lead_details_cases.sql"

echo "commercial CRM Lead details: PostgreSQL verifier, released regressions, concurrency and behavior cases passed"
