-- MedicsPro — consentimento versionado e operacional
BEGIN;

CREATE TABLE IF NOT EXISTS public.consent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nome text NOT NULL,
  versao text NOT NULL DEFAULT '1.0',
  conteudo text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, nome, versao)
);

CREATE INDEX IF NOT EXISTS consent_templates_clinic_idx
  ON public.consent_templates (clinic_id, ativo);

ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_templates_select_tenant ON public.consent_templates;
CREATE POLICY consent_templates_select_tenant ON public.consent_templates
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS consent_templates_write_admin ON public.consent_templates;
CREATE POLICY consent_templates_write_admin ON public.consent_templates
FOR ALL TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_templates TO authenticated;

-- Liga cada aceite ao modelo que o originou, sem quebrar consentimentos antigos.
ALTER TABLE public.consent_terms
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.consent_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conteudo_snapshot text,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS consent_terms_patient_idx
  ON public.consent_terms (patient_id, created_at DESC);

-- Cria um documento pendente a partir do modelo ativo, preservando o texto/versionamento.
CREATE OR REPLACE FUNCTION public.create_patient_consent(
  p_patient_id uuid,
  p_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_template public.consent_templates%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_role NOT IN ('owner','admin','fisio','recep') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id AND clinic_id = v_clinic AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'patient outside tenant';
  END IF;

  SELECT * INTO v_template
  FROM public.consent_templates
  WHERE id = p_template_id AND clinic_id = v_clinic AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent template unavailable';
  END IF;

  INSERT INTO public.consent_terms (
    clinic_id, patient_id, nome, versao, assinado,
    template_id, conteudo_snapshot
  ) VALUES (
    v_clinic, p_patient_id, v_template.nome, v_template.versao, false,
    v_template.id, v_template.conteudo
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_patient_consent(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_patient_consent(uuid, uuid) TO authenticated;

-- Aceite auditável. O texto aceito permanece no snapshot do consent_terms.
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
BEGIN
  IF v_role NOT IN ('owner','admin','fisio','recep') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.consent_terms
  SET assinado = true,
      data_assinatura = now(),
      accepted_by = auth.uid(),
      ip = COALESCE(p_ip, ip),
      user_agent = COALESCE(p_user_agent, user_agent)
  WHERE id = p_consent_id
    AND clinic_id = v_clinic
    AND assinado = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent unavailable or already accepted';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_patient_consent(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_patient_consent(uuid, text, text) TO authenticated;

COMMIT;
