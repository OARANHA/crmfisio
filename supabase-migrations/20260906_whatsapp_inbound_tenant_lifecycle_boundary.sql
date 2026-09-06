-- MEDICSPRO — WhatsApp inbound tenant/lifecycle hardening
-- Resolve replies from the outbound ledger, never from a global patient-phone lookup.
-- Fail closed on ambiguous phone ownership and require an active clinic + effective WhatsApp entitlement.

BEGIN;

CREATE OR REPLACE FUNCTION public.process_whatsapp_inbound(
  p_remote_jid text,
  p_message_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_patient_count integer := 0;
  v_clinic_count integer := 0;
BEGIN
  IF v_remote_raw = '' OR v_text = '' THEN
    RETURN jsonb_build_object('matched', false, 'action', 'empty');
  END IF;

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

  WITH candidates AS (
    SELECT l.id, l.patient_id, l.clinic_id
    FROM public.wa_logs l
    JOIN public.patients p
      ON p.id = l.patient_id
     AND p.clinic_id = l.clinic_id
    JOIN public.clinics c ON c.id = l.clinic_id
    CROSS JOIN LATERAL (
      SELECT regexp_replace(coalesce(l.telefone,''), '\D', '', 'g') AS digits
    ) raw
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN left(raw.digits, 2) = '55' AND length(raw.digits) IN (12, 13)
          THEN substr(raw.digits, 3)
        ELSE raw.digits
      END AS national
    ) normalized
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN length(normalized.national) = 11 AND substr(normalized.national, 3, 1) = '9'
          THEN substr(normalized.national, 1, 2) || substr(normalized.national, 4)
        ELSE normalized.national
      END AS canonical
    ) phone
    WHERE l.template IN ('confirmacao','vaga_espera','nps','reativacao')
      AND l.status IN ('enviado','entregue','lido')
      AND l.sent_at >= now() - interval '14 days'
      AND l.patient_id IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.anonimizado = false
      AND c.deleted_at IS NULL
      AND c.lifecycle_status = 'active'
      AND public.clinic_entitlement_allowed(l.clinic_id, 'whatsapp.access')
      AND (normalized.national = v_remote_national OR phone.canonical = v_remote_canonical)
  )
  SELECT count(DISTINCT patient_id), count(DISTINCT clinic_id)
    INTO v_patient_count, v_clinic_count
  FROM candidates;

  IF v_patient_count = 0 THEN
    RETURN jsonb_build_object('matched', false, 'action', 'outbound_not_found');
  END IF;

  IF v_patient_count > 1 OR v_clinic_count > 1 THEN
    RETURN jsonb_build_object('matched', false, 'action', 'ambiguous_recipient');
  END IF;

  SELECT l.*, l.patient_id
    INTO v_log, v_patient
  FROM public.wa_logs l
  JOIN public.patients p
    ON p.id = l.patient_id
   AND p.clinic_id = l.clinic_id
  JOIN public.clinics c ON c.id = l.clinic_id
  CROSS JOIN LATERAL (
    SELECT regexp_replace(coalesce(l.telefone,''), '\D', '', 'g') AS digits
  ) raw
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN left(raw.digits, 2) = '55' AND length(raw.digits) IN (12, 13)
        THEN substr(raw.digits, 3)
      ELSE raw.digits
    END AS national
  ) normalized
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN length(normalized.national) = 11 AND substr(normalized.national, 3, 1) = '9'
        THEN substr(normalized.national, 1, 2) || substr(normalized.national, 4)
      ELSE normalized.national
    END AS canonical
  ) phone
  WHERE l.template IN ('confirmacao','vaga_espera','nps','reativacao')
    AND l.status IN ('enviado','entregue','lido')
    AND l.sent_at >= now() - interval '14 days'
    AND l.patient_id IS NOT NULL
    AND p.deleted_at IS NULL
    AND p.anonimizado = false
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active'
    AND public.clinic_entitlement_allowed(l.clinic_id, 'whatsapp.access')
    AND (normalized.national = v_remote_national OR phone.canonical = v_remote_canonical)
  ORDER BY l.sent_at DESC NULLS LAST, l.created_at DESC, l.id DESC
  LIMIT 1
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false, 'action', 'outbound_not_found');
  END IF;

  v_confirm := v_text ~ '^(sim|s|ok|confirmo|confirmado|pode|pode sim|pode confirmar|quero)$';

  IF v_log.template = 'confirmacao' THEN
    IF v_confirm THEN
      UPDATE public.appointments
      SET status = 'confirmado'
      WHERE id = v_log.appointment_id
        AND clinic_id = v_log.clinic_id
        AND paciente_id = v_log.patient_id
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
    'clinic_id', v_log.clinic_id,
    'wa_log_id', v_log.id,
    'template', v_log.template,
    'action', v_action,
    'appointment_id', v_log.appointment_id,
    'waitlist_id', v_log.waitlist_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_whatsapp_inbound(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_whatsapp_inbound(text,text) TO service_role;

COMMENT ON FUNCTION public.process_whatsapp_inbound(text,text) IS
  'Service-role inbound processor. Resolves replies from recent outbound ledger rows, fails closed on tenant ambiguity, and requires active clinic + WhatsApp entitlement.';

COMMIT;
