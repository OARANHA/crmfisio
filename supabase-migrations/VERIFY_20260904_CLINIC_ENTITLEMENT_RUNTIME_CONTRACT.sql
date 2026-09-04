-- MEDICSPRO — structural verification for current_clinic_entitlement_state
-- Read-only verifier. Expected result: CLINIC_ENTITLEMENT_RUNTIME_CONTRACT_OK

DO $$
DECLARE
  v_oid oid;
  v_secdef boolean;
  v_search_path text;
  v_auth_exec boolean;
  v_anon_exec boolean;
BEGIN
  SELECT p.oid, p.prosecdef
    INTO v_oid, v_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'current_clinic_entitlement_state'
    AND pg_get_function_identity_arguments(p.oid) = 'p_entitlement_key text';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'current_clinic_entitlement_state(text) ausente';
  END IF;

  IF NOT v_secdef THEN
    RAISE EXCEPTION 'current_clinic_entitlement_state deve ser SECURITY DEFINER';
  END IF;

  SELECT array_to_string(p.proconfig, ',')
    INTO v_search_path
  FROM pg_proc p
  WHERE p.oid = v_oid;

  IF v_search_path IS NULL OR v_search_path NOT LIKE '%search_path=public, pg_temp%' THEN
    RAISE EXCEPTION 'search_path seguro ausente: %', v_search_path;
  END IF;

  SELECT has_function_privilege('authenticated', v_oid, 'EXECUTE') INTO v_auth_exec;
  SELECT has_function_privilege('anon', v_oid, 'EXECUTE') INTO v_anon_exec;

  IF NOT v_auth_exec THEN
    RAISE EXCEPTION 'authenticated precisa EXECUTE';
  END IF;

  IF v_anon_exec THEN
    RAISE EXCEPTION 'anon não deve possuir EXECUTE';
  END IF;

  IF to_regclass('public.platform_clinic_entitlements') IS NULL THEN
    RAISE EXCEPTION 'platform_clinic_entitlements ausente';
  END IF;

  RAISE NOTICE 'CLINIC_ENTITLEMENT_RUNTIME_CONTRACT_OK';
END;
$$;
