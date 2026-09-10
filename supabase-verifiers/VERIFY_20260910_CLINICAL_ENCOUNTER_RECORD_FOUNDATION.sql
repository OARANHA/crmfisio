\echo 'VERIFY #394 — Encounter Clinical Record Foundation'

DO $$
DECLARE
  v_count integer;
  v_missing integer[];
BEGIN
  SELECT count(*) INTO v_count
  FROM public._clinical_encounter_394_results
  WHERE passed IS TRUE;

  SELECT array_agg(n ORDER BY n) INTO v_missing
  FROM generate_series(1, 34) AS n
  WHERE NOT EXISTS (
    SELECT 1 FROM public._clinical_encounter_394_results r
    WHERE r.assertion_no = n AND r.passed IS TRUE
  );

  IF v_count <> 34 OR v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'clinical_encounter_394_behavior_matrix_incomplete: count=%, missing=%', v_count, v_missing;
  END IF;
END $$;

DO $$
DECLARE
  v_actor_def text := lower(pg_get_functiondef('public.assert_clinical_encounter_actor(uuid)'::regprocedure));
  v_actor_executable text;
  v_finalize_def text := lower(pg_get_functiondef('public.finalize_clinical_encounter_record(uuid,integer)'::regprocedure));
  v_save_def text := lower(pg_get_functiondef('public.save_clinical_encounter_record(uuid,integer,text,text,text,text,text,text)'::regprocedure));
  v_evolution_lock_def text := lower(pg_get_functiondef('public.lock_linked_evolution_encounter()'::regprocedure));
  v_default text;
BEGIN
  v_actor_executable := regexp_replace(v_actor_def, '--[^' || chr(10) || ']*', '', 'g');

  IF position('current_user_has_valid_clinical_identity() is not true' IN v_actor_executable) = 0 THEN
    RAISE EXCEPTION 'clinical_encounter_identity_not_fail_closed';
  END IF;
  IF position('current_user_has_clinical_capability(''clinical.attend''::text) is not true' IN v_actor_executable) = 0
     AND position('current_user_has_clinical_capability(''clinical.attend'') is not true' IN v_actor_executable) = 0 THEN
    RAISE EXCEPTION 'clinical_encounter_attend_not_fail_closed';
  END IF;
  IF position('current_user_has_clinical_capability(''clinical.evolution.write''::text) is not true' IN v_actor_executable) = 0
     AND position('current_user_has_clinical_capability(''clinical.evolution.write'') is not true' IN v_actor_executable) = 0 THEN
    RAISE EXCEPTION 'clinical_encounter_evolution_write_not_fail_closed';
  END IF;

  IF position('professional_id' IN v_actor_executable) = 0 THEN
    RAISE EXCEPTION 'clinical_encounter_canonical_professional_id_missing';
  END IF;
  IF position('fisio_id' IN v_actor_executable) > 0 THEN
    RAISE EXCEPTION 'clinical_encounter_fisio_id_authorization_dependency_detected';
  END IF;

  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='physiotherapy_evolutions'
    AND column_name='created_at';

  IF v_default IS NULL OR lower(v_default) NOT LIKE '%now()%' THEN
    RAISE EXCEPTION 'physiotherapy_evolution_created_at_real_default_missing: %', v_default;
  END IF;
  IF position('interval ''12 hours''' IN v_finalize_def) > 0
     OR position('at time zone ''utc''' IN v_finalize_def) > 0
     OR position('session_id, texto, created_at' IN v_finalize_def) > 0 THEN
    RAISE EXCEPTION 'clinical_encounter_fabricated_evolution_timestamp_detected';
  END IF;

  IF position('clinical_encounter_advisory_lock(p_appointment_id)' IN v_save_def) = 0
     OR position('clinical_encounter_advisory_lock(p_appointment_id)' IN v_finalize_def) = 0
     OR position('clinical_encounter_advisory_lock(new.session_id)' IN v_evolution_lock_def) = 0 THEN
    RAISE EXCEPTION 'clinical_encounter_shared_advisory_lock_contract_missing';
  END IF;

  IF v_finalize_def ~ 'exception[[:space:]]+when' THEN
    RAISE EXCEPTION 'clinical_encounter_finalize_must_not_swallow_transaction_errors';
  END IF;
END $$;

DO $$
DECLARE
  v_trigger_count integer;
