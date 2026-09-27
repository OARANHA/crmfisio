\set ON_ERROR_STOP on

SELECT '1) MED-CRM-002 functions exist' AS check;
DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    to_regprocedure('public.crm_current_mutator_clinic_id()'),
    to_regprocedure('public.create_current_clinic_crm_contact(uuid,text,text,text)'),
    to_regprocedure('public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)'),
    to_regprocedure('public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)')
  ]
  LOOP
    IF v_fn IS NULL THEN
      RAISE EXCEPTION 'commercial_crm_command_function_missing';
    END IF;
  END LOOP;
END $$;

SELECT '2) helper is internal and commands are authenticated-only' AS check;
DO $$
DECLARE
  v_helper regprocedure := 'public.crm_current_mutator_clinic_id()'::regprocedure;
  v_fn regprocedure;
BEGIN
  IF has_function_privilege('anon', v_helper, 'EXECUTE')
     OR has_function_privilege('authenticated', v_helper, 'EXECUTE') THEN
    RAISE EXCEPTION 'crm_mutator_guard_exposed';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.create_current_clinic_crm_contact(uuid,text,text,text)'::regprocedure,
    'public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)'::regprocedure,
    'public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'crm_command_acl_invalid:%', v_fn;
    END IF;
  END LOOP;
END $$;

SELECT '3) all functions are SECURITY DEFINER with pinned search_path' AS check;
DO $$
DECLARE
  v_oid oid;
BEGIN
  FOR v_oid IN
    SELECT p.oid
    FROM pg_proc p
    WHERE p.oid IN (
      'public.crm_current_mutator_clinic_id()'::regprocedure::oid,
      'public.create_current_clinic_crm_contact(uuid,text,text,text)'::regprocedure::oid,
      'public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)'::regprocedure::oid,
      'public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)'::regprocedure::oid
    )
  LOOP
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_oid) THEN
      RAISE EXCEPTION 'crm_command_not_security_definer:%', v_oid::regprocedure;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p, unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
      WHERE p.oid = v_oid
        AND cfg LIKE 'search_path=%public%pg_temp%'
    ) THEN
      RAISE EXCEPTION 'crm_command_search_path_not_pinned:%', v_oid::regprocedure;
    END IF;
  END LOOP;
END $$;

SELECT '4) mutator guard composes canonical tenant/role/entitlement authority' AS check;
DO $$
DECLARE
  v_def text := pg_get_functiondef('public.crm_current_mutator_clinic_id()'::regprocedure);
BEGIN
  IF v_def NOT LIKE '%current_active_profile%'
     OR v_def NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_def NOT LIKE '%crm.access%'
     OR v_def NOT LIKE '%owner%'
     OR v_def NOT LIKE '%admin%'
     OR v_def NOT LIKE '%recep%' THEN
    RAISE EXCEPTION 'crm_mutator_guard_contract_invalid';
  END IF;

  IF v_def LIKE '%professional%'
     OR v_def LIKE '%financeiro%' THEN
    RAISE EXCEPTION 'crm_mutator_guard_write_role_leak';
  END IF;
END $$;

SELECT '5) Contact command cannot link Patient or choose clinic' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef('public.create_current_clinic_crm_contact(uuid,text,text,text)'::regprocedure));
BEGIN
  IF v_def LIKE '%p_patient_id%'
     OR v_def LIKE '%p_clinic%'
     OR v_def LIKE '%insert into public.patients%'
     OR v_def NOT LIKE '%crm_current_mutator_clinic_id%'
     OR v_def NOT LIKE '%anonymized_at is not null%' THEN
    RAISE EXCEPTION 'crm_contact_command_boundary_invalid';
  END IF;
END $$;

SELECT '6) Lead create is open-stage only and emits activity/audit' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef('public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)'::regprocedure));
BEGIN
  IF v_def NOT LIKE '%stage_kind = ''open''%'
     OR v_def NOT LIKE '%c.anonymized_at is null%'
     OR v_def NOT LIKE '%crm_lead_initial_stage_must_be_open%'
     OR v_def NOT LIKE '%crm_lead_activities%'
     OR v_def NOT LIKE '%lead_created%'
     OR v_def NOT LIKE '%audit_log%'
     OR v_def NOT LIKE '%crm_lead_created%' THEN
    RAISE EXCEPTION 'crm_lead_create_contract_invalid';
  END IF;

  IF v_def LIKE '%insert into public.patients%'
     OR v_def LIKE '%update public.patients%'
     OR v_def LIKE '%patient_journey%' THEN
    RAISE EXCEPTION 'crm_lead_create_patient_boundary_leak';
  END IF;
END $$;

SELECT '7) Stage transition locks lead, stays same pipeline and emits activity/audit' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef('public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)'::regprocedure));
BEGIN
  IF v_def NOT LIKE '%for update%'
     OR v_def NOT LIKE '%s.pipeline_id = v_lead.pipeline_id%'
     OR v_def NOT LIKE '%stage_changed%'
     OR v_def NOT LIKE '%crm_lead_activities%'
     OR v_def NOT LIKE '%audit_log%'
     OR v_def NOT LIKE '%crm_lead_stage_changed%' THEN
    RAISE EXCEPTION 'crm_stage_transition_contract_invalid';
  END IF;

  IF v_def LIKE '%update public.patients%'
     OR v_def LIKE '%patient_journey%'
     OR v_def LIKE '%appointments%'
     OR v_def LIKE '%financial%' THEN
    RAISE EXCEPTION 'crm_stage_transition_foreign_domain_leak';
  END IF;
END $$;

SELECT '8) raw Commercial Core browser DML remains closed' AS check;
DO $$
DECLARE
  v_table text;
  v_priv text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'contacts',
    'crm_pipelines',
    'crm_stages',
    'crm_leads',
    'crm_lead_activities'
  ]
  LOOP
    FOREACH v_priv IN ARRAY ARRAY['INSERT','UPDATE','DELETE']
    LOOP
      IF has_table_privilege('anon', 'public.' || v_table, v_priv)
         OR has_table_privilege('authenticated', 'public.' || v_table, v_priv) THEN
        RAISE EXCEPTION 'crm_command_raw_dml_leaked:%:%', v_table, v_priv;
      END IF;
    END LOOP;
  END LOOP;
END $$;

SELECT '9) no parallel commercial tables were introduced' AS check;
DO $$
BEGIN
  IF to_regclass('public.crm_tasks') IS NOT NULL
     OR to_regclass('public.crm_events') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.crm_idempotency') IS NOT NULL THEN
    RAISE EXCEPTION 'crm_command_parallel_authority_detected';
  END IF;
END $$;

SELECT 'COMMERCIAL CRM COMMAND BOUNDARY VERIFY PASSED' AS result;
