#!/usr/bin/env bash
# Disposable local/CI PostgreSQL only. Never target production.
set -euo pipefail

if [[ "${PGDATABASE:-}" != nexus_c04_test || ! "${PGHOST:-}" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
  echo 'Use PGDATABASE=nexus_c04_test and PGHOST=127.0.0.1 for a disposable database.' >&2
  exit 2
fi

cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

python3 scripts/build-nexus-c04-sql-test.py > "$tmp/c04.sql"
if ! psql -X -v ON_ERROR_STOP=1 -f "$tmp/c04.sql" > "$tmp/c04.log" 2>&1; then
  tail -n 180 "$tmp/c04.log" >&2
  exit 1
fi

grep -F 'NEXUS_C03_BEHAVIOR_OK' "$tmp/c04.log"
grep -F 'NEXUS_C04_BEHAVIOR_OK' "$tmp/c04.log"

psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c04_clinical_record_incorporation.sql > "$tmp/c04-verifier.log"
grep -F 'NEXUS_C04_VERIFIED' "$tmp/c04-verifier.log"

# Prior effective contracts must remain independently green after C-04.
psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c03_clinical_lifecycle.sql > "$tmp/c03-verifier.log"
grep -F 'NEXUS_C03_VERIFIED' "$tmp/c03-verifier.log"
psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql > "$tmp/c02-verifier.log"
grep -F 'NEXUS_C02_VERIFIED' "$tmp/c02-verifier.log"
psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql > "$tmp/c06-verifier.log"
grep -F 'NEXUS_C06_VERIFIED' "$tmp/c06-verifier.log"

# C-04 verifier must reject loss of uniqueness and loss of the immutable trigger.
psql -X -v ON_ERROR_STOP=1 -c 'ALTER TABLE public.clinical_record_nexus_incorporations DISABLE TRIGGER trg_clinical_record_nexus_immutable'
if psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c04_clinical_record_incorporation.sql > "$tmp/immutability-drift.log" 2>&1; then
  echo 'C-04 verifier accepted a disabled incorporation immutability trigger.' >&2
  exit 1
fi
grep -F 'nexus_c04_immutability_guard_drift' "$tmp/immutability-drift.log"
psql -X -v ON_ERROR_STOP=1 -c 'ALTER TABLE public.clinical_record_nexus_incorporations ENABLE TRIGGER trg_clinical_record_nexus_immutable'

psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c04_clinical_record_incorporation.sql > "$tmp/final-verifier.log"
grep -F 'NEXUS_C04_VERIFIED' "$tmp/final-verifier.log"

echo 'NEXUS_C04_POSTGRES16_OK'
