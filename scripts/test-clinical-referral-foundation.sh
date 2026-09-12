#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_referral_foundation_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_referral_foundation_test" ]]; then
  echo "Refusing to run D2-E0 harness outside clinical_referral_foundation_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Reconstruct the effective Clinical Documents stack through D2-D2.
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

# Layer D2-E0 on top of the actual current stack.
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_referral_foundation.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_FOUNDATION.sql
"${PSQL[@]}" -f tests/sql/clinical_referral_foundation_cases.sql

# Referral must not regress the three existing visual document families.
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_PRESCRIPTION_RENDERER_V2.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_THERAPEUTIC_GUIDANCE_RENDERER_V1.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_EXAM_ORDER_RENDERER_V1.sql

# Replay only D2-E0. Seed rows and all Clinical Documents/events must remain
# byte-for-byte/count stable; migration replay may recreate identical functions
# and constraints but cannot mutate business state.
"${PSQL[@]}" <<'SQL'
CREATE TEMP TABLE d2e0_before AS
SELECT
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id)
   FROM public.clinical_document_templates t
   WHERE t.id='12000000-0000-4000-8000-000000000007'::uuid) AS template_row,
  (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.version)
   FROM public.clinical_document_template_versions v
   WHERE v.template_id='12000000-0000-4000-8000-000000000007'::uuid) AS version_rows,
  (SELECT count(*) FROM public.clinical_documents) AS document_count,
  (SELECT count(*) FROM public.clinical_document_events) AS event_count;

\i supabase-migrations/20260912_clinical_referral_foundation.sql
\i supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_FOUNDATION.sql

DO $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM d2e0_before;
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
     OR b.document_count <> (SELECT count(*) FROM public.clinical_documents)
     OR b.event_count <> (SELECT count(*) FROM public.clinical_document_events) THEN
    RAISE EXCEPTION 'clinical_referral_foundation_replay_mutated_state';
  END IF;
END $$;
SQL

echo 'CLINICAL REFERRAL FOUNDATION POSTGRESQL 16 PASS'
