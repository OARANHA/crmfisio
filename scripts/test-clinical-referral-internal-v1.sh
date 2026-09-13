#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:=localhost}"; : "${PGPORT:=5432}"; : "${PGUSER:=postgres}"; : "${PGDATABASE:=clinical_referral_internal_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE
if [[ "$PGDATABASE" != "clinical_referral_internal_v1_test" ]]; then echo "Refusing to run D2-E3 harness outside clinical_referral_internal_v1_test" >&2; exit 1; fi
PSQL=(psql -v ON_ERROR_STOP=1 -X)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

python3 scripts/build-nexus-c06-sql-test.py > "$tmp/bootstrap.sql"
"${PSQL[@]}" -f "$tmp/bootstrap.sql" >/dev/null
python3 scripts/build-clinical-care-read-test.py | "${PSQL[@]}" >/dev/null
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_care_relationship_read_reconciliation.sql >/dev/null
"${PSQL[@]}" -f tests/sql/clinical_documents_foundation_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_documents_foundation.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_document_template_admin.sql
"${PSQL[@]}" -f tests/sql/clinical_document_template_admin_fixture.sql
"${PSQL[@]}" -f tests/sql/clinical_prescription_renderer_v2_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_prescription_renderer_v2.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_prescription_renderer_v2_hardening.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_therapeutic_guidance_renderer_v1.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_exam_order_foundation.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_exam_order_renderer_v1.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_referral_foundation.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_referral_renderer_v1.sql

# Production diagnosis found a legacy reception profile with a non-clinical
# professional_type. Keep it in the isolated fixture to prove routing uses the
# canonical clinical profession catalog rather than any nonblank string.
"${PSQL[@]}" -c "UPDATE public.profiles SET professional_type='recepcionista' WHERE id='d2100000-0000-4000-8000-000000000011'::uuid"

"${PSQL[@]}" -f supabase-migrations/20260912_clinical_referral_internal_v1.sql
"${PSQL[@]}" -f supabase-migrations/20260913_clinical_referral_internal_v1_hardening.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_INTERNAL_V1.sql

# Replay the complete D2-E3 stack: historical base may be replayed by a fresh
# environment, and the additive hardening must deterministically restore the
# canonical boundary without duplicate triggers or business-row mutation.
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_referral_internal_v1.sql
"${PSQL[@]}" -f supabase-migrations/20260913_clinical_referral_internal_v1_hardening.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_INTERNAL_V1.sql

# Adjacent canonical boundaries remain green.
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_FOUNDATION.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_RENDERER_V1.sql

# Exercise the production path too. Production does not contain the disposable
# D2-A fixture. Making its synthetic issuer ineligible forces the verifier to
# skip fixture-only positive/mutation probes while still proving the directory
# fails closed and structural fingerprints/grants remain correct.
"${PSQL[@]}" -c "UPDATE public.profiles SET ativo=false WHERE id='d2100000-0000-4000-8000-000000000001'::uuid"
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_INTERNAL_V1.sql

echo 'CLINICAL REFERRAL INTERNAL V1 POSTGRESQL 16 PASS'
