#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinic_communication_configuration_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinic_communication_configuration_v1_test" ]]; then
  echo "Refusing to run Clinic Communication Configuration harness outside clinic_communication_configuration_v1_test" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

"${PSQL[@]}" -f "$ROOT/tests/sql/platform_plan_catalog_assignment_v1_fixture.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260917_platform_plan_catalog_assignment_v1.sql"
"${PSQL[@]}" -f "$ROOT/tests/sql/clinic_communication_configuration_v1_fixture.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260917_clinic_communication_configuration_v1.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260917_clinic_communication_configuration_v1.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260917_clinic_communication_configuration_acl_hardening.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260917_clinic_communication_configuration_acl_hardening.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260917_CLINIC_COMMUNICATION_CONFIGURATION_V1.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260917_CLINIC_COMMUNICATION_CONFIGURATION_V1_PRODUCTION.sql"

echo "clinic communication configuration v1: PostgreSQL verifier passed"
