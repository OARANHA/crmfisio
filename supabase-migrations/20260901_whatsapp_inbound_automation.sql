-- MEDICSPRO — respostas inbound do WhatsApp: confirmação segura e triagem operacional
BEGIN;

ALTER TABLE public.wa_logs
  ADD COLUMN IF NOT EXISTS reply_text text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS response_action text,
  ADD COLUMN IF NOT EXISTS needs_human boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS wa_logs_reply_lookup_idx
  ON public.wa_logs (patient_id, template, sent_at DESC)
  WHERE sent_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_whatsapp_inbound(
  p_remote_jid text,
  p_message_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remote_raw text := regexp_replace(split_part(coalesce(p_remote_jid,''),'@',1), '\D', '', 'g');
  v_remote_national text;
  v_remote_canonical text;
  v_text text := lower(trim(coalesce(p_message_text,'')));
  v_patient uuid;
  v_log public.wa_logs%ROWTYPE;
  v_action text := 'unrecognized';
  v_confirm boolean := false;
BEGIN
  IF v_remote_raw = '' OR v_text = '' THEN
    RETURN jsonb_build_object('matched', false, 'action', 'empty');
  END IF;

  -- A Evolution/WhatsApp pode devolver números brasileiros sem o 9 adicional
  -- do celular (ex.: 55 51 9010-4506), enquanto o cadastro conserva
  -- 51 99010-4506. Normalizamos ambos para DDD + 8 dígitos.
  v_remote_national := CASE
    WHEN left(v_remote_raw, 2) = '55' AND length(v_remote_raw) IN (12, 13)
      THEN substr(v_remote_raw, 3)
    ELSE v_remote_raw
  END;
  v_remote_canonical := CASE
    WHEN length(v_remote_national) = 11 AND substr(v_remote_national, 3, 1) = '9'
      THEN substr(v_remote_national, 1, 2) || substr(v_remote_national, 4)
    ELSE v_remote_national
  END;

  WITH patient_phones AS (
    SELECT
      p.id,
      p.updated_at,
      regexp_replace(p.telefone, '\D', '', 'g') AS digits
    FROM public.patients p
    WHERE p.anonimizado = false
      AND coalesce(trim(p.telefone),'') <> ''
  ), national AS (
    SELECT
      id,
      updated_at,
      CASE
        WHEN left(digits, 2) = '55' AND length(digits) IN (12, 13)
          THEN substr(digits, 3)
        ELSE digits
      END AS phone_national
    FROM patient_phones
  ), canonical AS (
    SELECT
      id,
      updated_at,
      phone_national,
      CASE
        WHEN length(phone_national) = 11 AND substr(phone_national, 3, 1) = '9'
          THEN substr(phone_national, 1, 2) || substr(phone_national, 4)
        ELSE phone_national
      END AS phone_canonical
    FROM national
  )
  SELECT c.id INTO v_patient
  FROM canonical c
  WHERE c.phone_national = v_remote_national
     OR c.phone_canonical = v_remote_canonical
  ORDER BY c.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object(
      'matched', false,
      'action', 'patient_not_found',
      'remote_national', v_remote_national,
      'remote_canonical', v_remote_canonical
    );
  END IF;

  SELECT * INTO v_log
  FROM public.wa_logs
  WHERE patient_id = v_patient
    AND template IN ('confirmacao','vaga_espera','nps','reativacao')
    AND status IN ('enviado','entregue','lido')
    AND sent_at >= now() - interval '14 days'
  ORDER BY sent_at DESC NULLS LAST, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false, 'patient_id', v_patient, 'action', 'outbound_not_found');
  END IF;

  v_confirm := v_text ~ '^(sim|s|ok|confirmo|confirmado|pode|pode sim|pode confirmar|quero)$';

  IF v_log.template = 'confirmacao' THEN
    IF v_confirm THEN
      UPDATE public.appointments
      SET status = 'confirmado'
      WHERE id = v_log.appointment_id
        AND clinic_id = v_log.clinic_id
        AND status = 'agendado';
      v_action := 'appointment_confirmed';
    ELSIF v_text ~ '^(nao|não|n|nao posso|não posso|cancelar|cancela)$' THEN
      v_action := 'appointment_declined_review';
    ELSE
      v_action := 'confirmation_needs_human';
    END IF;
  ELSIF v_log.template = 'vaga_espera' THEN
    IF v_confirm THEN
      v_action := 'waitlist_interest_yes';
    ELSIF v_text ~ '^(nao|não|n|nao quero|não quero)$' THEN
      v_action := 'waitlist_interest_no';
    ELSE
      v_action := 'waitlist_needs_human';
    END IF;
  ELSIF v_log.template = 'nps' AND v_text ~ '^(10|[0-9])$' THEN
    v_action := 'nps_score_received';
  ELSE
    v_action := 'needs_human';
  END IF;

  UPDATE public.wa_logs
  SET reply_text = p_message_text,
      replied_at = now(),
      response_action = v_action,
      needs_human = v_action IN (
        'appointment_declined_review','confirmation_needs_human',
        'waitlist_interest_yes','waitlist_interest_no','waitlist_needs_human',
        'nps_score_received','needs_human'
      )
  WHERE id = v_log.id;

  RETURN jsonb_build_object(
    'matched', true,
    'patient_id', v_patient,
    'wa_log_id', v_log.id,
    'template', v_log.template,
    'action', v_action,
    'appointment_id', v_log.appointment_id,
    'waitlist_id', v_log.waitlist_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_whatsapp_inbound(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_whatsapp_inbound(text,text) TO service_role;

COMMIT;
