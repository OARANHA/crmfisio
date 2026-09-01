-- MEDICSPRO — processamento seguro da outbox + eventos do provedor Evolution
BEGIN;

ALTER TABLE public.wa_logs
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_event text,
  ADD COLUMN IF NOT EXISTS provider_status text;

CREATE TABLE IF NOT EXISTS public.wa_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  wa_log_id uuid REFERENCES public.wa_logs(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'evolution',
  instance_name text,
  event_type text NOT NULL,
  provider_message_id text,
  remote_jid text,
  from_me boolean,
  message_text text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_events_message_idx ON public.wa_events(provider_message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_events_clinic_idx ON public.wa_events(clinic_id, created_at DESC);

ALTER TABLE public.wa_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_events_select_tenant ON public.wa_events;
CREATE POLICY wa_events_select_tenant ON public.wa_events
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());
GRANT SELECT ON public.wa_events TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_message_outbox(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  clinic_id uuid,
  patient_id uuid,
  appointment_id uuid,
  waitlist_id uuid,
  template text,
  mensagem text,
  telefone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT w.id
    FROM public.wa_logs w
    WHERE w.status = 'fila'
      AND w.scheduled_for <= now()
    ORDER BY w.scheduled_for, w.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit,20),100))
  ), claimed AS (
    UPDATE public.wa_logs w
       SET status = 'enviando',
           provider = 'evolution',
           attempt_count = coalesce(w.attempt_count,0) + 1,
           last_attempt_at = now(),
           error_message = NULL
      FROM picked p
     WHERE w.id = p.id
    RETURNING w.*
  )
  SELECT c.id, c.clinic_id, c.patient_id, c.appointment_id, c.waitlist_id,
         c.template, c.mensagem, p.telefone
    FROM claimed c
    JOIN public.patients p ON p.id = c.patient_id AND p.clinic_id = c.clinic_id
   WHERE p.opt_in_whats = true
     AND coalesce(trim(p.telefone),'') <> '';
END;
$$;
REVOKE ALL ON FUNCTION public.claim_message_outbox(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_message_outbox(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.requeue_stale_messages(p_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.wa_logs
     SET status='fila',
         error_message='Reenfileirada após timeout de processamento'
   WHERE status='enviando'
     AND last_attempt_at < now() - make_interval(mins => greatest(1,p_minutes));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.requeue_stale_messages(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requeue_stale_messages(integer) TO service_role;

COMMIT;
