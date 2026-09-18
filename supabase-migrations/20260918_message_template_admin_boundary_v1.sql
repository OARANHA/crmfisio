-- MEDICSPRO — Message Template Admin Boundary V1
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_templates_select_tenant ON public.message_templates;
DROP POLICY IF EXISTS message_templates_write_operational ON public.message_templates;
DROP POLICY IF EXISTS message_templates_write_admin ON public.message_templates;

REVOKE ALL ON TABLE public.message_templates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.message_templates TO service_role;

REVOKE ALL ON FUNCTION public.ensure_default_message_templates()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.render_message_template(uuid,text,uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_current_clinic_message_templates()
RETURNS TABLE (id uuid, template text, body text, ativo boolean, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'Clínica não identificada' USING ERRCODE='42501';
  END IF;
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Perfil sem permissão para configurar templates' USING ERRCODE='42501';
  END IF;
  IF NOT public.current_clinic_entitlement_allowed('whatsapp.access') THEN
    RAISE EXCEPTION 'Módulo WhatsApp não liberado para esta clínica' USING ERRCODE='42501';
  END IF;

  PERFORM public.ensure_default_message_templates();

  RETURN QUERY
  SELECT t.id, t.template, t.body, t.ativo, t.updated_at
  FROM public.message_templates t
  WHERE t.clinic_id = v_clinic
  ORDER BY t.template;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_current_clinic_message_template(
  p_template_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_body text := btrim(coalesce(p_body, ''));
  v_template text;
BEGIN
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'Clínica não identificada' USING ERRCODE='42501';
  END IF;
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Perfil sem permissão para configurar templates' USING ERRCODE='42501';
  END IF;
  IF NOT public.current_clinic_entitlement_allowed('whatsapp.access') THEN
    RAISE EXCEPTION 'Módulo WhatsApp não liberado para esta clínica' USING ERRCODE='42501';
  END IF;
  IF v_body = '' THEN
    RAISE EXCEPTION 'O conteúdo do template não pode ficar vazio';
  END IF;

  SELECT t.template
  INTO v_template
  FROM public.message_templates t
  WHERE t.id = p_template_id
    AND t.clinic_id = v_clinic
  FOR UPDATE;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado para esta clínica' USING ERRCODE='42501';
  END IF;

  UPDATE public.message_templates
  SET body = v_body
  WHERE id = p_template_id
    AND clinic_id = v_clinic;

  INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (
    v_clinic,
    auth.uid(),
    'MESSAGE_TEMPLATE_UPDATED',
    jsonb_build_object(
      'template_id', p_template_id,
      'template', v_template,
      'changed_fields', jsonb_build_array('body')
    )
  );

  RETURN p_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_current_clinic_message_templates()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_current_clinic_message_templates()
TO authenticated;

REVOKE ALL ON FUNCTION public.update_current_clinic_message_template(uuid,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_current_clinic_message_template(uuid,text)
TO authenticated;

COMMIT;