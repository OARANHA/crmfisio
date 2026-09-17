\set ON_ERROR_STOP on
\pset pager off

BEGIN;
SET TRANSACTION READ ONLY;

DO $$
DECLARE
  v_table text;
  v_function regprocedure;
  v_def text;
  v_config text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'platform_plans',
    'platform_plan_versions',
    'platform_plan_entitlements',
    'clinic_plan_assignments'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      RAISE EXCEPTION 'plan_catalog_table_missing:%', v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_table AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'plan_catalog_rls_disabled:%', v_table;
    END IF;
    IF has_table_privilege('authenticated', 'public.' || v_table, 'SELECT')
       OR has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || v_table, 'DELETE')
       OR has_table_privilege('anon', 'public.' || v_table, 'SELECT') THEN
      RAISE EXCEPTION 'plan_catalog_direct_client_table_access:%', v_table;
    END IF;
  END LOOP;

  FOREACH v_function IN ARRAY ARRAY[
    'public.platform_create_plan(text,text,text,jsonb,boolean)'::regprocedure,
    'public.platform_publish_plan_version(uuid,text,text,jsonb)'::regprocedure,
    'public.platform_set_plan_active(uuid,boolean)'::regprocedure,
    'public.platform_list_plans()'::regprocedure,
    'public.platform_assign_clinic_plan(uuid,uuid,text,timestamptz,timestamptz,text)'::regprocedure,
    'public.platform_cancel_clinic_plan(uuid,text)'::regprocedure,
    'public.platform_get_clinic_plan_assignment(uuid)'::regprocedure,
    'public.platform_get_clinic_entitlements_v3(uuid)'::regprocedure,
    'public.platform_reset_clinic_entitlement(uuid,text)'::regprocedure
  ] LOOP
    SELECT pg_get_functiondef(p.oid), coalesce(p.proconfig::text, '')
      INTO v_def, v_config
    FROM pg_proc p WHERE p.oid = v_function;
    IF v_def NOT ILIKE '%SECURITY DEFINER%' THEN
      RAISE EXCEPTION 'plan_catalog_rpc_not_security_definer:%', v_function;
    END IF;
    IF v_config NOT ILIKE '%search_path=public, pg_temp%' THEN
      RAISE EXCEPTION 'plan_catalog_rpc_search_path_unsafe:%', v_function;
    END IF;
    IF has_function_privilege('anon', v_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'plan_catalog_rpc_acl_unexpected:%', v_function;
    END IF;
  END LOOP;

  IF has_function_privilege('anon', 'public.clinic_entitlement_resolution(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.clinic_entitlement_resolution(uuid,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.clinic_entitlement_resolution(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'internal_entitlement_resolver_exposed';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.clinic_entitlement_allowed(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.clinic_entitlement_allowed(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.clinic_entitlement_allowed(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'clinic_entitlement_allowed_acl_unexpected';
  END IF;

  IF has_function_privilege('anon', 'public.assessment_custom_authoring_allowed(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.assessment_custom_authoring_allowed(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.assessment_custom_authoring_allowed(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'assessment_custom_authoring_predicate_exposed';
  END IF;
END $$;

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.clinic_entitlement_resolution(uuid,text)'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%platform_clinic_entitlements%'
     OR v_def NOT ILIKE '%clinic_plan_assignments%'
     OR v_def NOT ILIKE '%finance.access%'
     OR v_def NOT ILIKE '%whatsapp.access%'
     OR v_def NOT ILIKE '%rollout%' THEN
    RAISE EXCEPTION 'effective_entitlement_resolution_contract_missing';
  END IF;

  SELECT pg_get_functiondef('public.current_nexus_entitlement_allowed()'::regprocedure) INTO v_def;
  IF v_def ILIKE '%clinic_entitlement_allowed%'
     OR v_def NOT ILIKE '%platform_clinic_entitlements%'
     OR v_def NOT ILIKE '%clinic_plan_assignments%'
     OR v_def NOT ILIKE '%entitlement_key = ''nexus.access''%'
     OR v_def NOT ILIKE '%enabled IS TRUE%' THEN
    RAISE EXCEPTION 'nexus_dedicated_fail_closed_contract_changed';
  END IF;

  SELECT pg_get_functiondef('public.assessment_custom_authoring_allowed(uuid)'::regprocedure) INTO v_def;
  IF v_def ILIKE '%clinic_entitlement_allowed%'
     OR v_def NOT ILIKE '%platform_clinic_entitlements%'
     OR v_def NOT ILIKE '%clinic_plan_assignments%'
     OR v_def NOT ILIKE '%entitlement_key = ''assessments.custom''%'
     OR v_def NOT ILIKE '%enabled = true%' THEN
    RAISE EXCEPTION 'assessment_custom_dedicated_fail_closed_contract_changed';
  END IF;

  SELECT pg_get_functiondef('public.current_clinic_entitlement_state(text)'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%clinic_entitlement_resolution%' THEN
    RAISE EXCEPTION 'current_entitlement_state_not_using_canonical_resolution';
  END IF;

  SELECT pg_get_functiondef('public.platform_reset_clinic_entitlement(uuid,text)'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%DELETE FROM public.platform_clinic_entitlements%'
     OR v_def NOT ILIKE '%clinic_entitlement_resolution%'
     OR v_def NOT ILIKE '%fallback_source%' THEN
    RAISE EXCEPTION 'entitlement_reset_fallback_contract_changed';
  END IF;

  SELECT pg_get_functiondef('public.platform_assign_clinic_plan(uuid,uuid,text,timestamptz,timestamptz,text)'::regprocedure) INTO v_def;
  IF v_def ~* '(professional_capabilities|profiles|nexus_clinical_results|clinical_instrument)' THEN
    RAISE EXCEPTION 'plan_assignment_crossed_clinical_authorization_boundary';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.platform_plan_versions'::regclass
      AND tgname = 'trg_guard_published_plan_version_immutable'
      AND NOT tgisinternal AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'published_plan_version_immutable_trigger_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.platform_plan_entitlements'::regclass
      AND tgname = 'trg_guard_published_plan_entitlement_immutable'
      AND NOT tgisinternal AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'published_plan_entitlement_immutable_trigger_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'clinic_plan_assignments'
      AND indexname = 'clinic_plan_assignments_one_open_idx'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%ends_at IS NULL%'
  ) THEN
    RAISE EXCEPTION 'one_open_assignment_unique_index_missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.platform_plan_versions pv
    WHERE pv.published_at IS NOT NULL
      AND 6 <> (
        SELECT count(*) FROM public.platform_plan_entitlements pe
        WHERE pe.plan_version_id = pv.id
      )
  ) THEN
    RAISE EXCEPTION 'published_plan_version_entitlement_catalog_incomplete';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.platform_clinic_entitlements e
    WHERE e.source = 'plan'
  ) THEN
    RAISE EXCEPTION 'plan_baseline_materialized_as_override';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinic_plan_assignments a
    WHERE a.ends_at IS NULL
      AND a.status NOT IN ('active','trialing')
  ) THEN
    RAISE EXCEPTION 'open_plan_assignment_invalid_status';
  END IF;
END $$;

SELECT
  (SELECT count(*) FROM public.platform_plans) AS plans,
  (SELECT count(*) FROM public.platform_plan_versions) AS plan_versions,
  (SELECT count(*) FROM public.clinic_plan_assignments) AS assignments,
  (SELECT count(*) FROM public.platform_clinic_entitlements) AS override_rows,
  (SELECT count(*) FROM public.platform_clinic_entitlements WHERE source = 'plan') AS materialized_plan_rows;

SELECT 'PLATFORM PLAN CATALOG + CLINIC PLAN ASSIGNMENT V1 PRODUCTION VERIFY PASSED' AS result;
ROLLBACK;
