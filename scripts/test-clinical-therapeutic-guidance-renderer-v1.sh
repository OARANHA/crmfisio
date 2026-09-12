#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_therapeutic_guidance_renderer_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_therapeutic_guidance_renderer_v1_test" ]]; then
  echo "Refusing to run D2-C.1 harness outside clinical_therapeutic_guidance_renderer_v1_test" >&2
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

# The additive guidance versions must not regress the prescription renderer contract.
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_PRESCRIPTION_RENDERER_V2.sql

echo 'CLINICAL THERAPEUTIC GUIDANCE RENDERER V1 POSTGRESQL 16 PASS'