BEGIN
  SELECT count(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgrelid='public.physiotherapy_evolutions'::regclass
    AND NOT tgisinternal
    AND tgname='trg_00_lock_linked_evolution_encounter';
  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'clinical_encounter_evolution_lock_trigger_count_invalid: %', v_trigger_count;
  END IF;

  SELECT count(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgrelid='public.clinical_encounter_records'::regclass
    AND NOT tgisinternal
    AND tgname='trg_guard_clinical_encounter_record_integrity';
  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'clinical_encounter_integrity_trigger_count_invalid: %', v_trigger_count;
  END IF;
END $$;

DO $$
DECLARE
  v_unique_appointment boolean;
  v_unique_evolution boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.clinical_encounter_records'::regclass
      AND contype='u'
      AND conname='clinical_encounter_records_appointment_unique'
  ) INTO v_unique_appointment;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.clinical_encounter_records'::regclass
      AND contype='u'
      AND conname='clinical_encounter_records_evolution_unique'
  ) INTO v_unique_evolution;
  IF NOT v_unique_appointment OR NOT v_unique_evolution THEN
    RAISE EXCEPTION 'clinical_encounter_cardinality_constraints_missing';
  END IF;
END $$;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.clinical_encounter_records', 'SELECT') IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_encounter_authenticated_read_missing';
  END IF;
  IF has_table_privilege('authenticated', 'public.clinical_encounter_records', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_encounter_records', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinical_encounter_records', 'DELETE') THEN
    RAISE EXCEPTION 'clinical_encounter_browser_direct_write_grant_detected';
  END IF;
  IF has_table_privilege('anon', 'public.clinical_encounter_records', 'SELECT')
     OR has_table_privilege('anon', 'public.clinical_encounter_records', 'INSERT')
     OR has_table_privilege('anon', 'public.clinical_encounter_records', 'UPDATE')
     OR has_table_privilege('anon', 'public.clinical_encounter_records', 'DELETE') THEN
    RAISE EXCEPTION 'clinical_encounter_anon_privilege_detected';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'public.materialize_clinical_encounter_evolution(text,text,text,text,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'clinical_encounter_internal_materializer_execute_grant_leaked';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT e.session_id
    FROM public.physiotherapy_evolutions e
    WHERE e.deleted_at IS NULL
      AND e.session_id IN (
        '43000000-0000-0000-0000-000000000008'::uuid,
        '43000000-0000-0000-0000-000000000009'::uuid,
        '43000000-0000-0000-0000-000000000010'::uuid,
        '43000000-0000-0000-0000-000000000012'::uuid,
        '43000000-0000-0000-0000-000000000013'::uuid
      )
    GROUP BY e.session_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'clinical_encounter_duplicate_evolution_detected';
  END IF;

  IF (SELECT count(*) FROM public.physiotherapy_evolutions
      WHERE session_id='43000000-0000-0000-0000-000000000014' AND deleted_at IS NULL) <> 1
     OR EXISTS (SELECT 1 FROM public.clinical_encounter_records
                WHERE appointment_id='43000000-0000-0000-0000-000000000014') THEN
    RAISE EXCEPTION 'clinical_encounter_legacy_evolution_compatibility_broken';
  END IF;

  IF (SELECT status FROM public.appointments
      WHERE id='43000000-0000-0000-0000-000000000011') IS DISTINCT FROM 'finalizado'
     OR NOT EXISTS (
       SELECT 1 FROM public.appointment_financial_exceptions
       WHERE appointment_id='43000000-0000-0000-0000-000000000011'
         AND reason_code='package_exhausted'
     ) THEN
    RAISE EXCEPTION 'clinical_encounter_expected_financial_exception_contract_broken';
  END IF;

  IF (SELECT status FROM public.appointments
      WHERE id='43000000-0000-0000-0000-000000000010') IS DISTINCT FROM 'em_atendimento'
     OR (SELECT status FROM public.clinical_encounter_records
         WHERE appointment_id='43000000-0000-0000-0000-000000000010') IS DISTINCT FROM 'draft'
     OR EXISTS (
       SELECT 1 FROM public.physiotherapy_evolutions
       WHERE session_id='43000000-0000-0000-0000-000000000010' AND deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'clinical_encounter_unexpected_financial_rollback_contract_broken';
  END IF;
END $$;

\echo 'VERIFY #394 OK — 34 behavior cases + authorization/timestamp/ACL/concurrency structure'