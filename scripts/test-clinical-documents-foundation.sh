#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"; : "${PGPORT:=5432}"; : "${PGUSER:=postgres}"; : "${PGDATABASE:=clinical_documents_foundation_test}"
export PGHOST PGPORT PGUSER PGDATABASE
[[ "$PGDATABASE" = clinical_documents_foundation_test ]] || { echo 'refusing non-disposable database' >&2; exit 1; }
PSQL=(psql -v ON_ERROR_STOP=1 -X)

"${PSQL[@]}" -f tests/sql/clinical_documents_foundation_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_documents_foundation.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql
"${PSQL[@]}" -f tests/sql/clinical_documents_foundation_cases.sql

# Snapshot, replay, verifier and behavioral proof stay in the same psql session
# so the comparison is genuinely against the same disposable installation.
"${PSQL[@]}" <<'SQL'
CREATE TEMP TABLE d2_policy_before AS
SELECT c.relname, p.polname, p.polcmd, p.polroles::text, pg_get_expr(p.polqual,p.polrelid) AS qual, pg_get_expr(p.polwithcheck,p.polrelid) AS with_check
FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
WHERE c.relname IN ('clinical_document_templates','clinical_document_template_versions','clinical_documents','clinical_document_events');
CREATE TEMP TABLE d2_documents_before AS SELECT count(*) AS count FROM public.clinical_documents;
\i supabase-migrations/20260912_clinical_documents_foundation.sql
\i supabase-verifiers/VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql
DO $$ BEGIN
  IF (SELECT count(*) FROM public.clinical_document_templates WHERE id::text LIKE '12000000-0000-4000-8000-00000000000%') <> 4
     OR (SELECT count(*) FROM public.clinical_document_template_versions WHERE id::text LIKE '12100000-0000-4000-8000-00000000000%') <> 4 THEN
    RAISE EXCEPTION 'clinical_documents_seed_idempotency_failed';
  END IF;
  IF EXISTS (
    (SELECT * FROM d2_policy_before)
    EXCEPT
    (SELECT c.relname,p.polname,p.polcmd,p.polroles::text,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname IN ('clinical_document_templates','clinical_document_template_versions','clinical_documents','clinical_document_events'))
  ) THEN
    RAISE EXCEPTION 'clinical_documents_policy_snapshot_drift';
  END IF;
  IF (SELECT count(*) FROM public.clinical_documents) <> (SELECT count FROM d2_documents_before) THEN
    RAISE EXCEPTION 'clinical_documents_replay_mutated_documents';
  END IF;
END $$;
\i tests/sql/clinical_documents_foundation_cases.sql
SQL

echo 'CLINICAL DOCUMENTS FOUNDATION POSTGRESQL 16 PASS'
