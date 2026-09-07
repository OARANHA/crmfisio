-- MEDICSPRO — P1 WhatsApp uncertain-delivery reconciliation
-- Prevents blind retries after a worker crash/network ambiguity and lets
-- outbound provider events recover the unique matching outbox record.

BEGIN;

CREATE OR REPLACE FUNCTION public.requeue_stale_messages(p_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  -- Once a row reached `enviando`, the HTTP request may already have been
  -- accepted by the provider even if the worker died before persisting the ID.
  -- Re-enqueueing here can therefore duplicate a real WhatsApp message.
  UPDATE public.wa_logs
     SET status = 'falhou',
         failed_at = coalesce(failed_at, now()),
         provider_status = 'DELIVERY_UNCERTAIN',
         error_message = 'Envio com resultado incerto; aguardando reconciliação do provedor'
   WHERE status = 'enviando'
     AND last_attempt_at < now() - make_interval(mins => greatest(1, p_minutes));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_stale_messages(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale_messages(integer) TO service_role;

COMMENT ON FUNCTION public.requeue_stale_messages(integer) IS
  'Legacy name retained for worker compatibility. Stale sending rows are quarantined as DELIVERY_UNCERTAIN instead of being blindly requeued.';

CREATE OR REPLACE FUNCTION public.reconcile_whatsapp_outbound_event(
  p_provider_message_id text,
  p_remote_jid text,
  p_message_text text
)
RETURNS TABLE(wa_log_id uuid, clinic_id uuid, prior_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_message_id text := nullif(trim(coalesce(p_provider_message_id, '')), '');
  v_remote_digits text := regexp_replace(coalesce(p_remote_jid, ''), '\D', '', 'g');
  v_message_text text := coalesce(p_message_text, '');
  v_candidate uuid;
  v_clinic uuid;
  v_prior_status text;
  v_count integer;
BEGIN
  IF v_provider_message_id IS NULL OR v_remote_digits = '' OR v_message_text = '' THEN
    RETURN;
  END IF;

  WITH candidates AS (
    SELECT w.id, w.clinic_id, w.status
    FROM public.wa_logs w
    JOIN public.patients p
      ON p.id = w.patient_id
     AND p.clinic_id = w.clinic_id
    CROSS JOIN LATERAL (
      SELECT regexp_replace(coalesce(p.telefone, ''), '\D', '', 'g') AS digits
    ) phone
    WHERE w.provider_message_id IS NULL
      AND w.mensagem = v_message_text
      AND w.last_attempt_at >= now() - interval '6 hours'
      AND w.last_attempt_at <= now() + interval '1 minute'
      AND (
        w.status = 'enviando'
        OR (w.status = 'falhou' AND w.provider_status = 'DELIVERY_UNCERTAIN')
      )
      AND (
        CASE
          WHEN length(phone.digits) IN (10, 11) AND left(phone.digits, 2) <> '55'
            THEN '55' || phone.digits
          ELSE phone.digits
        END
      ) = v_remote_digits
  )
  SELECT count(*), min(id), min(clinic_id), min(status)
    INTO v_count, v_candidate, v_clinic, v_prior_status
  FROM candidates;

  -- Ambiguous matches are deliberately left unresolved; a wrong automatic
  -- correlation is worse than a message remaining flagged for review.
  IF v_count <> 1 OR v_candidate IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.wa_logs
     SET status = 'enviado',
         provider = 'evolution',
         provider_message_id = v_provider_message_id,
         provider_event = 'RECONCILED_OUTBOUND_EVENT',
         provider_status = 'RECONCILED',
         sent_at = coalesce(sent_at, now()),
         failed_at = NULL,
         error_message = NULL
   WHERE id = v_candidate
     AND provider_message_id IS NULL;

  IF FOUND THEN
    wa_log_id := v_candidate;
    clinic_id := v_clinic;
    prior_status := v_prior_status;
    RETURN NEXT;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_whatsapp_outbound_event(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_whatsapp_outbound_event(text,text,text) TO service_role;

COMMENT ON FUNCTION public.reconcile_whatsapp_outbound_event(text,text,text) IS
  'Links one unique uncertain/sending outbox row to an outbound Evolution event by exact text, normalized recipient and recent attempt window; ambiguous matches fail closed.';

COMMIT;
