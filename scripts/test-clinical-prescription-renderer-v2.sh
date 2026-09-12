#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_prescription_renderer_v2_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_prescription_renderer_v2_test" ]]; then
  echo "Refusing to run D2-B.2C harness outside clinical_prescription_renderer_v2_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Reconstruct the canonical authorization stack before layering D2-A/B.2A/B.2C.
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

# The canonical production schema already has these clinic/patient identity fields;
# the minimal isolated test schema receives them only for this renderer slice.
"${PSQL[@]}" -f tests/sql/clinical_prescription_renderer_v2_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260912_clinical_prescription_renderer_v2.sql
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260912_CLINICAL_PRESCRIPTION_RENDERER_V2.sql
"${PSQL[@]}" -f tests/sql/clinical_prescription_renderer_v2_cases.sql

# Re-run the previous admin behavior matrix after the additive renderer migration.
"${PSQL[@]}" -f tests/sql/clinical_document_template_admin_cases.sql


echo 'CLINICAL PRESCRIPTION RENDERER V2 POSTGRESQL 16 PASS'