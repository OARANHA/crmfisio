-- MEDICSPRO — Platform administration and idempotent clinic provisioning

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinic_provisioning_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  requested_by uuid NOT NULL REFERENCES public.platform_admins(user_id) ON DELETE RESTRICT,
  clinic_name text NOT NULL CHECK (length(trim(clinic_name)) BETWEEN 2 AND 160),
  cnpj text,
  owner_email text NOT NULL,
  owner_name text NOT NULL CHECK (length(trim(owner_name)) BETWEEN 2 AND 160),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','auth_created','completed','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS clinic_provisioning_requests_status_idx
  ON public.clinic_provisioning_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_audit_log_actor_created_idx
  ON public.platform_audit_log (actor_user_id, created_at DESC);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_provisioning_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_admins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.clinic_provisioning_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_audit_log FROM service_role;
GRANT ALL ON public.platform_admins TO service_role;
GRANT ALL ON public.clinic_provisioning_requests TO service_role;
GRANT SELECT, INSERT ON public.platform_audit_log TO service_role;

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

  -- A nova clínica nasce com automações pausadas até revisar provedor, textos e janela.
  INSERT INTO public.automation_settings (clinic_id, active)
  VALUES (v_clinic_id, false)
  ON CONFLICT DO NOTHING;

  UPDATE public.clinic_provisioning_requests AS cpr
  SET status = 'completed', clinic_id = v_clinic_id,
      owner_user_id = p_owner_user_id, error_message = NULL,
      updated_at = now(), completed_at = now()
  WHERE cpr.id = p_request_id;

  INSERT INTO public.platform_audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    entity_type,
    entity_key,
    detail
  ) VALUES (
    v_request.requested_by,
    'clinic.provisioned',
    'clinic',
    v_clinic_id,
    'clinic',
    v_clinic_id::text,
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

COMMIT;