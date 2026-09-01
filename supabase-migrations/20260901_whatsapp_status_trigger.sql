-- MEDICSPRO — persistência robusta de status Evolution a partir dos eventos recebidos
BEGIN;

CREATE OR REPLACE FUNCTION public.apply_evolution_message_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id text;
  v_event_message_id text;
  v_status text;
  v_log_id uuid;
  v_now timestamptz := coalesce(NEW.created_at, now());
BEGIN
  IF NEW.event_type NOT IN ('MESSAGES_UPDATE','MESSAGES.UPDATE') THEN
    RETURN NEW;
  END IF;

  v_key_id := nullif(NEW.payload->'data'->>'keyId', '');
  v_event_message_id := nullif(NEW.payload->'data'->>'messageId', '');
  v_status := upper(coalesce(NEW.payload->'data'->>'status', ''));

  SELECT w.id INTO v_log_id
  FROM public.wa_logs w
  WHERE w.provider_message_id = v_key_id
     OR (v_event_message_id IS NOT NULL AND w.provider_message_id = v_event_message_id)
  ORDER BY CASE WHEN w.provider_message_id = v_key_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_log_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.wa_log_id IS DISTINCT FROM v_log_id THEN
    UPDATE public.wa_events
    SET wa_log_id = v_log_id,
        clinic_id = (SELECT clinic_id FROM public.wa_logs WHERE id = v_log_id),
        provider_message_id = coalesce(v_key_id, NEW.provider_message_id)
    WHERE id = NEW.id;
  END IF;

  IF v_status IN ('READ','PLAYED') THEN
    UPDATE public.wa_logs
    SET status = 'lido',
        provider_status = v_status,
        delivered_at = coalesce(delivered_at, v_now),
        read_at = coalesce(read_at, v_now)
    WHERE id = v_log_id
      AND status <> 'falhou';
  ELSIF v_status IN ('DELIVERY_ACK','DELIVERED') THEN
    UPDATE public.wa_logs
    SET status = CASE WHEN status = 'lido' THEN status ELSE 'entregue' END,
        provider_status = CASE WHEN status = 'lido' THEN provider_status ELSE v_status END,
        delivered_at = coalesce(delivered_at, v_now)
    WHERE id = v_log_id
      AND status <> 'falhou';
  ELSIF v_status IN ('SERVER_ACK','SENT','ACCEPTED') THEN
    UPDATE public.wa_logs
    SET status = CASE WHEN status IN ('lido','entregue') THEN status ELSE 'enviado' END,
        provider_status = CASE WHEN status IN ('lido','entregue') THEN provider_status ELSE v_status END,
        sent_at = coalesce(sent_at, v_now)
    WHERE id = v_log_id
      AND status <> 'falhou';
  ELSIF v_status LIKE '%ERROR%' OR v_status LIKE '%FAIL%' THEN
    UPDATE public.wa_logs
    SET status = 'falhou',
        provider_status = v_status,
        failed_at = coalesce(failed_at, v_now),
        error_message = coalesce(error_message, 'Evolution reportou status ' || v_status)
    WHERE id = v_log_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_evolution_message_status ON public.wa_events;
CREATE TRIGGER trg_apply_evolution_message_status
AFTER INSERT ON public.wa_events
FOR EACH ROW
EXECUTE FUNCTION public.apply_evolution_message_status();

-- Backfill histórico já recebido pela Evolution. READ vence DELIVERY_ACK/SERVER_ACK.
WITH ranked AS (
  SELECT
    w.id AS wa_log_id,
    e.created_at,
    upper(coalesce(e.payload->'data'->>'status','')) AS provider_status,
    row_number() OVER (
      PARTITION BY w.id
      ORDER BY
        CASE upper(coalesce(e.payload->'data'->>'status',''))
          WHEN 'READ' THEN 4
          WHEN 'PLAYED' THEN 4
          WHEN 'DELIVERY_ACK' THEN 3
          WHEN 'DELIVERED' THEN 3
          WHEN 'SERVER_ACK' THEN 2
          WHEN 'SENT' THEN 2
          WHEN 'ACCEPTED' THEN 2
          ELSE 1
        END DESC,
        e.created_at DESC
    ) AS rn
  FROM public.wa_events e
  JOIN public.wa_logs w
    ON w.provider_message_id = e.payload->'data'->>'keyId'
    OR w.provider_message_id = e.payload->'data'->>'messageId'
  WHERE e.event_type IN ('MESSAGES_UPDATE','MESSAGES.UPDATE')
), latest AS (
  SELECT * FROM ranked WHERE rn = 1
)
UPDATE public.wa_logs w
SET
  status = CASE
    WHEN l.provider_status IN ('READ','PLAYED') THEN 'lido'
    WHEN l.provider_status IN ('DELIVERY_ACK','DELIVERED') AND w.status <> 'lido' THEN 'entregue'
    WHEN l.provider_status IN ('SERVER_ACK','SENT','ACCEPTED') AND w.status NOT IN ('lido','entregue') THEN 'enviado'
    ELSE w.status
  END,
  provider_status = CASE
    WHEN l.provider_status IN ('READ','PLAYED','DELIVERY_ACK','DELIVERED','SERVER_ACK','SENT','ACCEPTED') THEN l.provider_status
    ELSE w.provider_status
  END,
  delivered_at = CASE
    WHEN l.provider_status IN ('READ','PLAYED','DELIVERY_ACK','DELIVERED') THEN coalesce(w.delivered_at, l.created_at)
    ELSE w.delivered_at
  END,
  read_at = CASE
    WHEN l.provider_status IN ('READ','PLAYED') THEN coalesce(w.read_at, l.created_at)
    ELSE w.read_at
  END
FROM latest l
WHERE w.id = l.wa_log_id;

UPDATE public.wa_events e
SET
  wa_log_id = w.id,
  clinic_id = w.clinic_id,
  provider_message_id = coalesce(nullif(e.payload->'data'->>'keyId',''), e.provider_message_id)
FROM public.wa_logs w
WHERE e.event_type IN ('MESSAGES_UPDATE','MESSAGES.UPDATE')
  AND e.wa_log_id IS NULL
  AND (
    w.provider_message_id = e.payload->'data'->>'keyId'
    OR w.provider_message_id = e.payload->'data'->>'messageId'
  );

COMMIT;
