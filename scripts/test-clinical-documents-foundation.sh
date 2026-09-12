#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_documents_foundation_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_documents_foundation_test" ]]; then
  echo "Refusing to run D2-A harness outside clinical_documents_foundation_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Reconstruct the same effective authorization/runtime stack used by #426.
# The D2 fixture adds scenario rows only; it never redefines care/identity helpers.
python3 scripts/build-nexus-c06-sql-test.py > "$tmp/bootstrap.sql"
"${PSQL[@]}" -f "$tmp/bootstrap.sql" >/dev/null
python3 scripts/build-clinical-care-read-test.py | "${PSQL[@]}" >/dev/null
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_care_relationship_read_reconciliation.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_CARE_RELATIONSHIP_READ_RECONCILIATION.sql

"${PSQL[@]}" -f tests/sql/clinical_documents_foundation_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_documents_foundation.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql
"${PSQL[@]}" -f tests/sql/clinical_documents_foundation_cases.sql

# Replay in one session so policy/function/seed snapshots are compared against
# the exact same disposable installation before behavioral cases are rerun.
"${PSQL[@]}" <<'SQL'
CREATE TEMP TABLE d2_policy_before AS
SELECT c.relname, p.polname, p.polcmd, p.polpermissive, p.polroles::text,
       pg_get_expr(p.polqual,p.polrelid) AS qual,
       pg_get_expr(p.polwithcheck,p.polrelid) AS with_check
FROM pg_policy p
JOIN pg_class c ON c.oid=p.polrelid
WHERE c.relname IN (
  'clinical_document_templates','clinical_document_template_versions',
  'clinical_documents','clinical_document_events'
)
ORDER BY c.relname,p.polname;

CREATE TEMP TABLE d2_function_before AS
SELECT p.oid::regprocedure::text AS signature,
       pg_get_functiondef(p.oid) AS definition,
       coalesce(p.proacl::text,'') AS acl
FROM pg_proc p
WHERE p.oid IN (
  'public.current_user_can_issue_clinical_document(text)'::regprocedure,
  'public.assert_clinical_document_actor(uuid,text)'::regprocedure,
  'public.assert_clinical_document_payload_ready(text,jsonb)'::regprocedure,
  'public.assert_clinical_document_cancel_actor(uuid)'::regprocedure,
  'public.render_clinical_document_snapshot(text,text,jsonb,jsonb)'::regprocedure,
  'public.create_clinical_document_draft(uuid,uuid,jsonb)'::regprocedure,
  'public.save_clinical_document_draft(uuid,jsonb)'::regprocedure,
  'public.issue_clinical_document(uuid)'::regprocedure,
  'public.cancel_clinical_document(uuid,text)'::regprocedure
)
ORDER BY 1;

CREATE TEMP TABLE d2_seed_before AS
SELECT
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id)
   FROM public.clinical_document_templates t
   WHERE t.id::text LIKE '12000000-0000-4000-8000-00000000000%') AS templates,
  (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id)
   FROM public.clinical_document_template_versions v
   WHERE v.id::text LIKE '12100000-0000-4000-8000-00000000000%') AS versions,
  (SELECT count(*) FROM public.clinical_documents) AS document_count,
  (SELECT count(*) FROM public.clinical_document_events) AS event_count;

\i supabase-migrations/20260912_clinical_documents_foundation.sql
\i supabase-verifiers/VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql

DO $$
BEGIN
  IF EXISTS (
    (SELECT * FROM d2_policy_before
     EXCEPT ALL
     SELECT c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles::text,
            pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)
     FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
     WHERE c.relname IN ('clinical_document_templates','clinical_document_template_versions','clinical_documents','clinical_document_events'))
    UNION ALL
    (SELECT c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles::text,
            pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)
     FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
     WHERE c.relname IN ('clinical_document_templates','clinical_document_template_versions','clinical_documents','clinical_document_events')
     EXCEPT ALL SELECT * FROM d2_policy_before)
  ) THEN
    RAISE EXCEPTION 'clinical_documents_policy_snapshot_drift';
  END IF;

  IF EXISTS (
    (SELECT * FROM d2_function_before
     EXCEPT ALL
     SELECT p.oid::regprocedure::text,pg_get_functiondef(p.oid),coalesce(p.proacl::text,'')
     FROM pg_proc p
     WHERE p.oid IN (
       'public.current_user_can_issue_clinical_document(text)'::regprocedure,
       'public.assert_clinical_document_actor(uuid,text)'::regprocedure,
       'public.assert_clinical_document_payload_ready(text,jsonb)'::regprocedure,
       'public.assert_clinical_document_cancel_actor(uuid)'::regprocedure,
       'public.render_clinical_document_snapshot(text,text,jsonb,jsonb)'::regprocedure,
       'public.create_clinical_document_draft(uuid,uuid,jsonb)'::regprocedure,
       'public.save_clinical_document_draft(uuid,jsonb)'::regprocedure,
       'public.issue_clinical_document(uuid)'::regprocedure,
       'public.cancel_clinical_document(uuid,text)'::regprocedure))
    UNION ALL
    (SELECT p.oid::regprocedure::text,pg_get_functiondef(p.oid),coalesce(p.proacl::text,'')
     FROM pg_proc p
     WHERE p.oid IN (
       'public.current_user_can_issue_clinical_document(text)'::regprocedure,
       'public.assert_clinical_document_actor(uuid,text)'::regprocedure,
       'public.assert_clinical_document_payload_ready(text,jsonb)'::regprocedure,
       'public.assert_clinical_document_cancel_actor(uuid)'::regprocedure,
       'public.render_clinical_document_snapshot(text,text,jsonb,jsonb)'::regprocedure,
       'public.create_clinical_document_draft(uuid,uuid,jsonb)'::regprocedure,
       'public.save_clinical_document_draft(uuid,jsonb)'::regprocedure,
       'public.issue_clinical_document(uuid)'::regprocedure,
       'public.cancel_clinical_document(uuid,text)'::regprocedure)
     EXCEPT ALL SELECT * FROM d2_function_before)
  ) THEN
    RAISE EXCEPTION 'clinical_documents_function_snapshot_drift';
  END IF;

  IF EXISTS (
    SELECT 1 FROM d2_seed_before b
    WHERE b.templates IS DISTINCT FROM (
            SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id)
            FROM public.clinical_document_templates t
            WHERE t.id::text LIKE '12000000-0000-4000-8000-00000000000%')
       OR b.versions IS DISTINCT FROM (
            SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id)
            FROM public.clinical_document_template_versions v
            WHERE v.id::text LIKE '12100000-0000-4000-8000-00000000000%')
       OR b.document_count <> (SELECT count(*) FROM public.clinical_documents)
       OR b.event_count <> (SELECT count(*) FROM public.clinical_document_events)
  ) THEN
    RAISE EXCEPTION 'clinical_documents_replay_mutated_state';
  END IF;
END $$;

\i tests/sql/clinical_documents_foundation_cases.sql
SQL

echo 'CLINICAL DOCUMENTS FOUNDATION POSTGRESQL 16 PASS'
