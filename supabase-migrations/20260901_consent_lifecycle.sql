-- MedicsPro — ciclo de vida de consentimentos pendentes
BEGIN;

ALTER TABLE public.consent_terms
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE INDEX IF NOT EXISTS consent_terms_patient_active_idx
  ON public.consent_terms (patient_id, created_at DESC)
  WHERE canceled_at IS NULL;

CREATE OR REPLACE FUNCTION public.cancel_patient_consent(
  p_consent_id uuid,
  p_reason text DEFAULT 'Substituído por nova versão'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF v_role NOT IN ('owner','admin','fisio','recep') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.consent_terms
  SET canceled_at = now(),
      canceled_by = auth.uid(),
      cancel_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Cancelado operacionalmente')
  WHERE id = p_consent_id
    AND clinic_id = v_clinic
    AND assinado = false
    AND canceled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent unavailable, signed or already canceled';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_patient_consent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_patient_consent(uuid, text) TO authenticated;

-- Aceite somente de documento ainda ativo.
CREATE OR REPLACE FUNCTION public.accept_patient_consent(
  p_consent_id uuid,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_ip_type text;
BEGIN
  IF v_role NOT IN ('owner','admin','fisio','recep') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT data_type INTO v_ip_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'consent_terms'
    AND column_name = 'ip';

  IF v_ip_type = 'inet' THEN
    EXECUTE '
      UPDATE public.consent_terms
      SET assinado = true,
          data_assinatura = now(),
          accepted_by = auth.uid(),
          ip = COALESCE($1::inet, ip),
          user_agent = COALESCE($2, user_agent)
      WHERE id = $3
        AND clinic_id = $4
        AND assinado = false
        AND canceled_at IS NULL'
    USING NULLIF(p_ip, ''), p_user_agent, p_consent_id, v_clinic;
  ELSE
    UPDATE public.consent_terms
    SET assinado = true,
        data_assinatura = now(),
        accepted_by = auth.uid(),
        ip = COALESCE(NULLIF(p_ip, ''), ip),
        user_agent = COALESCE(p_user_agent, user_agent)
    WHERE id = p_consent_id
      AND clinic_id = v_clinic
      AND assinado = false
      AND canceled_at IS NULL;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent unavailable, canceled or already accepted';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_patient_consent(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_patient_consent(uuid, text, text) TO authenticated;

COMMIT;
