-- MEDICSPRO — hotfix: eliminate PL/pgSQL output-column ambiguity in clinic provisioning

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_clinic_provisioning(
  p_request_id uuid,
  p_owner_user_id uuid
)
RETURNS TABLE (clinic_id uuid, owner_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.clinic_provisioning_requests%ROWTYPE;
  v_clinic_id uuid;
  v_cnpj text;
BEGIN
  SELECT cpr.* INTO v_request
  FROM public.clinic_provisioning_requests AS cpr
  WHERE cpr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de provisionamento não encontrada';
  END IF;

  IF v_request.status = 'completed' THEN
    IF v_request.owner_user_id IS DISTINCT FROM p_owner_user_id THEN
      RAISE EXCEPTION 'Solicitação já concluída para outro usuário';
    END IF;
    RETURN QUERY SELECT v_request.clinic_id, v_request.owner_user_id;
    RETURN;
  END IF;

  IF v_request.status NOT IN ('pending', 'auth_created', 'failed') THEN
    RAISE EXCEPTION 'Estado de provisionamento inválido: %', v_request.status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users AS au WHERE au.id = p_owner_user_id) THEN
    RAISE EXCEPTION 'Usuário owner não existe no Supabase Auth';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = p_owner_user_id) THEN
    RAISE EXCEPTION 'Usuário owner já possui vínculo com uma clínica';
  END IF;

  v_cnpj := nullif(regexp_replace(coalesce(v_request.cnpj, ''), '\D', '', 'g'), '');
  IF v_cnpj IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('clinic-cnpj:' || v_cnpj, 0));
    IF EXISTS (
      SELECT 1 FROM public.clinics AS c
      WHERE c.deleted_at IS NULL
        AND regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') = v_cnpj
    ) THEN
      RAISE EXCEPTION 'Já existe uma clínica ativa com este CNPJ';
    END IF;
  END IF;

  INSERT INTO public.clinics (name, cnpj)
  VALUES (trim(v_request.clinic_name), nullif(trim(v_request.cnpj), ''))
  RETURNING id INTO v_clinic_id;

  INSERT INTO public.profiles (
    id, clinic_id, email, nome, role, ativo, must_change_password
  ) VALUES (
    p_owner_user_id, v_clinic_id, lower(trim(v_request.owner_email)),
    trim(v_request.owner_name), 'owner', true, true
  );

  INSERT INTO public.automation_settings (clinic_id, active)
  VALUES (v_clinic_id, false)
  ON CONFLICT DO NOTHING;

  UPDATE public.clinic_provisioning_requests AS cpr
  SET status = 'completed', clinic_id = v_clinic_id,
      owner_user_id = p_owner_user_id, error_message = NULL,
      updated_at = now(), completed_at = now()
  WHERE cpr.id = p_request_id;

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, target_type, target_id, detail
  ) VALUES (
    v_request.requested_by, 'clinic.provisioned', 'clinic', v_clinic_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'owner_user_id', p_owner_user_id,
      'owner_email', lower(trim(v_request.owner_email))
    )
  );

  RETURN QUERY SELECT v_clinic_id, p_owner_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_clinic_provisioning(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_clinic_provisioning(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.complete_clinic_provisioning(uuid, uuid)
IS 'Idempotent clinic provisioning finalizer; qualified SQL avoids RETURNS TABLE output-variable ambiguity.';

COMMIT;
