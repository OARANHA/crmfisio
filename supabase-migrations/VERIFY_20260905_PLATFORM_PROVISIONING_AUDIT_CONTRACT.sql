-- VERIFY — MEDICSPRO clinic provisioning audit contract

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'complete_clinic_provisioning'
    AND pg_get_function_identity_arguments(p.oid) = 'p_request_id uuid, p_owner_user_id uuid';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'complete_clinic_provisioning(uuid,uuid) ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_audit_log'
      AND column_name = 'entity_type'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'platform_audit_log.entity_type NOT NULL ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_audit_log'
      AND column_name = 'entity_key'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'platform_audit_log.entity_key NOT NULL ausente';
  END IF;

  IF v_def !~* 'entity_type' OR v_def !~* 'entity_key' THEN
    RAISE EXCEPTION 'complete_clinic_provisioning não preenche contrato de auditoria governado';
  END IF;

  IF v_def !~* '''clinic''' THEN
    RAISE EXCEPTION 'complete_clinic_provisioning não identifica entidade clinic no audit log';
  END IF;

  IF has_function_privilege('authenticated', 'public.complete_clinic_provisioning(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated não deve executar complete_clinic_provisioning';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.complete_clinic_provisioning(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role precisa executar complete_clinic_provisioning';
  END IF;

  RAISE NOTICE 'PLATFORM_PROVISIONING_AUDIT_CONTRACT_OK entity_type=true entity_key=true grants=true';
END;
$$;
