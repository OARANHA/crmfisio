#!/usr/bin/env bash
# Disposable local/CI PostgreSQL only. Requires an EMPTY nexus_c01_test database.
set -euo pipefail
if [[ "${PGDATABASE:-}" != nexus_c01_test || ! "${PGHOST:-}" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
  echo 'Use PGDATABASE=nexus_c01_test and PGHOST=127.0.0.1 for a disposable database.' >&2
  exit 2
fi
cd "$(dirname "$0")/.."
nexus_test_tmp="$(mktemp -d)"
trap 'rm -rf "$nexus_test_tmp"' EXIT
python3 scripts/build-nexus-c01-sql-test.py --before > "$nexus_test_tmp/before.sql"
# The expected failure rolls back all fixture objects, including test roles.
if psql -X -v ON_ERROR_STOP=1 --single-transaction -f "$nexus_test_tmp/before.sql" > "$nexus_test_tmp/before.log" 2>&1; then
  echo 'Pre-fix RLS unexpectedly passed the negative test.' >&2
  exit 1
fi
grep -F 'C01 assertion nonmedical owner table nexus_clinical_results: expected 0, got 1' "$nexus_test_tmp/before.log"
python3 scripts/build-nexus-c01-sql-test.py > "$nexus_test_tmp/after.sql"
psql -X -v ON_ERROR_STOP=1 -f "$nexus_test_tmp/after.sql" > "$nexus_test_tmp/after.log"
grep -F 'NEXUS_C01_BEHAVIOR_OK' "$nexus_test_tmp/after.log"
psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c01_read_boundary.sql
# Prove that the verifier fails on missing protection, rather than printing false.
psql -X -v ON_ERROR_STOP=1 -c 'DROP POLICY nexus_results_read_guard ON public.nexus_clinical_results'
if psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c01_read_boundary.sql > "$nexus_test_tmp/drift.log" 2>&1; then
  echo 'Verifier accepted a missing restrictive guard.' >&2
  exit 1
fi
grep -F 'nexus_c01_missing_policies: nexus_clinical_results' "$nexus_test_tmp/drift.log"
# Restore and reverify the disposable database.
psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_nexus_c01_read_boundary.sql
psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c01_read_boundary.sql
# An older/weaker helper must abort migration before policy changes.
psql -X -At -v ON_ERROR_STOP=1 -c "SELECT pg_get_functiondef('public.current_clinic_id()'::regprocedure)" > "$nexus_test_tmp/helper.sql"
psql -X -v ON_ERROR_STOP=1 -c "CREATE OR REPLACE FUNCTION public.current_clinic_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS 'SELECT NULL::uuid'"
if psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_nexus_c01_read_boundary.sql > "$nexus_test_tmp/helper-drift.log" 2>&1; then
  echo 'Migration accepted an unreviewed helper definition.' >&2
  exit 1
fi
grep -F 'nexus_c01_helper_drift: public.current_clinic_id()' "$nexus_test_tmp/helper-drift.log"
psql -X -v ON_ERROR_STOP=1 -f "$nexus_test_tmp/helper.sql"
psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260908_verify_nexus_c01_read_boundary.sql
