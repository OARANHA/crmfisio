\set ON_ERROR_STOP on
\pset pager off

SELECT '1) Commercial Core tables exist with RLS enabled' AS check;
DO $$
DECLARE
  v_table text;
  v_oid regclass;
  v_rls boolean;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'contacts',
    'crm_pipelines',
    'crm_stages',
    'crm_leads',
    'crm_lead_activities'
  ]
  LOOP
    v_oid := to_regclass('public.' || v_table);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'commercial_core_table_missing:%', v_table;
    END IF;

    SELECT c.relrowsecurity
      INTO v_rls
    FROM pg_class c
    WHERE c.oid = v_oid;

    IF v_rls IS NOT TRUE THEN
      RAISE EXCEPTION 'commercial_core_rls_disabled:%', v_table;
    END IF;
  END LOOP;
END $$;

SELECT '2) Browser roles have no raw table privileges' AS check;
DO $$
DECLARE
  v_table text;
  v_role text;
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
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated']
    LOOP
      FOREACH v_priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
      LOOP
        IF has_table_privilege(v_role, 'public.' || v_table, v_priv) THEN
          RAISE EXCEPTION 'commercial_core_browser_privilege_leaked:%:%:%', v_role, v_table, v_priv;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

SELECT '3) service_role retains foundation table access' AS check;
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'contacts',
    'crm_pipelines',
    'crm_stages',
    'crm_leads',
    'crm_lead_activities'
  ]
  LOOP
    IF NOT has_table_privilege('service_role', 'public.' || v_table, 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.' || v_table, 'INSERT')
       OR NOT has_table_privilege('service_role', 'public.' || v_table, 'UPDATE')
       OR NOT has_table_privilege('service_role', 'public.' || v_table, 'DELETE') THEN
      RAISE EXCEPTION 'commercial_core_service_role_privilege_missing:%', v_table;
    END IF;
  END LOOP;
END $$;

SELECT '4) Tenant integrity and outcome constraints exist' AS check;
DO $$
DECLARE
  v_def text;
BEGIN
  IF to_regclass('public.contacts_active_patient_unique') IS NULL THEN
    RAISE EXCEPTION 'contacts_active_patient_unique_missing';
  END IF;

  IF to_regclass('public.crm_pipelines_one_active_default_per_clinic') IS NULL THEN
    RAISE EXCEPTION 'crm_default_pipeline_unique_index_missing';
  END IF;

  IF to_regclass('public.crm_stages_one_active_won_per_pipeline') IS NULL
     OR to_regclass('public.crm_stages_one_active_lost_per_pipeline') IS NULL THEN
    RAISE EXCEPTION 'crm_terminal_stage_unique_index_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.crm_leads'::regclass
      AND conname = 'crm_leads_contact_tenant_fk'
      AND contype = 'f'
  ) THEN
    RAISE EXCEPTION 'crm_leads_contact_tenant_fk_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.crm_leads'::regclass
      AND conname = 'crm_leads_stage_pipeline_tenant_fk'
      AND contype = 'f'
  ) THEN
    RAISE EXCEPTION 'crm_leads_stage_pipeline_tenant_fk_missing';
  END IF;

  SELECT pg_get_constraintdef(oid)
    INTO v_def
  FROM pg_constraint
  WHERE conrelid = 'public.crm_stages'::regclass
    AND conname = 'crm_stages_kind_check';

  IF v_def IS NULL
     OR v_def NOT LIKE '%open%'
     OR v_def NOT LIKE '%won%'
     OR v_def NOT LIKE '%lost%' THEN
    RAISE EXCEPTION 'crm_stages_kind_contract_invalid';
  END IF;
END $$;

SELECT '5) Commercial Core deliberately excludes competing/clinical columns' AS check;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_leads'
      AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'crm_leads_competing_status_column_forbidden';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('contacts','crm_pipelines','crm_stages','crm_leads','crm_lead_activities')
      AND column_name IN (
        'cid10',
        'anamnese',
        'queixa_principal',
        'clinical_record',
        'evolution',
        'diagnosis',
        'diagnostico'
      )
  ) THEN
    RAISE EXCEPTION 'commercial_core_clinical_column_leaked';
  END IF;
END $$;

SELECT '6) Boundary triggers are installed and hidden from browser roles' AS check;
DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.contacts'::regclass
      AND tgname = 'trg_guard_crm_contact_patient_tenant'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'crm_contact_patient_guard_trigger_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.crm_leads'::regclass
      AND tgname = 'trg_guard_crm_lead_semantics'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'crm_lead_semantics_trigger_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.crm_lead_activities'::regclass
      AND tgname = 'trg_guard_crm_activity_actor_tenant'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'crm_activity_actor_guard_trigger_missing';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.guard_crm_contact_patient_tenant()'::regprocedure,
    'public.guard_crm_lead_semantics()'::regprocedure,
    'public.guard_crm_activity_actor_tenant()'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'commercial_core_internal_trigger_helper_exposed:%', v_fn;
    END IF;
  END LOOP;
