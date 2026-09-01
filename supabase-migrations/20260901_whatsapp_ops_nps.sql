-- MEDICSPRO — revisão operacional de respostas WhatsApp e NPS persistido
BEGIN;

ALTER TABLE public.wa_logs
  ADD COLUMN IF NOT EXISTS review_resolution text,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS review_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wa_logs_human_review_idx
  ON public.wa_logs (clinic_id, needs_human, replied_at DESC)
  WHERE needs_human = true;

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

    SELECT id INTO v_survey_id
    FROM public.nps_surveys
    WHERE clinic_id = NEW.clinic_id
      AND patient_id = NEW.patient_id
      AND nota IS NULL
    ORDER BY data DESC
    LIMIT 1
    FOR UPDATE;

    IF v_survey_id IS NULL THEN
      INSERT INTO public.nps_surveys (clinic_id, patient_id, nota, comentario, data)
      VALUES (NEW.clinic_id, NEW.patient_id, v_score, '', current_date)
      RETURNING id INTO v_survey_id;
    ELSE
      UPDATE public.nps_surveys
      SET nota = v_score
      WHERE id = v_survey_id;
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

DROP TRIGGER IF EXISTS trg_persist_nps_whatsapp_response ON public.wa_logs;
CREATE TRIGGER trg_persist_nps_whatsapp_response
AFTER UPDATE OF response_action, reply_text ON public.wa_logs
FOR EACH ROW
EXECUTE FUNCTION public.persist_nps_whatsapp_response();

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
    SELECT DISTINCT ON (a.paciente_id)
      a.paciente_id,
      p.telefone
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.paciente_id AND p.clinic_id = a.clinic_id
    WHERE a.clinic_id = v_clinic
      AND a.status = 'finalizado'
      AND a.data >= current_date - greatest(1, p_days)
      AND a.data <= current_date
      AND p.opt_in_whats = true
      AND p.anonimizado = false
      AND coalesce(trim(p.telefone), '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.wa_logs w
        WHERE w.clinic_id = v_clinic
          AND w.patient_id = a.paciente_id
          AND w.template = 'nps'
          AND w.created_at >= now() - make_interval(days => greatest(1, p_days))
          AND w.status IN ('fila','enviando','enviado','entregue','lido')
      )
    ORDER BY a.paciente_id, a.data DESC, a.inicio DESC
  LOOP
    v_message := public.render_message_template(v_clinic, 'nps', r.paciente_id, NULL, NULL);

    INSERT INTO public.nps_surveys (clinic_id, patient_id, nota, comentario, data)
    SELECT v_clinic, r.paciente_id, NULL, '', current_date
    WHERE NOT EXISTS (
      SELECT 1 FROM public.nps_surveys n
      WHERE n.clinic_id = v_clinic
        AND n.patient_id = r.paciente_id
        AND n.nota IS NULL
    );

    INSERT INTO public.wa_logs (
      clinic_id, patient_id, template, mensagem, telefone,
      enviado_em, status, scheduled_for, created_by
    ) VALUES (
      v_clinic, r.paciente_id, 'nps', v_message, r.telefone,
      now(), 'fila', now(), auth.uid()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_nps_surveys(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_nps_surveys(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_whatsapp_review(
  p_wa_log_id uuid,
  p_resolution text,
  p_note text DEFAULT NULL
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
  IF v_role NOT IN ('owner','admin','recep') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501';
  END IF;
  IF coalesce(trim(p_resolution), '') = '' THEN
    RAISE EXCEPTION 'Informe a resolução da revisão';
  END IF;

  UPDATE public.wa_logs
  SET needs_human = false,
      review_resolution = trim(p_resolution),
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      review_resolved_at = now(),
      review_resolved_by = auth.uid()
  WHERE id = p_wa_log_id
    AND clinic_id = v_clinic
    AND needs_human = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revisão não encontrada ou já concluída';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_whatsapp_review(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_whatsapp_review(uuid,text,text) TO authenticated;

COMMIT;
