#!/usr/bin/env bash
# Disposable local/CI PostgreSQL only. Never target production.
set -euo pipefail

if [[ "${PGDATABASE:-}" != nexus_c03_test || ! "${PGHOST:-}" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
  echo 'Use PGDATABASE=nexus_c03_test and PGHOST=127.0.0.1 for a disposable database.' >&2
  exit 2
fi

cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

python3 scripts/build-nexus-c03-sql-test.py > "$tmp/c03.sql"
if ! psql -X -v ON_ERROR_STOP=1 -f "$tmp/c03.sql" > "$tmp/c03.log" 2>&1; then
  tail -n 120 "$tmp/c03.log" >&2
  exit 1
fi

grep -F 'NEXUS_C03_FINALIZED_WITHOUT_HUMAN_REVIEW_REPRODUCED' "$tmp/c03.log"
grep -F 'NEXUS_C03_BEHAVIOR_OK' "$tmp/c03.log"

psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c03_clinical_lifecycle.sql \
  > "$tmp/c03-verifier.log"
grep -F 'NEXUS_C03_VERIFIED' "$tmp/c03-verifier.log"

# Earlier contracts remain independently verifiable after C-03.
psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c02_trusted_result_contract.sql \
  > "$tmp/c02-verifier.log"
grep -F 'NEXUS_C02_VERIFIED' "$tmp/c02-verifier.log"

psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql \
  > "$tmp/c06-verifier.log"
grep -F 'NEXUS_C06_VERIFIED' "$tmp/c06-verifier.log"

# The C-03 verifier must reject a disabled lifecycle guard.
psql -X -v ON_ERROR_STOP=1 -c \
  'ALTER TABLE public.nexus_result_clinical_lifecycle DISABLE TRIGGER trg_nexus_result_clinical_lifecycle'
if psql -X -v ON_ERROR_STOP=1 \
    -f supabase-migrations/20260908_verify_nexus_c03_clinical_lifecycle.sql \
    > "$tmp/trigger-drift.log" 2>&1; then
  echo 'C-03 verifier accepted a disabled lifecycle trigger.' >&2
  exit 1
fi
grep -F 'nexus_c03_lifecycle_trigger_missing_or_disabled' "$tmp/trigger-drift.log"
psql -X -v ON_ERROR_STOP=1 -c \
  'ALTER TABLE public.nexus_result_clinical_lifecycle ENABLE TRIGGER trg_nexus_result_clinical_lifecycle'

psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c03_clinical_lifecycle.sql \
  > "$tmp/final-verifier.log"
grep -F 'NEXUS_C03_VERIFIED' "$tmp/final-verifier.log"

echo 'NEXUS_C03_POSTGRES16_OK'