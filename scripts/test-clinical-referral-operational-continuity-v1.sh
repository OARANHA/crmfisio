#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:=localhost}"; : "${PGPORT:=5432}"; : "${PGUSER:=postgres}"; : "${PGDATABASE:=clinical_referral_operational_continuity_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE
if [[ "$PGDATABASE" != "clinical_referral_operational_continuity_v1_test" ]]; then echo "Refusing to run D2-E4 harness outside its isolated database" >&2; exit 1; fi
PSQL=(psql -v ON_ERROR_STOP=1 -X)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# D2-E4 is deliberately tested on the exact D2-E3 referral stack, not against
# an abbreviated parallel schema.
python3 scripts/build-nexus-c06-sql-test.py > "$tmp/bootstrap.sql"
"${PSQL[@]}" -f "$tmp/bootstrap.sql" >/dev/null
python3 scripts/build-clinical-care-read-test.py | "${PSQL[@]}" >/dev/null
for file in \
  supabase-migrations/20260912_clinical_care_relationship_read_reconciliation.sql \
  tests/sql/clinical_documents_foundation_fixture.sql \
  supabase-migrations/20260912_clinical_documents_foundation.sql \
  supabase-migrations/20260912_clinical_document_template_admin.sql \
  tests/sql/clinical_document_template_admin_fixture.sql \
  tests/sql/clinical_prescription_renderer_v2_fixture.sql \
  supabase-migrations/20260912_clinical_prescription_renderer_v2.sql \
  supabase-migrations/20260912_clinical_prescription_renderer_v2_hardening.sql \
  supabase-migrations/20260912_clinical_therapeutic_guidance_renderer_v1.sql \
  supabase-migrations/20260912_clinical_exam_order_foundation.sql \
  supabase-migrations/20260912_clinical_exam_order_renderer_v1.sql \
  supabase-migrations/20260912_clinical_referral_foundation.sql \
  supabase-migrations/20260912_clinical_referral_renderer_v1.sql \
  supabase-migrations/20260912_clinical_referral_internal_v1.sql \
  supabase-migrations/20260913_clinical_referral_internal_v1_hardening.sql \
  supabase-migrations/20260913_clinical_referral_operational_continuity_v1.sql \
  supabase-verifiers/VERIFY_20260913_CLINICAL_REFERRAL_OPERATIONAL_CONTINUITY_V1.sql \
  supabase-migrations/20260913_clinical_referral_target_professional_fix.sql \
  supabase-verifiers/VERIFY_20260913_CLINICAL_REFERRAL_TARGET_PROFESSIONAL_FIX.sql; do
  "${PSQL[@]}" -f "$file" >/dev/null
done

# Both the foundation and the corrective CREATE OR REPLACE must be replay-safe.
"${PSQL[@]}" -f supabase-migrations/20260913_clinical_referral_operational_continuity_v1.sql >/dev/null
"${PSQL[@]}" -f supabase-migrations/20260913_clinical_referral_target_professional_fix.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_CLINICAL_REFERRAL_OPERATIONAL_CONTINUITY_V1.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_CLINICAL_REFERRAL_TARGET_PROFESSIONAL_FIX.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_INTERNAL_V1.sql >/dev/null
echo 'CLINICAL REFERRAL OPERATIONAL CONTINUITY V1 POSTGRESQL 16 PASS'
