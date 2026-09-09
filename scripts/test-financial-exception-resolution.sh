#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=financial_exception_resolution_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "financial_exception_resolution_test" ]]; then
  echo "Refusing to run financial exception resolution harness outside financial_exception_resolution_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)

# Reconstruct the exact #388-compatible reduced stack from main.
"${PSQL[@]}" -f tests/sql/clinical_authorization_reconciliation_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260909_clinical_authorization_reconciliation.sql
"${PSQL[@]}" -c "ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notas text; ALTER TABLE public.appointments ALTER COLUMN id SET DEFAULT gen_random_uuid()"
"${PSQL[@]}" -f supabase-migrations/20260908_appointment_professional_id_compatibility.sql
"${PSQL[@]}" -f supabase-migrations/20260901_appointment_reschedule.sql
"${PSQL[@]}" -f supabase-migrations/20260905_appointment_cancellation_reason_guard.sql
"${PSQL[@]}" -f tests/sql/financial_clinical_finalization_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_boundary.sql
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_reschedule_atomicity.sql

# #388 is a historical slice with a deliberate "no resolution RPC yet" invariant.
# Validate it before #389 exists. Never relax or run this verifier after #389.
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260909_FINANCIAL_CLINICAL_FINALIZATION_BOUNDARY.sql

# #389 is additive. Apply it only after the complete #388 contract has passed.
"${PSQL[@]}" -f supabase-migrations/20260909_financial_exception_resolution.sql
"${PSQL[@]}" -f supabase-migrations/20260909_financial_exception_resolution.sql

# Seed already-detected exceptions without exercising the #388 detection path,
# then execute the resolution cases on the post-#389 schema.
"${PSQL[@]}" -f tests/sql/financial_exception_resolution_fixture.sql
"${PSQL[@]}" -f tests/sql/financial_exception_resolution_cases.sql
"${PSQL[@]}" -f tests/sql/financial_exception_resolution_waive_idempotency.sql

# 15) True concurrency: transaction 1 resolves and deliberately retains the
# exception row lock. Transaction 2 must wait, then return the same persisted
# CHARGE disposition rather than creating a second payment/disposition.
first_log="/tmp/financial_exception_resolution_first.log"
second_log="/tmp/financial_exception_resolution_second.log"
rm -f "$first_log" "$second_log"

"${PSQL[@]}" >"$first_log" 2>&1 <<'SQL' &
BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
SELECT * FROM public.resolve_appointment_financial_exception(
  '88000000-0000-0000-0000-000000000012','charge',NULL
);
SELECT pg_sleep(2);
COMMIT;
SQL
first_pid=$!
sleep 0.4

"${PSQL[@]}" >"$second_log" 2>&1 <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
SELECT * FROM public.resolve_appointment_financial_exception(
  '88000000-0000-0000-0000-000000000012','charge',NULL
);
SQL
wait "$first_pid"

"${PSQL[@]}" <<'SQL'
\echo '15) concurrent resolution produced one persisted decision'
DO $$
BEGIN
  IF (SELECT count(*) FROM public.appointment_financial_exception_dispositions
      WHERE exception_id='88000000-0000-0000-0000-000000000012') <> 1
     OR (SELECT count(*) FROM public.payments
         WHERE appointment_id='49000000-0000-0000-0000-000000000012' AND tipo='receber') <> 1
     OR (SELECT status FROM public.appointment_financial_exceptions
         WHERE id='88000000-0000-0000-0000-000000000012') <> 'resolved' THEN
    RAISE EXCEPTION 'concurrent_exception_resolution_not_serialized';
  END IF;
END $$;
SQL

# The #389 verifier reasserts every #388 invariant that remains valid after the
# resolution boundary is intentionally introduced.
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260909_FINANCIAL_EXCEPTION_RESOLUTION.sql

run_negative_control() {
  local name="$1"
  local mutation_file="$2"
  local negative_db="${PGDATABASE}_${name}"

  dropdb --maintenance-db=postgres --if-exists "$negative_db" >/dev/null 2>&1 || true
  createdb --maintenance-db=postgres --template="$PGDATABASE" "$negative_db"
  PGDATABASE="$negative_db" "${PSQL[@]}" -f "$mutation_file"

  set +e
  PGDATABASE="$negative_db" "${PSQL[@]}" \
    -f supabase-verifiers/VERIFY_20260909_FINANCIAL_EXCEPTION_RESOLUTION.sql \
    >"/tmp/${name}.log" 2>&1
  local status=$?
  set -e

  if [[ $status -eq 0 ]]; then
    cat "/tmp/${name}.log"
    echo "Negative control '$name' unexpectedly passed verifier" >&2
    exit 1
  fi

  echo "negative control '$name': verifier failed as expected"
  dropdb --maintenance-db=postgres --if-exists "$negative_db" >/dev/null
}

run_negative_control recep_authorized tests/sql/financial_exception_resolution_negative_recep.sql
run_negative_control financeiro_waive tests/sql/financial_exception_resolution_negative_financeiro_waive.sql
run_negative_control missing_materialization tests/sql/financial_exception_resolution_negative_missing_materialization.sql
run_negative_control disposition_mutable tests/sql/financial_exception_resolution_negative_mutability.sql
run_negative_control payment_duplication tests/sql/financial_exception_resolution_negative_payment_duplication.sql
run_negative_control cross_tenant tests/sql/financial_exception_resolution_negative_cross_tenant.sql
