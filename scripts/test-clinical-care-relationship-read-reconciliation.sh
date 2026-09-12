#!/usr/bin/env bash
set -euo pipefail
: "${PGDATABASE:=clinical_care_read_test}"; : "${PGHOST:=localhost}"
[[ "$PGDATABASE" = clinical_care_read_test ]] || exit 2
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
python3 scripts/build-nexus-c06-sql-test.py > "$tmp/bootstrap.sql"
psql -X -v ON_ERROR_STOP=1 -f "$tmp/bootstrap.sql" >/dev/null
python3 scripts/build-clinical-care-read-test.py | psql -X -v ON_ERROR_STOP=1
psql -X -v ON_ERROR_STOP=1 -f tests/sql/clinical_care_relationship_read_reconciliation_fixture.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000111',true);
DO $$ BEGIN
  IF public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000302') THEN
    RAISE EXCEPTION 'pre_fix_bug_not_reproduced';
  END IF;
END $$;
COMMIT;
SQL
psql -X -v ON_ERROR_STOP=1 -f supabase-migrations/20260912_clinical_care_relationship_read_reconciliation.sql
psql -X -v ON_ERROR_STOP=1 -f supabase-verifiers/VERIFY_20260912_CLINICAL_CARE_RELATIONSHIP_READ_RECONCILIATION.sql
psql -X -v ON_ERROR_STOP=1 -f tests/sql/clinical_care_relationship_read_reconciliation_cases.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TEMP TABLE care_read_before AS
SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS definition, p.proacl
FROM pg_proc p
WHERE p.oid IN (
  'public.can_access_patient_clinical_record(uuid)'::regprocedure,
  'public.list_patient_clinical_snapshot()'::regprocedure
)
ORDER BY p.oid;
\i supabase-migrations/20260912_clinical_care_relationship_read_reconciliation.sql
\i supabase-verifiers/VERIFY_20260912_CLINICAL_CARE_RELATIONSHIP_READ_RECONCILIATION.sql
\i tests/sql/clinical_care_relationship_read_reconciliation_cases.sql
DO $$
BEGIN
  IF EXISTS (
    (SELECT oid, proname, definition, proacl FROM care_read_before
     EXCEPT ALL
     SELECT p.oid, p.proname, pg_get_functiondef(p.oid), p.proacl FROM pg_proc p
     WHERE p.oid IN ('public.can_access_patient_clinical_record(uuid)'::regprocedure,
                     'public.list_patient_clinical_snapshot()'::regprocedure))
    UNION ALL
    (SELECT p.oid, p.proname, pg_get_functiondef(p.oid), p.proacl FROM pg_proc p
     WHERE p.oid IN ('public.can_access_patient_clinical_record(uuid)'::regprocedure,
                     'public.list_patient_clinical_snapshot()'::regprocedure)
     EXCEPT ALL
     SELECT oid, proname, definition, proacl FROM care_read_before)
  ) THEN
    RAISE EXCEPTION 'care_read_reconciliation_not_idempotent';
  END IF;
END $$;
SQL
