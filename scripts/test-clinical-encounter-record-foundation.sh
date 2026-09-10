#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_encounter_record_foundation_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_encounter_record_foundation_test" ]]; then
  echo "Refusing to run #394 harness outside clinical_encounter_record_foundation_test" >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X)

# Reconstruct the canonical authorization and financial-finalization stack used
# by #387/#388/#389 before installing #394.
"${PSQL[@]}" -f tests/sql/clinical_authorization_reconciliation_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260909_clinical_authorization_reconciliation.sql
"${PSQL[@]}" -c "ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notas text; ALTER TABLE public.appointments ALTER COLUMN id SET DEFAULT gen_random_uuid()"
"${PSQL[@]}" -f supabase-migrations/20260908_appointment_professional_id_compatibility.sql
"${PSQL[@]}" -f supabase-migrations/20260901_appointment_reschedule.sql
"${PSQL[@]}" -f supabase-migrations/20260905_appointment_cancellation_reason_guard.sql
"${PSQL[@]}" -f tests/sql/financial_clinical_finalization_fixture.sql
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_boundary.sql
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_boundary.sql
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_reschedule_atomicity.sql
"${PSQL[@]}" -f supabase-migrations/20260909_financial_clinical_finalization_reschedule_atomicity.sql
"${PSQL[@]}" -f supabase-migrations/20260901_appointment_conflicts.sql

# #394 fixture restores production-shape fields omitted by reduced fixtures and
# supplies isolated appointments for the 34 behavior cases.
"${PSQL[@]}" -f tests/sql/clinical_encounter_record_fixture.sql

# Replay twice: table/index IF NOT EXISTS + policy/trigger rebuild + CREATE OR
# REPLACE functions must remain installation-safe and must not duplicate triggers.
"${PSQL[@]}" -f supabase-migrations/20260910_clinical_encounter_record_foundation.sql
"${PSQL[@]}" -f supabase-migrations/20260910_clinical_encounter_record_foundation.sql

"${PSQL[@]}" -f tests/sql/clinical_encounter_record_cases.sql
"${PSQL[@]}" -f tests/sql/clinical_encounter_record_hardening_cases.sql

# True concurrency regression: a legacy Evolution INSERT holds the same advisory
# lock as #394 finalization. The finalizer must wait, observe the committed
# external Evolution, fail with an explicit conflict, and leave the draft and
# appointment unchanged. Removing the test-only external row then permits a safe
# retry, proving there is no deadlock and no duplicate active Evolution.
"${PSQL[@]}" <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.save_clinical_encounter_record(
  '43000000-0000-0000-0000-000000000013', 0,
  'Concorrência real', '', 'Achado concorrente', '', 'Conduta', ''
);
RESET ROLE;
SQL

legacy_log="/tmp/clinical_encounter_394_legacy_insert.log"
finalize_log="/tmp/clinical_encounter_394_concurrent_finalize.log"
rm -f "$legacy_log" "$finalize_log"

"${PSQL[@]}" >"$legacy_log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL statement_timeout = '10s';
INSERT INTO public.physiotherapy_evolutions(
  id, clinic_id, patient_id, professional_id, session_id, texto
) VALUES (
  '53000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '43000000-0000-0000-0000-000000000013',
  'Evolution externa concorrente'
);
SELECT pg_sleep(2);
COMMIT;
SQL
legacy_pid=$!
sleep 0.35

set +e
"${PSQL[@]}" >"$finalize_log" 2>&1 <<'SQL'
SET statement_timeout = '10s';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.finalize_clinical_encounter_record(
  '43000000-0000-0000-0000-000000000013', 1
);
SQL
finalize_status=$?
set -e
wait "$legacy_pid"

if [[ $finalize_status -eq 0 ]]; then
  cat "$legacy_log" "$finalize_log"
  echo "Concurrent finalization unexpectedly ignored the legacy Evolution" >&2
  exit 1
fi
if ! grep -q "clinical_encounter_evolution_conflict" "$finalize_log"; then
  cat "$finalize_log"
  echo "Concurrent finalization failed for an unexpected reason" >&2
  exit 1
fi

"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF (SELECT status FROM public.appointments
      WHERE id='43000000-0000-0000-0000-000000000013') IS DISTINCT FROM 'em_atendimento' THEN
    RAISE EXCEPTION 'concurrent_conflict_changed_appointment';
  END IF;
  IF (SELECT status FROM public.clinical_encounter_records
      WHERE appointment_id='43000000-0000-0000-0000-000000000013') IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'concurrent_conflict_changed_record';
  END IF;
  IF (SELECT count(*) FROM public.physiotherapy_evolutions
      WHERE session_id='43000000-0000-0000-0000-000000000013' AND deleted_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'concurrent_conflict_created_duplicate_evolution';
  END IF;
END $$;

DELETE FROM public.physiotherapy_evolutions
WHERE id='53000000-0000-0000-0000-000000000013';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.finalize_clinical_encounter_record(
  '43000000-0000-0000-0000-000000000013', 1
);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM public.appointments
      WHERE id='43000000-0000-0000-0000-000000000013') IS DISTINCT FROM 'finalizado' THEN
    RAISE EXCEPTION 'concurrency_retry_did_not_finalize_appointment';
  END IF;
  IF (SELECT status FROM public.clinical_encounter_records
      WHERE appointment_id='43000000-0000-0000-0000-000000000013') IS DISTINCT FROM 'finalized' THEN
    RAISE EXCEPTION 'concurrency_retry_did_not_finalize_record';
  END IF;
  IF (SELECT count(*) FROM public.physiotherapy_evolutions
      WHERE session_id='43000000-0000-0000-0000-000000000013' AND deleted_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'concurrency_retry_evolution_count_invalid';
  END IF;
END $$;
SQL

echo "concurrency: shared appointment advisory lock serialized legacy insert and #394 finalization"

"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260910_CLINICAL_ENCOUNTER_RECORD_FOUNDATION.sql
