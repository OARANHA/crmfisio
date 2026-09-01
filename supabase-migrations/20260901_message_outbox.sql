-- MEDICSPRO — fila real de mensagens, independente do provedor (Evolution entra como worker)
BEGIN;

-- Amplia o log existente para funcionar como outbox auditável.
ALTER TABLE public.wa_logs
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waitlist_id uuid REFERENCES public.waitlist_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Remove checks antigos de template/status sem depender do nome gerado originalmente.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.wa_logs'::regclass
      AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%template%' OR pg_get_constraintdef(oid) ILIKE '%status%')
  LOOP
    EXECUTE format('ALTER TABLE public.wa_logs DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.wa_logs
  ADD CONSTRAINT wa_logs_template_check
    CHECK (template IN ('confirmacao','nps','reativacao','vaga_espera')),
  ADD CONSTRAINT wa_logs_status_check
    CHECK (status IN ('fila','enviando','enviado','entregue','lido','falhou','cancelado'));

ALTER TABLE public.wa_logs ALTER COLUMN status SET DEFAULT 'fila';

CREATE INDEX IF NOT EXISTS wa_logs_outbox_idx
  ON public.wa_logs (clinic_id, status, scheduled_for, created_at);
CREATE INDEX IF NOT EXISTS wa_logs_appointment_idx
  ON public.wa_logs (appointment_id, template, status);
CREATE INDEX IF NOT EXISTS wa_logs_waitlist_idx
  ON public.wa_logs (waitlist_id, template, status);

CREATE UNIQUE INDEX IF NOT EXISTS wa_logs_one_open_confirmation_idx
  ON public.wa_logs (clinic_id, appointment_id, template)
  WHERE appointment_id IS NOT NULL
    AND template = 'confirmacao'
    AND status IN ('fila','enviando','enviado','entregue','lido');

CREATE TABLE IF NOT EXISTS public.message_templates (
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
DROP POLICY IF EXISTS message_templates_select_tenant ON public.message_templates;
CREATE POLICY message_templates_select_tenant ON public.message_templates
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());
DROP POLICY IF EXISTS message_templates_write_operational ON public.message_templates;
CREATE POLICY message_templates_write_operational ON public.message_templates
FOR ALL TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','recep'))
WITH CHECK (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','recep'));
GRANT SELECT, INSERT, UPDATE ON public.message_templates TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_message_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_touch_message_templates ON public.message_templates;
CREATE TRIGGER trg_touch_message_templates BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_message_updated_at();
DROP TRIGGER IF EXISTS trg_touch_wa_logs ON public.wa_logs;
CREATE TRIGGER trg_touch_wa_logs BEFORE UPDATE ON public.wa_logs
FOR EACH ROW EXECUTE FUNCTION public.touch_message_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_default_message_templates()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clinic uuid := public.current_clinic_id();
BEGIN
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'Clínica não identificada'; END IF;
  INSERT INTO public.message_templates (clinic_id, template, body) VALUES
    (v_clinic, 'confirmacao', 'Olá, {nome}! Sua sessão de {tipo} está marcada para {data} às {hora}. Responda SIM para confirmar.'),
    (v_clinic, 'nps', 'Olá, {nome}! Como você avalia seu atendimento recente? Responda de 0 a 10.'),
    (v_clinic, 'reativacao', 'Olá, {nome}! Sentimos sua falta. Que tal retomar seu tratamento? Temos horários disponíveis.'),
    (v_clinic, 'vaga_espera', 'Olá, {nome}! Surgiu uma vaga em {data} às {hora} com {profissional}. Deseja aproveitar este horário? Responda SIM para confirmar o interesse.')
  ON CONFLICT (clinic_id, template) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_default_message_templates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_message_templates() TO authenticated;

CREATE OR REPLACE FUNCTION public.render_message_template(
  p_clinic uuid, p_template text, p_patient uuid,
  p_appointment uuid DEFAULT NULL, p_professional uuid DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_body text; v_name text; v_data text := ''; v_hora text := ''; v_tipo text := ''; v_prof text := '';
BEGIN
  SELECT body INTO v_body FROM public.message_templates
   WHERE clinic_id = p_clinic AND template = p_template AND ativo = true;
  IF v_body IS NULL THEN RAISE EXCEPTION 'Modelo de mensagem não configurado: %', p_template; END IF;
  SELECT split_part(nome, ' ', 1) INTO v_name FROM public.patients WHERE id = p_patient AND clinic_id = p_clinic;
  IF p_appointment IS NOT NULL THEN
    SELECT to_char(data, 'DD/MM/YYYY'), left(inicio::text,5), tipo, fisio_id
      INTO v_data, v_hora, v_tipo, p_professional
      FROM public.appointments WHERE id = p_appointment AND clinic_id = p_clinic;
  END IF;
  IF p_professional IS NOT NULL THEN SELECT nome INTO v_prof FROM public.profiles WHERE id = p_professional AND clinic_id = p_clinic; END IF;
  RETURN replace(replace(replace(replace(replace(v_body,
    '{nome}', coalesce(v_name,'')), '{data}', coalesce(v_data,'')), '{hora}', coalesce(v_hora,'')),
    '{tipo}', coalesce(v_tipo,'')), '{profissional}', coalesce(v_prof,''));
END;
$$;
REVOKE ALL ON FUNCTION public.render_message_template(uuid,text,uuid,uuid,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.queue_waitlist_offer(p_waitlist_id uuid, p_cancelled_appointment_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clinic uuid := public.current_clinic_id(); v_role text := public.current_app_role();
  v_wait public.waitlist_entries%ROWTYPE; v_slot public.appointments%ROWTYPE; v_optin boolean; v_message text; v_id uuid;
BEGIN
  IF v_role NOT IN ('owner','admin','recep') THEN RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_wait FROM public.waitlist_entries WHERE id=p_waitlist_id FOR UPDATE;
  IF NOT FOUND OR v_wait.clinic_id IS DISTINCT FROM v_clinic OR v_wait.status NOT IN ('aguardando','ofertado') THEN RAISE EXCEPTION 'Entrada da espera indisponível'; END IF;
  SELECT * INTO v_slot FROM public.appointments WHERE id=p_cancelled_appointment_id;
  IF NOT FOUND OR v_slot.clinic_id IS DISTINCT FROM v_clinic OR v_slot.status <> 'cancelado' THEN RAISE EXCEPTION 'Vaga não está mais disponível'; END IF;
  SELECT opt_in_whats INTO v_optin FROM public.patients WHERE id=v_wait.patient_id AND clinic_id=v_clinic;
  IF coalesce(v_optin,false) = false THEN RAISE EXCEPTION 'Paciente sem opt-in para WhatsApp' USING ERRCODE='42501'; END IF;
  PERFORM public.ensure_default_message_templates();
  v_message := public.render_message_template(v_clinic,'vaga_espera',v_wait.patient_id,v_slot.id,v_slot.fisio_id);
  INSERT INTO public.wa_logs (clinic_id,patient_id,appointment_id,waitlist_id,template,mensagem,enviado_em,status,scheduled_for,created_by)
  VALUES (v_clinic,v_wait.patient_id,v_slot.id,v_wait.id,'vaga_espera',v_message,now(),'fila',now(),auth.uid()) RETURNING id INTO v_id;
  UPDATE public.waitlist_entries SET status='ofertado', offered_at=now() WHERE id=v_wait.id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_waitlist_offer(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_waitlist_offer(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.queue_appointment_confirmations(p_hours integer DEFAULT 48)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clinic uuid := public.current_clinic_id(); v_role text := public.current_app_role(); v_count integer := 0; r record; v_message text;
BEGIN
  IF v_role NOT IN ('owner','admin','recep') THEN RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501'; END IF;
  PERFORM public.ensure_default_message_templates();
  FOR r IN
    SELECT a.id appointment_id,a.paciente_id FROM public.appointments a JOIN public.patients p ON p.id=a.paciente_id
    WHERE a.clinic_id=v_clinic AND a.status IN ('agendado','confirmado') AND p.opt_in_whats=true
      AND (a.data + a.inicio) >= localtimestamp
      AND (a.data + a.inicio) <= localtimestamp + make_interval(hours => greatest(1,p_hours))
      AND NOT EXISTS (SELECT 1 FROM public.wa_logs w WHERE w.appointment_id=a.id AND w.template='confirmacao' AND w.status IN ('fila','enviando','enviado','entregue','lido'))
  LOOP
    v_message := public.render_message_template(v_clinic,'confirmacao',r.paciente_id,r.appointment_id,NULL);
    INSERT INTO public.wa_logs (clinic_id,patient_id,appointment_id,template,mensagem,enviado_em,status,scheduled_for,created_by)
    VALUES (v_clinic,r.paciente_id,r.appointment_id,'confirmacao',v_message,now(),'fila',now(),auth.uid());
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_appointment_confirmations(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_appointment_confirmations(integer) TO authenticated;

COMMIT;
