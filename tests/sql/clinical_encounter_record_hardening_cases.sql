\echo 'Clinical Encounter Record #394 hardening cases 29-34'

\echo '29) authorization checks fail closed when identity/capability helpers return NULL'
RESET ROLE;
BEGIN;
CREATE OR REPLACE FUNCTION public.current_user_has_valid_clinical_identity()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT NULL::boolean $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record(
      '43000000-0000-0000-0000-000000000013', 0, 'fail closed', '', '', '', '', ''
    );
    RAISE EXCEPTION 'null_identity_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;
ROLLBACK;

BEGIN;
CREATE OR REPLACE FUNCTION public.current_user_has_clinical_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT NULL::boolean $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.save_clinical_encounter_record(
      '43000000-0000-0000-0000-000000000013', 0, 'fail closed', '', '', '', '', ''
    );
    RAISE EXCEPTION 'null_capability_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;
ROLLBACK;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public._clinical_encounter_394_pass(29, 'authorization helpers are fail-closed on NULL');

\echo '30) #394 authorization is canonical on appointments.professional_id, never fisio_id'
RESET ROLE;
DO $$
DECLARE
  v_definition text := lower(pg_get_functiondef('public.assert_clinical_encounter_actor(uuid)'::regprocedure));
BEGIN
  IF position('professional_id' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'canonical_professional_id_check_missing';
  END IF;
  IF position('fisio_id' IN v_definition) > 0 THEN
    RAISE EXCEPTION 'compatibility_fisio_id_became_authorization_authority';
  END IF;
  PERFORM public._clinical_encounter_394_pass(30, 'professional_id is the sole appointment identity authority');
END $$;

\echo '31) generated Evolution uses real transaction creation time; Appointment owns clinical session time'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.save_clinical_encounter_record(
  '43000000-0000-0000-0000-000000000012', 0,
  'Atendimento histórico', 'História', 'Achados', '', 'Conduta', ''
);
DO $$
DECLARE
  v_tx timestamptz := transaction_timestamp();
  v_result public.clinical_encounter_records%ROWTYPE;
  v_created timestamptz;
  v_session_date date;
  v_session_start time;
BEGIN
  SELECT * INTO v_result
  FROM public.finalize_clinical_encounter_record(
    '43000000-0000-0000-0000-000000000012', 1
  );

  SELECT e.created_at INTO v_created
  FROM public.physiotherapy_evolutions e
  WHERE e.id = v_result.evolution_id;

  SELECT a.data, a.inicio INTO v_session_date, v_session_start
  FROM public.appointments a
  WHERE a.id = '43000000-0000-0000-0000-000000000012';

  IF v_created IS DISTINCT FROM v_tx THEN
    RAISE EXCEPTION 'evolution_created_at_not_real_transaction_timestamp: expected %, got %', v_tx, v_created;
  END IF;
  IF v_session_date IS DISTINCT FROM current_date - 10 OR v_session_start IS DISTINCT FROM time '14:00' THEN
    RAISE EXCEPTION 'appointment_temporality_was_rewritten';
  END IF;
  IF v_created::date = v_session_date THEN
    RAISE EXCEPTION 'evolution_created_at_was_fabricated_from_appointment_date';
  END IF;

  PERFORM public._clinical_encounter_394_pass(31, 'real Evolution creation timestamp and appointment session temporality');
END $$;

\echo '32) unexpected financial integrity failure rolled back all three clinical writes'
RESET ROLE;
DO $$
BEGIN
  IF (SELECT status FROM public.appointments WHERE id='43000000-0000-0000-0000-000000000010') IS DISTINCT FROM 'em_atendimento' THEN
    RAISE EXCEPTION 'rollback_evidence_appointment_not_restored';
  END IF;
  IF (SELECT status FROM public.clinical_encounter_records WHERE appointment_id='43000000-0000-0000-0000-000000000010') IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'rollback_evidence_record_not_restored';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.physiotherapy_evolutions
    WHERE session_id='43000000-0000-0000-0000-000000000010' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'rollback_evidence_evolution_survived';
  END IF;
  PERFORM public._clinical_encounter_394_pass(32, 'unexpected financial failure rolled back Evolution Record Appointment');
END $$;

\echo '33) repeated successful finalize/double-click is idempotent'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_before uuid;
  v_after uuid;
  v_count integer;
BEGIN
  SELECT evolution_id INTO v_before
  FROM public.clinical_encounter_records
  WHERE appointment_id='43000000-0000-0000-0000-000000000009';

  SELECT evolution_id INTO v_after
  FROM public.finalize_clinical_encounter_record(
    '43000000-0000-0000-0000-000000000009', 1
  );

  SELECT count(*) INTO v_count
  FROM public.physiotherapy_evolutions
  WHERE session_id='43000000-0000-0000-0000-000000000009'
    AND deleted_at IS NULL;

  IF v_before IS NULL OR v_after IS DISTINCT FROM v_before OR v_count <> 1 THEN
    RAISE EXCEPTION 'successful_retry_not_idempotent';
  END IF;
  PERFORM public._clinical_encounter_394_pass(33, 'successful retry and double-click remain idempotent');
END $$;

\echo '34) finalized Encounter Record cannot be mutated by direct browser table access'
DO $$
DECLARE
  v_before text;
  v_after text;
BEGIN
  SELECT plan INTO v_before
  FROM public.clinical_encounter_records
  WHERE appointment_id='43000000-0000-0000-0000-000000000009';

  BEGIN
    UPDATE public.clinical_encounter_records
    SET plan='browser mutation must fail'
    WHERE appointment_id='43000000-0000-0000-0000-000000000009';
    RAISE EXCEPTION 'browser_finalized_record_mutation_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  SELECT plan INTO v_after
  FROM public.clinical_encounter_records
  WHERE appointment_id='43000000-0000-0000-0000-000000000009';

  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'browser_mutation_changed_finalized_record';
  END IF;
  PERFORM public._clinical_encounter_394_pass(34, 'finalized record direct browser mutation denied');
END $$;

RESET ROLE;
