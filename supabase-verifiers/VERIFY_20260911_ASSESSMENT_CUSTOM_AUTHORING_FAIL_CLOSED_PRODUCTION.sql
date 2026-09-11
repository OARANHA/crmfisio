BEGIN;
SET TRANSACTION READ ONLY;

DO $$
DECLARE
  v_def text;
  v_path text;
BEGIN
  IF to_regprocedure('public.assessment_custom_authoring_allowed(uuid)') IS NULL THEN
    RAISE EXCEPTION 'assessment_custom_authoring_predicate_missing';
  END IF;

  SELECT pg_get_functiondef(p.oid), p.proconfig::text
    INTO v_def, v_path
  FROM pg_proc p
  WHERE p.oid = 'public.assessment_custom_authoring_allowed(uuid)'::regprocedure;

  IF v_def NOT ILIKE '%SECURITY DEFINER%' THEN RAISE EXCEPTION 'assessment_custom_authoring_predicate_not_security_definer'; END IF;
  IF coalesce(v_path, '') NOT ILIKE '%search_path=public, pg_temp%' THEN RAISE EXCEPTION 'assessment_custom_authoring_predicate_search_path_unsafe'; END IF;
  IF v_def NOT ILIKE '%entitlement_key = ''assessments.custom''%'
     OR v_def NOT ILIKE '%enabled = true%'
     OR v_def NOT ILIKE '%starts_at%<= now()%'
     OR v_def NOT ILIKE '%expires_at%> now()%' THEN
    RAISE EXCEPTION 'assessment_custom_authoring_predicate_not_explicit_effective_grant';
  END IF;
  IF v_def ILIKE '%clinic_entitlement_allowed%' THEN RAISE EXCEPTION 'assessment_custom_authoring_predicate_uses_rollout_fallback'; END IF;
  IF has_function_privilege('anon', 'public.assessment_custom_authoring_allowed(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.assessment_custom_authoring_allowed(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'assessment_custom_authoring_predicate_client_execute_exposed';
  END IF;

  IF has_function_privilege('anon', 'public.require_assessment_template_manager()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.require_assessment_template_manager()', 'EXECUTE') THEN
    RAISE EXCEPTION 'assessment_template_manager_acl_unexpected';
  END IF;
  SELECT pg_get_functiondef('public.require_assessment_template_manager()'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%assessment_custom_authoring_allowed%' THEN RAISE EXCEPTION 'assessment_template_manager_missing_internal_predicate'; END IF;

  FOREACH v_def IN ARRAY ARRAY[
    pg_get_functiondef('public.guard_custom_assessment_template_entitlement()'::regprocedure),
    pg_get_functiondef('public.guard_custom_assessment_version_entitlement()'::regprocedure)
  ] LOOP
    IF v_def NOT ILIKE '%assessment_custom_authoring_allowed%' THEN RAISE EXCEPTION 'assessment_custom_authoring_guard_missing_internal_predicate'; END IF;
  END LOOP;

  IF has_function_privilege('anon', 'public.guard_custom_assessment_template_entitlement()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.guard_custom_assessment_template_entitlement()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.guard_custom_assessment_version_entitlement()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.guard_custom_assessment_version_entitlement()', 'EXECUTE') THEN
    RAISE EXCEPTION 'assessment_custom_authoring_trigger_function_execute_exposed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.assessment_templates'::regclass AND tgname='trg_guard_custom_assessment_template_entitlement' AND NOT tgisinternal AND tgenabled <> 'D')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.assessment_template_versions'::regclass AND tgname='trg_guard_custom_assessment_version_entitlement' AND NOT tgisinternal AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'assessment_custom_authoring_entitlement_trigger_missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assessment_templates' AND policyname='assessment_templates_read_available' AND coalesce(qual,'') ILIKE '%assessment_custom_authoring_allowed%') THEN
    RAISE EXCEPTION 'assessment_library_read_is_wrongly_gated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.assessment_template_versions'::regclass AND tgname='trg_assessment_version_immutable' AND NOT tgisinternal AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'assessment_published_version_immutable_trigger_missing';
  END IF;
END $$;

SELECT 'ASSESSMENT CUSTOM AUTHORING FAIL-CLOSED PRODUCTION VERIFY PASSED' AS result;
ROLLBACK;
