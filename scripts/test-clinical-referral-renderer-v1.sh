#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_referral_renderer_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_referral_renderer_v1_test" ]]; then
  echo "Refusing to run D2-E2 harness outside clinical_referral_renderer_v1_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

python3 scripts/build-nexus-c06-sql-test.py > "$tmp/bootstrap.sql"
"${PSQL[@]}" -f "$tmp/bootstrap.sql" >/dev/null
python3 scripts/build-clinical-care-read-test.py | "${PSQL[@]}" >/dev/null
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_care_relationship_read_reconciliation.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_CARE_RELATIONSHIP_READ_RECONCILIATION.sql

"${PSQL[@]}" -f tests/sql/clinical_documents_foundation_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_documents_foundation.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_DOCUMENTS_FOUNDATION.sql

"${PSQL[@]}" -f supabase-migrations/20260912_clinical_document_template_admin.sql
"${PSQL[@]}" -f tests/sql/clinical_document_template_admin_fixture.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_DOCUMENT_TEMPLATE_ADMIN.sql

"${PSQL[@]}" -f tests/sql/clinical_prescription_renderer_v2_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_prescription_renderer_v2.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_prescription_renderer_v2_hardening.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_PRESCRIPTION_RENDERER_V2.sql

"${PSQL[@]}" -f supabase-migrations/20260912_clinical_therapeutic_guidance_renderer_v1.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.sql

"${PSQL[@]}" -f supabase-migrations/20260912_clinical_exam_order_foundation.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_EXAM_ORDER_FOUNDATION.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_exam_order_renderer_v1.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_EXAM_ORDER_RENDERER_V1.sql

"${PSQL[@]}" -f supabase-migrations/20260912_clinical_referral_foundation.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_FOUNDATION.sql

"${PSQL[@]}" -f supabase-migrations/20260912_clinical_referral_renderer_v1.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_RENDERER_V1.sql

# Previous visual contracts remain green after referral renderer publication.
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_PRESCRIPTION_RENDERER_V2.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_EXAM_ORDER_RENDERER_V1.sql

# Replay D2-E2 and prove no business/template timestamp churn after first promotion.
"${PSQL[@]}" <<'SQL'
CREATE TEMP TABLE d2e2_before AS
SELECT
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id)
   FROM public.clinical_document_templates t
   WHERE t.id='12000000-0000-4000-8000-000000000007'::uuid) AS template_row,
  (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.version)
   FROM public.clinical_document_template_versions v
   WHERE v.template_id='12000000-0000-4000-8000-000000000007'::uuid) AS version_rows,
  (SELECT count(*) FROM public.clinical_documents WHERE document_type='referral') AS referral_documents,
  (SELECT count(*) FROM public.clinical_document_events e JOIN public.clinical_documents d ON d.id=e.document_id WHERE d.document_type='referral') AS referral_events;

\i supabase-migrations/20260912_clinical_referral_renderer_v1.sql
\i supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_RENDERER_V1.sql

DO $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM d2e2_before;
  IF b.template_row IS DISTINCT FROM (
       SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id)
       FROM public.clinical_document_templates t
       WHERE t.id='12000000-0000-4000-8000-000000000007'::uuid
     )
     OR b.version_rows IS DISTINCT FROM (
       SELECT jsonb_agg(to_jsonb(v) ORDER BY v.version)
       FROM public.clinical_document_template_versions v
       WHERE v.template_id='12000000-0000-4000-8000-000000000007'::uuid
     )
     OR b.referral_documents <> (SELECT count(*) FROM public.clinical_documents WHERE document_type='referral')
     OR b.referral_events <> (SELECT count(*) FROM public.clinical_document_events e JOIN public.clinical_documents d ON d.id=e.document_id WHERE d.document_type='referral') THEN
    RAISE EXCEPTION 'clinical_referral_renderer_v1_replay_mutated_state';
  END IF;
END $$;
SQL

echo 'CLINICAL REFERRAL RENDERER V1 POSTGRESQL 16 PASS'
