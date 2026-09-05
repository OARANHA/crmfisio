-- VERIFY — MEDICSPRO platform provisioning runtime hardening

DO $$
DECLARE
  v_def text;
  v_cfg text[];
BEGIN
  SELECT pg_get_functiondef(p.oid), p.proconfig
  INTO v_def, v_cfg
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'complete_clinic_provisioning'
    AND pg_get_function_identity_arguments(p.oid) = 'p_request_id uuid, p_owner_user_id uuid';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'complete_clinic_provisioning(uuid,uuid) ausente';
  END IF;

  IF NOT ('search_path=public, pg_temp' = ANY(coalesce(v_cfg, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'search_path inseguro em complete_clinic_provisioning: %', v_cfg;
  END IF;

  IF v_def ~* 'ON[[:space:]]+CONFLICT[[:space:]]*\([[:space:]]*clinic_id[[:space:]]*\)' THEN
    RAISE EXCEPTION 'ambiguidade regressiva detectada: ON CONFLICT (clinic_id)';
  END IF;

  IF v_def !~* 'clinic_provisioning_requests[[:space:]]+AS[[:space:]]+cpr' THEN
    RAISE EXCEPTION 'queries de provisioning não estão qualificadas com alias cpr';
  END IF;

  IF v_def !~* 'clinics[[:space:]]+AS[[:space:]]+c' THEN
    RAISE EXCEPTION 'query de clinics não está qualificada com alias c';
  END IF;

  IF has_function_privilege('authenticated', 'public.complete_clinic_provisioning(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated não deve executar complete_clinic_provisioning';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.complete_clinic_provisioning(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role precisa executar complete_clinic_provisioning';
  END IF;

  RAISE NOTICE 'PLATFORM_PROVISIONING_RUNTIME_HARDENING_OK ambiguity=false search_path=public,pg_temp grants=true';
END;
$$;
