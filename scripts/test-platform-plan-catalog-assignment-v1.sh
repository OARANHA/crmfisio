#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/tests/sql/platform_plan_catalog_assignment_v1_fixture.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260917_platform_plan_catalog_assignment_v1.sql"
"${PSQL[@]}" -f "$ROOT/supabase-migrations/20260917_platform_plan_catalog_assignment_v1.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260917_PLATFORM_PLAN_CATALOG_ASSIGNMENT_V1.sql"
"${PSQL[@]}" -f "$ROOT/supabase-verifiers/VERIFY_20260917_PLATFORM_PLAN_CATALOG_ASSIGNMENT_V1_PRODUCTION.sql"
python3 - <<'PY'
from pathlib import Path
worker = Path('supabase/functions/evolution-worker/index.ts').read_text()
assert "rpc('clinic_entitlement_allowed'" in worker, 'worker must use canonical entitlement predicate'
assert "from('platform_clinic_entitlements')" not in worker, 'worker must not bypass plan baseline with direct override reads'
print('EVOLUTION_WORKER_PLAN_ENTITLEMENT_BOUNDARY=PASS')
PY
