#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=commercial_crm_core_foundation_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "commercial_crm_core_foundation_test" ]]; then
  echo "Refusing to run Commercial CRM Core harness outside commercial_crm_core_foundation_test" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

"${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_core_foundation_fixture.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260926_commercial_crm_core_foundation.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260926_commercial_crm_core_foundation.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260926_COMMERCIAL_CRM_CORE_FOUNDATION.sql"
"${PSQL[@]}" -f "$ROOT/tests/sql/commercial_crm_core_foundation_cases.sql"

echo "commercial CRM core foundation: PostgreSQL verifier and behavior cases passed"
