#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=commercial_crm_command_boundary_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "commercial_crm_command_boundary_test" ]]; then
  echo "Refusing to run Commercial CRM Command Boundary harness outside commercial_crm_command_boundary_test" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

"${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_core_foundation_fixture.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260927_updated_at_helper_reconciliation.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260927_UPDATED_AT_HELPER_RECONCILIATION.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260926_commercial_crm_core_foundation.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260926_commercial_crm_command_boundary.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260926_commercial_crm_command_boundary.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_CORE_FOUNDATION.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_COMMAND_BOUNDARY.sql"
"${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_command_boundary_cases.sql"

echo "commercial CRM command boundary: PostgreSQL verifier and behavior cases passed"
