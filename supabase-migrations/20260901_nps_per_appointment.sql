-- MEDICSPRO — NPS por atendimento, não por paciente/janela
BEGIN;

ALTER TABLE public.nps_surveys
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS nps_surveys_appointment_idx
  ON public.nps_surveys (clinic_id, appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nps_surveys_one_per_appointment_idx
  ON public.nps_surveys (clinic_id, appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.queue_selected_nps_surveys(p_appointment_ids uuid[], p_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_count integer := 0;
  r record;
  v_message text;
BEGIN
  IF v_role NOT IN ('owner','admin','recep') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501';
  END IF;
  IF coalesce(array_length(p_appointment_ids, 1), 0) = 0 THEN RETURN 0; END IF;

  PERFORM public.ensure_default_message_templates();

  FOR r IN
    SELECT a.id AS appointment_id, a.paciente_id
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.paciente_id AND p.clinic_id = a.clinic_id
    WHERE a.id = ANY(p_appointment_ids)
      AND a.clinic_id = v_clinic
      AND a.status = 'finalizado'
      AND a.data >= current_date - greatest(1,p_days)
      AND a.data <= current_date
      AND p.opt_in_whats = true
      AND p.anonimizado = false
      AND coalesce(trim(p.telefone), '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.wa_logs w
        WHERE w.clinic_id = v_clinic
          AND w.appointment_id = a.id
          AND w.template = 'nps'
          AND w.status IN ('fila','enviando','enviado','entregue','lido')
      )
    ORDER BY a.data DESC, a.inicio DESC
  LOOP
    v_message := public.render_message_template(v_clinic,'nps',r.paciente_id,r.appointment_id,NULL);

    INSERT INTO public.nps_surveys (clinic_id,patient_id,appointment_id,nota,comentario,data)
    VALUES (v_clinic,r.paciente_id,r.appointment_id,NULL,'',current_date)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.wa_logs (clinic_id,patient_id,appointment_id,template,mensagem,enviado_em,status,scheduled_for,created_by)
    VALUES (v_clinic,r.paciente_id,r.appointment_id,'nps',v_message,now(),'fila',now(),auth.uid());

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_selected_nps_surveys(uuid[],integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_selected_nps_surveys(uuid[],integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.queue_nps_surveys(p_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_count integer := 0;
  r record;
  v_message text;
BEGIN
  IF v_role NOT IN ('owner','admin','recep') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501';
  END IF;

  PERFORM public.ensure_default_message_templates();

  FOR r IN
    SELECT a.id AS appointment_id, a.paciente_id
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.paciente_id AND p.clinic_id = a.clinic_id
    WHERE a.clinic_id = v_clinic
      AND a.status = 'finalizado'
      AND a.data >= current_date - greatest(1,p_days)
      AND a.data <= current_date
      AND p.opt_in_whats = true
      AND p.anonimizado = false
      AND coalesce(trim(p.telefone), '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.wa_logs w
        WHERE w.clinic_id = v_clinic
          AND w.appointment_id = a.id
          AND w.template = 'nps'
          AND w.status IN ('fila','enviando','enviado','entregue','lido')
      )
    ORDER BY a.data DESC, a.inicio DESC
  LOOP
    v_message := public.render_message_template(v_clinic,'nps',r.paciente_id,r.appointment_id,NULL);

    INSERT INTO public.nps_surveys (clinic_id,patient_id,appointment_id,nota,comentario,data)
    VALUES (v_clinic,r.paciente_id,r.appointment_id,NULL,'',current_date)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.wa_logs (clinic_id,patient_id,appointment_id,template,mensagem,enviado_em,status,scheduled_for,created_by)
    VALUES (v_clinic,r.paciente_id,r.appointment_id,'nps',v_message,now(),'fila',now(),auth.uid());

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_nps_surveys(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_nps_surveys(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.persist_nps_whatsapp_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score integer;
  v_survey_id uuid;
BEGIN
  IF NEW.response_action = 'nps_score_received'
     AND OLD.response_action IS DISTINCT FROM NEW.response_action
     AND coalesce(NEW.reply_text, '') ~ '^(10|[0-9])$' THEN
    v_score := NEW.reply_text::integer;

    IF NEW.appointment_id IS NOT NULL THEN
      SELECT id INTO v_survey_id
      FROM public.nps_surveys
      WHERE clinic_id = NEW.clinic_id
        AND appointment_id = NEW.appointment_id
        AND nota IS NULL
      ORDER BY data DESC
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF v_survey_id IS NULL THEN
      SELECT id INTO v_survey_id
      FROM public.nps_surveys
      WHERE clinic_id = NEW.clinic_id
        AND patient_id = NEW.patient_id
        AND nota IS NULL
      ORDER BY data DESC
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF v_survey_id IS NULL THEN
      INSERT INTO public.nps_surveys (clinic_id, patient_id, appointment_id, nota, comentario, data)
      VALUES (NEW.clinic_id, NEW.patient_id, NEW.appointment_id, v_score, '', current_date)
      RETURNING id INTO v_survey_id;
    ELSE
      UPDATE public.nps_surveys SET nota = v_score WHERE id = v_survey_id;
    END IF;

    UPDATE public.wa_logs
    SET needs_human = false,
        review_resolution = 'nps_saved',
        review_note = 'Nota NPS persistida automaticamente',
        review_resolved_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
