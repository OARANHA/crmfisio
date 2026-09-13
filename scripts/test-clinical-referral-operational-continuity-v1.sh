#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:=localhost}"; : "${PGPORT:=5432}"; : "${PGUSER:=postgres}"; : "${PGDATABASE:=clinical_referral_operational_continuity_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE
if [[ "$PGDATABASE" != "clinical_referral_operational_continuity_v1_test" ]]; then
  echo "Refusing to run D2-E4 harness outside its isolated database" >&2
  exit 1
fi
PSQL=(psql -v ON_ERROR_STOP=1 -X)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# Reconstruct the existing D2 clinical/referral stack, then explicitly layer the
# effective appointment authorization migration that exists in production.
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
  tests/sql/d2e4_effective_appointment_authorization_prerequisite.sql \
  supabase-migrations/20260909_clinical_authorization_reconciliation.sql \
  supabase-migrations/20260913_clinical_referral_operational_continuity_v1.sql \
  supabase-verifiers/VERIFY_20260913_CLINICAL_REFERRAL_OPERATIONAL_CONTINUITY_V1.sql \
  supabase-migrations/20260913_clinical_referral_target_professional_fix.sql \
  supabase-verifiers/VERIFY_20260913_CLINICAL_REFERRAL_TARGET_PROFESSIONAL_FIX.sql \
  tests/sql/d2e4_fixed_target_appointment_boundary_fixture.sql; do
  "${PSQL[@]}" -f "$file" >/dev/null
done

# Materialize the exact production failure against #452 + the effective
# guard_appointment_mutation_boundary(). This command MUST fail before the hotfix
# with the same error observed in the real smoke test.
set +e
before_output=$("${PSQL[@]}" -f tests/sql/d2e4_fixed_target_appointment_boundary_before.sql 2>&1)
before_rc=$?
set -e
if [[ $before_rc -eq 0 ]]; then
  echo "D2-E4 pre-fix negative control unexpectedly passed" >&2
  echo "$before_output" >&2
  exit 1
fi
if ! grep -q "appointment_professional_self_assignment_required" <<<"$before_output"; then
  echo "D2-E4 pre-fix failed for the wrong reason" >&2
  echo "$before_output" >&2
  exit 1
fi
echo 'D2-E4 PRE-FIX EFFECTIVE-STACK REPRODUCTION PASS'

"${PSQL[@]}" -f supabase-migrations/20260913_d2e4_fixed_target_appointment_transaction_proof.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_D2E4_FIXED_TARGET_APPOINTMENT_TRANSACTION_PROOF.sql >/dev/null
"${PSQL[@]}" -f tests/sql/d2e4_fixed_target_appointment_boundary_cases.sql >/dev/null

# The hotfix itself must be replay-safe and must leave both the new contract and
# all previous D2-E4/D2-E3 structural contracts green.
"${PSQL[@]}" -f supabase-migrations/20260913_d2e4_fixed_target_appointment_transaction_proof.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_D2E4_FIXED_TARGET_APPOINTMENT_TRANSACTION_PROOF.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_CLINICAL_REFERRAL_OPERATIONAL_CONTINUITY_V1.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260913_CLINICAL_REFERRAL_TARGET_PROFESSIONAL_FIX.sql >/dev/null
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_INTERNAL_V1.sql >/dev/null

echo 'CLINICAL REFERRAL OPERATIONAL CONTINUITY V1 POSTGRESQL 16 PASS'