END $$;

SELECT '7) CRM read guard is internal and preserves active profile + entitlement' AS check;
DO $$
DECLARE
  v_oid regprocedure := to_regprocedure('public.crm_current_reader_clinic_id()');
  v_def text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'crm_current_reader_clinic_id_missing';
  END IF;

  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'crm_current_reader_guard_exposed';
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_def;

  IF v_def NOT LIKE '%SECURITY DEFINER%'
     OR v_def NOT LIKE '%current_active_profile%'
     OR v_def NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_def NOT LIKE '%crm.access%'
     OR v_def NOT LIKE '%owner%'
     OR v_def NOT LIKE '%admin%'
     OR v_def NOT LIKE '%professional%'
     OR v_def NOT LIKE '%recep%'
     OR v_def NOT LIKE '%financeiro%' THEN
    RAISE EXCEPTION 'crm_current_reader_guard_contract_invalid';
  END IF;
END $$;

SELECT '8) CRM read projections are authenticated-only SECURITY DEFINER' AS check;
DO $$
DECLARE
  v_fn regprocedure;
  v_def text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.list_current_clinic_crm_pipelines()'::regprocedure,
    'public.list_current_clinic_crm_stages(uuid)'::regprocedure,
    'public.list_current_clinic_crm_leads()'::regprocedure,
    'public.list_current_clinic_crm_lead_activities(uuid)'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'crm_read_projection_acl_invalid:%', v_fn;
    END IF;

    SELECT pg_get_functiondef(v_fn) INTO v_def;
    IF v_def NOT LIKE '%SECURITY DEFINER%'
       OR v_def NOT LIKE '%crm_current_reader_clinic_id%' THEN
      RAISE EXCEPTION 'crm_read_projection_boundary_invalid:%', v_fn;
    END IF;
  END LOOP;
END $$;

SELECT '9) Lead projection does not join clinical record content' AS check;
DO $$
DECLARE
  v_def text := pg_get_functiondef('public.list_current_clinic_crm_leads()'::regprocedure);
BEGIN
  IF lower(v_def) LIKE '%cid10%'
     OR lower(v_def) LIKE '%anamnese%'
     OR lower(v_def) LIKE '%queixa_principal%'
     OR lower(v_def) LIKE '%physiotherapy_evolution%'
     OR lower(v_def) LIKE '%clinical_encounter%'
     OR lower(v_def) LIKE '%clinical_document%' THEN
    RAISE EXCEPTION 'crm_lead_projection_clinical_join_forbidden';
  END IF;
END $$;

SELECT '10) Existing clinics receive a coherent generic default pipeline' AS check;
DO $$
DECLARE
  v_active_clinics integer;
BEGIN
  SELECT count(*)
    INTO v_active_clinics
  FROM public.clinics
  WHERE deleted_at IS NULL;

  IF v_active_clinics = 0 THEN
    RAISE NOTICE 'commercial_core_default_pipeline_data_check_skipped:no_clinics';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT c.id
    FROM public.clinics c
    LEFT JOIN public.crm_pipelines p
      ON p.clinic_id = c.id
     AND p.is_default IS TRUE
     AND p.archived_at IS NULL
    WHERE c.deleted_at IS NULL
    GROUP BY c.id
    HAVING count(p.id) <> 1
  ) THEN
    RAISE EXCEPTION 'commercial_core_default_pipeline_cardinality_invalid';
  END IF;

  IF EXISTS (
    SELECT p.id
    FROM public.crm_pipelines p
    LEFT JOIN public.crm_stages s
      ON s.pipeline_id = p.id
     AND s.archived_at IS NULL
    WHERE p.is_default IS TRUE
      AND p.archived_at IS NULL
    GROUP BY p.id
    HAVING count(*) FILTER (WHERE s.stage_kind = 'open') < 1
        OR count(*) FILTER (WHERE s.stage_kind = 'won') <> 1
        OR count(*) FILTER (WHERE s.stage_kind = 'lost') <> 1
  ) THEN
    RAISE EXCEPTION 'commercial_core_default_pipeline_stage_shape_invalid';
  END IF;
END $$;

SELECT '11) Legacy Patient Journey remains present and separate' AS check;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='patients'
      AND column_name='funil_stage'
  ) THEN
    RAISE EXCEPTION 'patients_funil_stage_unexpectedly_removed';
  END IF;

  IF to_regclass('public.patient_journey_events') IS NULL
     OR to_regprocedure('public.transition_patient_journey(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'patient_journey_boundary_unexpectedly_removed';
  END IF;
END $$;

SELECT 'COMMERCIAL CRM CORE FOUNDATION VERIFY PASSED' AS result;
