-- Read-only verifier — Encounter Coverage Context V1
DO $$
DECLARE
  v_oid regprocedure := to_regprocedure('public.get_encounter_coverage_context(uuid)');
  v_def text;
  v_result text;
  v_volatility "char";
  v_security_definer boolean;
  v_config text[];
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'encounter_coverage_context_function_missing';
  END IF;

  SELECT pg_get_functiondef(v_oid), pg_get_function_result(v_oid), p.provolatile, p.prosecdef, p.proconfig
  INTO v_def, v_result, v_volatility, v_security_definer, v_config
  FROM pg_proc p WHERE p.oid = v_oid;

  IF v_volatility <> 's' OR v_security_definer IS NOT TRUE THEN
    RAISE EXCEPTION 'encounter_coverage_context_execution_contract_invalid';
  END IF;
  IF v_config IS NULL OR NOT ('search_path=public, pg_temp' = ANY(v_config)) THEN
    RAISE EXCEPTION 'encounter_coverage_context_search_path_missing';
  END IF;
  IF v_result <> 'TABLE(appointment_id uuid, coverage_kind text, coverage_state text, package_name text, administrative_attention boolean)' THEN
    RAISE EXCEPTION 'encounter_coverage_context_return_shape_invalid: %', v_result;
  END IF;

  IF position('current_user_has_valid_clinical_identity()' in v_def) = 0
     OR position('current_user_has_clinical_capability(''clinical.attend'')' in v_def) = 0
     OR position('a.professional_id = v_uid' in v_def) = 0
     OR position('a.status = ''em_atendimento''' in v_def) = 0
     OR position('a.clinic_id = v_clinic' in v_def) = 0 THEN
    RAISE EXCEPTION 'encounter_coverage_context_encounter_authority_missing';
  END IF;

  IF v_def ~* '\m(INSERT|UPDATE|DELETE|TRUNCATE)\M' THEN
    RAISE EXCEPTION 'encounter_coverage_context_must_be_read_only';
  END IF;
  IF position('current_clinic_entitlement_allowed(''finance.access'')' in v_def) > 0 THEN
    RAISE EXCEPTION 'encounter_coverage_context_must_not_require_global_finance_access';
  END IF;

  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('service_role', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'encounter_coverage_context_acl_invalid';
  END IF;
END $$;
