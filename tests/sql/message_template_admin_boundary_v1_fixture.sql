\set ON_ERROR_STOP on

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid NULL,
  acao text NOT NULL,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  template text NOT NULL CHECK (template IN ('confirmacao','nps','reativacao','vaga_espera')),
  body text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, template)
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_templates_select_tenant
ON public.message_templates
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY message_templates_write_operational
ON public.message_templates
FOR ALL TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','recep')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','recep')
);

GRANT ALL ON TABLE public.message_templates TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_default_message_templates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_clinic uuid := public.current_clinic_id();
BEGIN
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'Clínica não identificada'; END IF;
  INSERT INTO public.message_templates (clinic_id, template, body) VALUES
    (v_clinic, 'confirmacao', 'Confirmação {nome}'),
    (v_clinic, 'nps', 'NPS {nome}'),
    (v_clinic, 'reativacao', 'Reativação {nome}'),
    (v_clinic, 'vaga_espera', 'Vaga {nome}')
  ON CONFLICT (clinic_id, template) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.render_message_template(
  p_clinic uuid, p_template text, p_patient uuid,
  p_appointment uuid DEFAULT NULL, p_professional uuid DEFAULT NULL
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT body
  FROM public.message_templates
  WHERE clinic_id = p_clinic AND template = p_template AND ativo = true
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_message_templates() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.render_message_template(uuid,text,uuid,uuid,uuid) TO anon, authenticated, service_role;

INSERT INTO public.message_templates (id, clinic_id, template, body) VALUES
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'confirmacao', 'Clinic A confirmacao'),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'nps', 'Clinic A nps'),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'reativacao', 'Clinic A reativacao'),
  ('50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'vaga_espera', 'Clinic A vaga_espera'),
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'confirmacao', 'Clinic B confirmacao'),
  ('50000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'nps', 'Clinic B nps'),
  ('50000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'reativacao', 'Clinic B reativacao'),
  ('50000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002', 'vaga_espera', 'Clinic B vaga_espera');