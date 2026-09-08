#!/usr/bin/env bash
# Disposable local/CI PostgreSQL only. Requires an EMPTY nexus_c06_test database.
set -euo pipefail

if [[ "${PGDATABASE:-}" != nexus_c06_test || ! "${PGHOST:-}" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
  echo 'Use PGDATABASE=nexus_c06_test and PGHOST=127.0.0.1 for a disposable database.' >&2
  exit 2
fi

cd "$(dirname "$0")/.."
nexus_test_tmp="$(mktemp -d)"
trap 'rm -rf "$nexus_test_tmp"' EXIT

python3 scripts/build-nexus-c06-sql-test.py --before > "$nexus_test_tmp/before.sql"

# Pre-C06, C-01 is present but role=professional is still rejected by the shared
# care helper. The expected failure rolls the whole fixture back.
if psql -X -v ON_ERROR_STOP=1 --single-transaction \
    -f "$nexus_test_tmp/before.sql" > "$nexus_test_tmp/before.log" 2>&1; then
  echo 'Pre-C06 professional care regression unexpectedly passed.' >&2
  exit 1
fi
grep -F 'C06 regression: canonical professional appointment relationship remains blocked' \
  "$nexus_test_tmp/before.log"

python3 scripts/build-nexus-c06-sql-test.py > "$nexus_test_tmp/after.sql"
psql -X -v ON_ERROR_STOP=1 -f "$nexus_test_tmp/after.sql" \
  > "$nexus_test_tmp/after.log"
grep -F 'NEXUS_C06_BEHAVIOR_OK' "$nexus_test_tmp/after.log"

# The historical C-01 verifier intentionally owns the pre-C06 helper
# fingerprints. It must no longer be treated as authoritative after C-06.
if psql -X -v ON_ERROR_STOP=1 \
    -f supabase-migrations/20260908_verify_nexus_c01_read_boundary.sql \
    > "$nexus_test_tmp/old-c01-verifier.log" 2>&1; then
  echo 'Historical C-01 verifier unexpectedly accepted C-06 helper fingerprints.' >&2
  exit 1
fi
grep -F 'nexus_c01_helper_drift: public.has_professional_capability(text)' \
  "$nexus_test_tmp/old-c01-verifier.log"

psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql

# Prove the C-06 verifier rejects a missing C-01 RESTRICTIVE guard.
psql -X -v ON_ERROR_STOP=1 \
  -c 'DROP POLICY nexus_results_read_guard ON public.nexus_clinical_results'
if psql -X -v ON_ERROR_STOP=1 \
    -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql \
    > "$nexus_test_tmp/guard-drift.log" 2>&1; then
  echo 'C-06 verifier accepted a missing C-01 restrictive guard.' >&2
  exit 1
fi
grep -F 'nexus_c06_c01_policy_missing: nexus_clinical_results' \
  "$nexus_test_tmp/guard-drift.log"

psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE POLICY nexus_results_read_guard
ON public.nexus_clinical_results
AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND public.has_professional_capability('nexus.access')
);
SQL

psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql

# Prove both migration and verifier reject an unreviewed helper body.
psql -X -At -v ON_ERROR_STOP=1 \
  -c "SELECT pg_get_functiondef('public.can_access_patient_clinical_record(uuid)'::regprocedure)" \
  > "$nexus_test_tmp/care-helper.sql"

psql -X -v ON_ERROR_STOP=1 -c \
  "CREATE OR REPLACE FUNCTION public.can_access_patient_clinical_record(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS 'SELECT false'"

if psql -X -v ON_ERROR_STOP=1 \
    -f supabase-migrations/20260908_nexus_c06_professional_authorization.sql \
    > "$nexus_test_tmp/migration-helper-drift.log" 2>&1; then
  echo 'C-06 migration accepted an unreviewed care helper body.' >&2
  exit 1
fi
grep -F 'nexus_c06_helper_drift: public.can_access_patient_clinical_record(uuid)' \
  "$nexus_test_tmp/migration-helper-drift.log"

if psql -X -v ON_ERROR_STOP=1 \
    -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql \
    > "$nexus_test_tmp/verifier-helper-drift.log" 2>&1; then
  echo 'C-06 verifier accepted an unreviewed care helper body.' >&2
  exit 1
fi
grep -F 'nexus_c06_helper_drift: public.can_access_patient_clinical_record(uuid)' \
  "$nexus_test_tmp/verifier-helper-drift.log"

psql -X -v ON_ERROR_STOP=1 -f "$nexus_test_tmp/care-helper.sql"
psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql

# Structural fisio_id compatibility is allowed only while it agrees with the
# canonical professional_id reference.
psql -X -v ON_ERROR_STOP=1 -c \
  "UPDATE public.appointments SET fisio_id='00000000-0000-0000-0000-000000000102' WHERE id='00000000-0000-0000-0000-000000000501'"

if psql -X -v ON_ERROR_STOP=1 \
    -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql \
    > "$nexus_test_tmp/bridge-drift.log" 2>&1; then
  echo 'C-06 verifier accepted professional_id/fisio_id bridge drift.' >&2
  exit 1
fi
grep -F 'nexus_c06_appointment_professional_bridge_drift' \
  "$nexus_test_tmp/bridge-drift.log"

psql -X -v ON_ERROR_STOP=1 -c \
  "UPDATE public.appointments SET fisio_id=professional_id WHERE fisio_id IS DISTINCT FROM professional_id"
psql -X -v ON_ERROR_STOP=1 \
  -f supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql
