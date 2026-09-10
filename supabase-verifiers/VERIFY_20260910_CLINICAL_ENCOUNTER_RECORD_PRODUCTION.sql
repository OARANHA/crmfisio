BEGIN;
SET TRANSACTION READ ONLY;

\echo 'VERIFY #394 PRODUCTION — read-only installed-schema inspection'

DO $$
BEGIN
  IF current_setting('transaction_read_only')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_encounter_production_verifier_not_read_only';
  END IF;

  IF current_setting('server_version_num')::integer < 160000 THEN
    RAISE EXCEPTION 'clinical_encounter_postgresql_16_required: %', current_setting('server_version');
  END IF;
END $$;

DO $$
DECLARE
  v_column text;
  v_expected_type text;
  v_actual_type text;
BEGIN
  IF to_regclass('public.clinical_encounter_records') IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_records_missing';
  END IF;

  FOR v_column, v_expected_type IN
    SELECT * FROM (VALUES
      ('clinic_id', 'uuid'),
      ('appointment_id', 'uuid'),
      ('patient_id', 'uuid'),
      ('professional_id', 'uuid'),
      ('reason', 'text'),
      ('history', 'text'),
      ('findings', 'text'),
      ('assessment', 'text'),
      ('plan', 'text'),
      ('additional_notes', 'text'),
      ('status', 'text'),
      ('revision', 'integer'),
      ('evolution_id', 'uuid'),
      ('created_at', 'timestamp with time zone'),
      ('updated_at', 'timestamp with time zone'),
      ('finalized_at', 'timestamp with time zone')
    ) AS expected(column_name, type_name)
  LOOP
    SELECT format_type(a.atttypid, a.atttypmod)
      INTO v_actual_type
    FROM pg_attribute a
    WHERE a.attrelid = 'public.clinical_encounter_records'::regclass
      AND a.attname = v_column
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF v_actual_type IS DISTINCT FROM v_expected_type THEN
      RAISE EXCEPTION 'clinical_encounter_column_contract_invalid: %. expected %, got %',
        v_column, v_expected_type, v_actual_type;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_definition text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public.clinical_encounter_records'::regclass
      AND c.contype = 'p'
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'id'
  ) THEN
    RAISE EXCEPTION 'clinical_encounter_primary_key_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public.clinical_encounter_records'::regclass
      AND c.contype = 'u'
      AND c.conname = 'clinical_encounter_records_appointment_unique'
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'appointment_id'
  ) THEN
    RAISE EXCEPTION 'clinical_encounter_appointment_unique_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public.clinical_encounter_records'::regclass
      AND c.contype = 'u'
      AND c.conname = 'clinical_encounter_records_evolution_unique'
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'evolution_id'
  ) THEN
    RAISE EXCEPTION 'clinical_encounter_evolution_unique_missing';
  END IF;

  SELECT lower(pg_get_constraintdef(c.oid, true))
    INTO v_definition
  FROM pg_constraint c
  WHERE c.conrelid = 'public.clinical_encounter_records'::regclass
    AND c.contype = 'c'
    AND lower(pg_get_constraintdef(c.oid, true)) LIKE '%status%'
    AND lower(pg_get_constraintdef(c.oid, true)) LIKE '%draft%'
    AND lower(pg_get_constraintdef(c.oid, true)) LIKE '%finalized%'
  ORDER BY c.conname
  LIMIT 1;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_status_check_missing';
  END IF;

  SELECT lower(pg_get_constraintdef(c.oid, true))
    INTO v_definition
  FROM pg_constraint c
  WHERE c.conrelid = 'public.clinical_encounter_records'::regclass
    AND c.contype = 'c'
    AND c.conname = 'clinical_encounter_records_finalization_shape';

  IF v_definition IS NULL
     OR position('status' IN v_definition) = 0
     OR position('draft' IN v_definition) = 0
     OR position('finalized' IN v_definition) = 0
     OR position('evolution_id' IN v_definition) = 0
     OR position('finalized_at' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'clinical_encounter_finalization_shape_invalid: %', v_definition;
  END IF;
END $$;

DO $$
DECLARE
  v_column text;
  v_target text;
BEGIN
  FOR v_column, v_target IN
    SELECT * FROM (VALUES
      ('clinic_id', 'public.clinics'),
      ('appointment_id', 'public.appointments'),
      ('patient_id', 'public.patients'),
      ('professional_id', 'public.profiles'),
      ('evolution_id', 'public.physiotherapy_evolutions')
    ) AS expected(column_name, target_relation)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = c.conkey[1]
      WHERE c.conrelid = 'public.clinical_encounter_records'::regclass
        AND c.contype = 'f'
        AND array_length(c.conkey, 1) = 1
        AND a.attname = v_column
        AND c.confrelid = to_regclass(v_target)
    ) THEN
      RAISE EXCEPTION 'clinical_encounter_foreign_key_invalid: % -> %', v_column, v_target;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_rls boolean;
  v_policy text;
  v_authenticated oid;
BEGIN
  SELECT c.relrowsecurity
    INTO v_rls
  FROM pg_class c
  WHERE c.oid = 'public.clinical_encounter_records'::regclass;

  IF v_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_encounter_rls_not_enabled';
  END IF;

  SELECT oid INTO v_authenticated FROM pg_roles WHERE rolname = 'authenticated';
  IF v_authenticated IS NULL THEN
    RAISE EXCEPTION 'authenticated_role_missing';
  END IF;

  SELECT lower(pg_get_expr(p.polqual, p.polrelid))
    INTO v_policy
  FROM pg_policy p
  WHERE p.polrelid = 'public.clinical_encounter_records'::regclass
    AND p.polname = 'clinical_encounter_records_select_clinical'
    AND p.polcmd = 'r'
    AND v_authenticated = ANY (p.polroles);

  IF v_policy IS NULL
     OR position('current_clinic_id()' IN v_policy) = 0
     OR position('can_access_patient_clinical_record(patient_id)' IN v_policy) = 0 THEN
    RAISE EXCEPTION 'clinical_encounter_select_policy_invalid: %', v_policy;
  END IF;
END $$;

DO $$
DECLARE
  v_privilege text;
BEGIN
  IF has_table_privilege('authenticated', 'public.clinical_encounter_records', 'SELECT') IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_encounter_authenticated_select_missing';
  END IF;

  FOREACH v_privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE']
  LOOP
    IF has_table_privilege('authenticated', 'public.clinical_encounter_records', v_privilege) THEN
      RAISE EXCEPTION 'clinical_encounter_authenticated_direct_write_leak: %', v_privilege;
    END IF;
  END LOOP;

  FOREACH v_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
  LOOP
    IF has_table_privilege('anon', 'public.clinical_encounter_records', v_privilege) THEN
      RAISE EXCEPTION 'clinical_encounter_anon_table_privilege_leak: %', v_privilege;
    END IF;
    IF has_table_privilege('service_role', 'public.clinical_encounter_records', v_privilege) IS NOT TRUE THEN
      RAISE EXCEPTION 'clinical_encounter_service_role_table_privilege_missing: %', v_privilege;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_signature text;
  v_internal_signatures text[] := ARRAY[
    'public.materialize_clinical_encounter_evolution(text,text,text,text,text,text)',
    'public.clinical_encounter_advisory_lock(uuid)',
    'public.lock_linked_evolution_encounter()',
    'public.guard_clinical_encounter_record_integrity()',
    'public.assert_clinical_encounter_actor(uuid)'
  ];
  v_public_signatures text[] := ARRAY[
    'public.save_clinical_encounter_record(uuid,integer,text,text,text,text,text,text)',
    'public.finalize_clinical_encounter_record(uuid,integer)'
  ];
BEGIN
  FOREACH v_signature IN ARRAY v_internal_signatures || v_public_signatures
  LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      RAISE EXCEPTION 'clinical_encounter_required_function_missing: %', v_signature;
    END IF;
    IF has_function_privilege('service_role', v_signature, 'EXECUTE') IS NOT TRUE THEN
      RAISE EXCEPTION 'clinical_encounter_service_role_execute_missing: %', v_signature;
    END IF;
    IF has_function_privilege('anon', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'clinical_encounter_anon_execute_leak: %', v_signature;
    END IF;
  END LOOP;

  FOREACH v_signature IN ARRAY v_public_signatures
  LOOP
    IF has_function_privilege('authenticated', v_signature, 'EXECUTE') IS NOT TRUE THEN
      RAISE EXCEPTION 'clinical_encounter_authenticated_rpc_execute_missing: %', v_signature;
    END IF;
  END LOOP;

  FOREACH v_signature IN ARRAY v_internal_signatures
  LOOP
    IF has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'clinical_encounter_internal_function_exposed_to_browser: %', v_signature;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_actor_definition text;
  v_actor_executable text;
BEGIN
  v_actor_definition := lower(pg_get_functiondef('public.assert_clinical_encounter_actor(uuid)'::regprocedure));
  v_actor_executable := regexp_replace(v_actor_definition, '--[^' || chr(10) || ']*', '', 'g');

  IF position('professional_id' IN v_actor_executable) = 0 THEN
    RAISE EXCEPTION 'clinical_encounter_canonical_professional_id_missing';
  END IF;
  IF position('fisio_id' IN v_actor_executable) > 0 THEN
    RAISE EXCEPTION 'clinical_encounter_fisio_id_authorization_dependency_detected';
  END IF;
  IF v_actor_executable !~ 'current_user_has_valid_clinical_identity\(\)[[:space:]]+is[[:space:]]+not[[:space:]]+true' THEN
    RAISE EXCEPTION 'clinical_encounter_identity_not_fail_closed';
  END IF;
  IF v_actor_executable !~ 'current_user_has_clinical_capability\(''clinical\.attend''(::text)?\)[[:space:]]+is[[:space:]]+not[[:space:]]+true' THEN
    RAISE EXCEPTION 'clinical_encounter_attend_not_fail_closed';
  END IF;
  IF v_actor_executable !~ 'current_user_has_clinical_capability\(''clinical\.evolution\.write''(::text)?\)[[:space:]]+is[[:space:]]+not[[:space:]]+true' THEN
    RAISE EXCEPTION 'clinical_encounter_evolution_write_not_fail_closed';
  END IF;
END $$;

DO $$
DECLARE
  v_finalize_definition text;
  v_finalize_executable text;
  v_materialize_position integer;
  v_evolution_position integer;
  v_record_position integer;
  v_appointment_position integer;
BEGIN
  v_finalize_definition := lower(pg_get_functiondef('public.finalize_clinical_encounter_record(uuid,integer)'::regprocedure));
  v_finalize_executable := regexp_replace(v_finalize_definition, '--[^' || chr(10) || ']*', '', 'g');
  v_finalize_executable := regexp_replace(v_finalize_executable, '[[:space:]]+', ' ', 'g');

  IF position('interval ''12 hours''' IN v_finalize_executable) > 0
     OR position('v_appointment.data' IN v_finalize_executable) > 0
     OR position('at time zone' IN v_finalize_executable) > 0
     OR position('timezone(' IN v_finalize_executable) > 0
     OR position('session_id, texto, created_at' IN v_finalize_executable) > 0 THEN
    RAISE EXCEPTION 'clinical_encounter_fabricated_evolution_timestamp_detected';
  END IF;

  IF v_finalize_executable ~ 'exception[[:space:]]+when' THEN
    RAISE EXCEPTION 'clinical_encounter_finalize_exception_handler_detected';
  END IF;

  v_materialize_position := position('materialize_clinical_encounter_evolution' IN v_finalize_executable);
  v_evolution_position := position('insert into public.physiotherapy_evolutions' IN v_finalize_executable);
  v_record_position := position('update public.clinical_encounter_records' IN v_finalize_executable);
  v_appointment_position := position('update public.appointments' IN v_finalize_executable);

  IF v_materialize_position = 0
     OR v_evolution_position = 0
     OR v_record_position = 0
     OR v_appointment_position = 0
     OR position('set status = ''finalizado''' IN v_finalize_executable) = 0 THEN
    RAISE EXCEPTION 'clinical_encounter_finalize_required_operations_missing';
  END IF;

  IF NOT (
    v_materialize_position < v_evolution_position
    AND v_evolution_position < v_record_position
    AND v_record_position < v_appointment_position
  ) THEN
    RAISE EXCEPTION 'clinical_encounter_finalize_operation_order_invalid: materialize=%, evolution=%, record=%, appointment=%',
      v_materialize_position, v_evolution_position, v_record_position, v_appointment_position;
  END IF;
END $$;

DO $$
DECLARE
  v_default text;
BEGIN
  SELECT lower(pg_get_expr(d.adbin, d.adrelid))
    INTO v_default
  FROM pg_attribute a
  JOIN pg_attrdef d
    ON d.adrelid = a.attrelid
   AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.physiotherapy_evolutions'::regclass
    AND a.attname = 'created_at'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_default IS NULL
     OR NOT (
       v_default = 'now()'
       OR v_default = 'current_timestamp'
       OR v_default = 'transaction_timestamp()'
     ) THEN
    RAISE EXCEPTION 'physiotherapy_evolution_created_at_real_default_missing: %', v_default;
  END IF;
END $$;

DO $$
DECLARE
  v_trigger_count integer;
  v_trigger_function text;
BEGIN
  SELECT count(*)
    INTO v_trigger_count
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.physiotherapy_evolutions'::regclass
    AND NOT t.tgisinternal
    AND t.tgname = 'trg_00_lock_linked_evolution_encounter';

  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'clinical_encounter_evolution_lock_trigger_count_invalid: %', v_trigger_count;
  END IF;

  SELECT p.proname
    INTO v_trigger_function
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE t.tgrelid = 'public.physiotherapy_evolutions'::regclass
    AND NOT t.tgisinternal
    AND t.tgname = 'trg_00_lock_linked_evolution_encounter'
    AND n.nspname = 'public';

  IF v_trigger_function IS DISTINCT FROM 'lock_linked_evolution_encounter' THEN
    RAISE EXCEPTION 'clinical_encounter_evolution_lock_trigger_function_invalid: %', v_trigger_function;
  END IF;

  SELECT count(*)
    INTO v_trigger_count
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.clinical_encounter_records'::regclass
    AND NOT t.tgisinternal
    AND t.tgname = 'trg_guard_clinical_encounter_record_integrity';

  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'clinical_encounter_integrity_trigger_count_invalid: %', v_trigger_count;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class i
    JOIN pg_index x ON x.indexrelid = i.oid
    WHERE i.oid = to_regclass('public.clinical_encounter_records_patient_history_idx')
      AND x.indrelid = 'public.clinical_encounter_records'::regclass
      AND x.indisvalid
      AND x.indisready
  ) THEN
    RAISE EXCEPTION 'clinical_encounter_patient_history_index_missing_or_invalid';
  END IF;

  IF to_regclass('public._clinical_encounter_394_results') IS NOT NULL THEN
    RAISE EXCEPTION 'clinical_encounter_test_object_detected_in_production_schema';
  END IF;
END $$;

\echo 'VERIFY #394 PRODUCTION OK — read-only schema/contracts/ACL inspection'
ROLLBACK;
