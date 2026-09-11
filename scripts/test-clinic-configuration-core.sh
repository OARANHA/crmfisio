#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinic_configuration_core_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinic_configuration_core_test" ]]; then
  echo "Refusing to run Clinic Configuration Core harness outside clinic_configuration_core_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)

"${PSQL[@]}" -f tests/sql/clinic_configuration_core_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260911_clinic_configuration_core.sql
# Installation must be replay-safe for controlled rollout/recovery.
"${PSQL[@]}" -f supabase-migrations/20260911_clinic_configuration_core.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260911_CLINIC_CONFIGURATION_CORE.sql

echo "clinic configuration core: PostgreSQL verifier passed"
