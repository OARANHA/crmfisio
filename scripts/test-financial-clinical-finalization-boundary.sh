#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=financial_clinical_finalization_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "financial_clinical_finalization_test" ]]; then
  echo "Refusing to run financial/clinical harness outside financial_clinical_finalization_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)

# Reuse the exact clinical authorization fixture and migration from #387 so the
# financial slice remains behind the already-approved clinical guards.
"${PSQL[@]}" -f tests/sql/clinical_authorization_reconciliation_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260909_clinical_authorization_reconciliation.sql

# Reconstruct the effective main reschedule stack at the requested base SHA.
# The reduced #387 fixture lacks only schema defaults/columns used by the real RPC.
"${PSQL[@]}" -c "ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notas text; ALTER TABLE public.appointments ALTER COLUMN id SET DEFAULT gen_random_uuid()"
"${PSQL[@]}" -f supabase-migrations/20260908_appointment_professional_id_compatibility.sql
"${PSQL[@]}" -f supabase-migrations/20260901_appointment_reschedule.sql
"${PSQL[@]}" -f supabase-migrations/20260905_appointment_cancellation_reason_guard.sql

"${PSQL[@]}" -f tests/sql/financial_clinical_finalization_fixture.sql

# Prove the new capacity guard + the effective insert-first reschedule RPC from
# main reproduces the fully-reserved 1/1 failure before the correction is loaded.
"${PSQL[@]}" -f tests/sql/financial_clinical_reschedule_precondition.sql

# Preserve the original production regression proof: A consumes 1/1 and the old
# package sync rolls a clinically valid B finalization back.
"${PSQL[@]}" -f tests/sql/financial_clinical_finalization_precondition.sql

# Original boundary migration is replayed twice to prove safe reapplication.
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_boundary.sql
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_boundary.sql
"${PSQL[@]}" -f tests/sql/financial_clinical_finalization_cases.sql

# The follow-up migration keeps the capacity guard strict, atomically transfers
# a reservation through the canonical reschedule RPC, and removes generic queue
# UPDATE permission until a real financial disposition contract is approved.
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_reschedule_atomicity.sql
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_reschedule_atomicity.sql

# Use the actual main agenda-conflict trigger for the rollback regression: the
# replacement INSERT must fail while the prior source cancellation rolls back.
"${PSQL[@]}" -f supabase-migrations/20260901_appointment_conflicts.sql
"${PSQL[@]}" -f tests/sql/financial_clinical_reschedule_cases.sql

# True concurrent reservation test. Transaction 1 holds the package row lock;
# transaction 2 must wait, then observe the committed reservation and fail.
first_log="/tmp/financial_clinical_reservation_first.log"
second_log="/tmp/financial_clinical_reservation_second.log"
rm -f "$first_log" "$second_log"

"${PSQL[@]}" >"$first_log" 2>&1 <<'SQL' &
BEGIN;
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
  status, tipo, valor, pacote_id
) VALUES (
  '44000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  current_date, '20:00', '20:30', 'agendado', 'Concorrente A', 10000,
  '61000000-0000-0000-0000-000000000004'
);
SELECT pg_sleep(2);
COMMIT;
SQL
first_pid=$!
sleep 0.4

set +e
"${PSQL[@]}" >"$second_log" 2>&1 <<'SQL'
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
  status, tipo, valor, pacote_id
) VALUES (
  '44000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  current_date, '20:30', '21:00', 'agendado', 'Concorrente B', 10000,
  '61000000-0000-0000-0000-000000000004'
);
SQL
second_status=$?
set -e
wait "$first_pid"

if [[ $second_status -eq 0 ]]; then
  cat "$first_log" "$second_log"
  echo "Concurrent package reservation unexpectedly overbooked the package" >&2
  exit 1
fi
if ! grep -q "Pacote sem cobertura disponível para reservar este atendimento" "$second_log"; then
  cat "$second_log"
  echo "Concurrent reservation failed for an unexpected reason" >&2
  exit 1
fi

"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM public.appointments
      WHERE pacote_id = '61000000-0000-0000-0000-000000000004'
        AND status IN ('agendado','confirmado','em_atendimento')) <> 1 THEN
    RAISE EXCEPTION 'concurrency_reservation_count_invalid';
  END IF;
  IF (SELECT sessoes_usadas FROM public.patient_packages
      WHERE id = '61000000-0000-0000-0000-000000000004') <> 0 THEN
    RAISE EXCEPTION 'reservation_invented_package_consumption';
  END IF;
END $$;
SQL

"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260909_FINANCIAL_CLINICAL_FINALIZATION_BOUNDARY.sql

run_negative_control() {
  local name="$1"
  local mutation_file="$2"
  local negative_db="${PGDATABASE}_${name}"

  dropdb --maintenance-db=postgres --if-exists "$negative_db" >/dev/null 2>&1 || true
  createdb --maintenance-db=postgres --template="$PGDATABASE" "$negative_db"

  PGDATABASE="$negative_db" "${PSQL[@]}" -f "$mutation_file"

  set +e
  PGDATABASE="$negative_db" "${PSQL[@]}" \
    -f supabase-verifiers/VERIFY_20260909_FINANCIAL_CLINICAL_FINALIZATION_BOUNDARY.sql \
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

run_negative_control package_blocker tests/sql/financial_clinical_finalization_negative_raise.sql
run_negative_control overconsumption tests/sql/financial_clinical_finalization_negative_overconsumption.sql
