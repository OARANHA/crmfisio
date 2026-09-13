-- Production-safe verifier — Clinic Referral Authoring Policy V1
\pset pager off

DO $$
DECLARE
  v_guard text;
BEGIN
  IF to_regclass('public.clinic_clinical_flow_settings') IS NULL THEN
    RAISE EXCEPTION 'clinic_clinical_flow_settings_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clinic_clinical_flow_settings'
      AND column_name = 'referral_authoring_enabled'
      AND data_type = 'boolean'
      AND column_default = 'true'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'referral_authoring_enabled_contract_missing';
  END IF;

  IF to_regprocedure('public.get_current_clinic_clinical_flow_settings()') IS NULL
     OR to_regprocedure('public.update_current_clinic_clinical_flow_settings(boolean)') IS NULL
     OR to_regprocedure('public.clinic_referral_authoring_enabled(uuid)') IS NULL
     OR to_regprocedure('public.guard_clinical_referral_authoring_policy()') IS NULL THEN
    RAISE EXCEPTION 'clinic_referral_policy_functions_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.clinical_documents'::regclass
      AND tgname = 'trg_clinical_referral_authoring_policy'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'clinic_referral_authoring_policy_trigger_missing';
  END IF;

  SELECT lower(pg_get_functiondef('public.guard_clinical_referral_authoring_policy()'::regprocedure))
  INTO v_guard;

  IF position('clinical_referral_authoring_disabled' in v_guard) = 0
     OR position('old.status = ''draft''' in v_guard) = 0
     OR position('new.status in (''draft'', ''issued'')' in v_guard) = 0
     OR position('clinic_referral_authoring_enabled(new.clinic_id)' in v_guard) = 0 THEN
    RAISE EXCEPTION 'clinic_referral_authoring_policy_guard_contract_missing';
  END IF;

  IF has_table_privilege('authenticated', 'public.clinic_clinical_flow_settings', 'SELECT')
     OR has_table_privilege('authenticated', 'public.clinic_clinical_flow_settings', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinic_clinical_flow_settings', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinic_clinical_flow_settings', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated_direct_policy_table_access_present';
  END IF;

  IF has_function_privilege('anon', 'public.get_current_clinic_clinical_flow_settings()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.update_current_clinic_clinical_flow_settings(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon_referral_policy_rpc_execute_present';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_current_clinic_clinical_flow_settings()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.update_current_clinic_clinical_flow_settings(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_referral_policy_rpc_execute_missing';
  END IF;

  IF has_function_privilege('authenticated', 'public.clinic_referral_authoring_enabled(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.guard_clinical_referral_authoring_policy()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_internal_policy_helper_execute_present';
  END IF;
END $$;

SELECT 'CLINIC REFERRAL AUTHORING POLICY V1 VERIFY PASSED' AS result;
