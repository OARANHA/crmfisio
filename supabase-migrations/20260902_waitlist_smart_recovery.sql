-- MEDICSPRO — recuperação inteligente de vagas da lista de espera
BEGIN;

ALTER TABLE public.wa_logs
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS wa_logs_waitlist_offer_expiry_idx
  ON public.wa_logs (clinic_id, template, offer_expires_at)
  WHERE template = 'vaga_espera' AND offer_expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.expire_waitlist_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.wa_logs
    SET status = 'cancelado',
        response_action = coalesce(response_action, 'waitlist_offer_expired'),
        needs_human = false,
        updated_at = now()
    WHERE template = 'vaga_espera'
      AND offer_expires_at IS NOT NULL
      AND offer_expires_at < now()
      AND reply_text IS NULL
      AND status IN ('fila','enviando','enviado','entregue','lido')
    RETURNING waitlist_id
  )
  SELECT count(*) INTO v_count FROM expired;

  UPDATE public.waitlist_entries w
  SET status = 'aguardando', offered_at = NULL
  WHERE w.status = 'ofertado'
    AND w.booked_appointment_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.wa_logs l
      WHERE l.waitlist_id = w.id
        AND l.template = 'vaga_espera'
        AND l.status IN ('fila','enviando','enviado','entregue','lido')
        AND (l.offer_expires_at IS NULL OR l.offer_expires_at >= now())
    );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_waitlist_offers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_waitlist_offers() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.queue_waitlist_offer(
  p_waitlist_id uuid,
  p_cancelled_appointment_id uuid,
  p_expiry_minutes integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_wait public.waitlist_entries%ROWTYPE;
  v_slot public.appointments%ROWTYPE;
  v_optin boolean;
  v_phone text;
  v_message text;
  v_id uuid;
BEGIN
  IF v_role NOT IN ('owner','admin','recep') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501';
  END IF;

  PERFORM public.expire_waitlist_offers();

  SELECT * INTO v_wait
  FROM public.waitlist_entries
  WHERE id = p_waitlist_id
  FOR UPDATE;

  IF NOT FOUND OR v_wait.clinic_id IS DISTINCT FROM v_clinic OR v_wait.status NOT IN ('aguardando','ofertado') THEN
    RAISE EXCEPTION 'Entrada da espera indisponível';
  END IF;

  SELECT * INTO v_slot
  FROM public.appointments
  WHERE id = p_cancelled_appointment_id
  FOR UPDATE;

  IF NOT FOUND OR v_slot.clinic_id IS DISTINCT FROM v_clinic OR v_slot.status <> 'cancelado' THEN
    RAISE EXCEPTION 'Vaga não está mais disponível';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.clinic_id = v_clinic
      AND a.id <> v_slot.id
      AND a.status <> 'cancelado'
      AND a.data = v_slot.data
      AND (a.fisio_id = v_slot.fisio_id OR a.room_id = v_slot.room_id)
      AND a.inicio < v_slot.fim
      AND a.fim > v_slot.inicio
  ) THEN
    RAISE EXCEPTION 'Vaga já foi ocupada';
  END IF;

  SELECT opt_in_whats, telefone INTO v_optin, v_phone
  FROM public.patients
  WHERE id = v_wait.patient_id
    AND clinic_id = v_clinic
    AND anonimizado = false;

  IF coalesce(v_optin,false) = false OR coalesce(trim(v_phone),'') = '' THEN
    RAISE EXCEPTION 'Paciente sem WhatsApp elegível' USING ERRCODE='42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.wa_logs l
    WHERE l.waitlist_id = v_wait.id
      AND l.appointment_id = v_slot.id
      AND l.template = 'vaga_espera'
      AND l.status IN ('fila','enviando','enviado','entregue','lido')
      AND (l.offer_expires_at IS NULL OR l.offer_expires_at >= now())
  ) THEN
    RAISE EXCEPTION 'Oferta já enviada para este paciente';
  END IF;

  PERFORM public.ensure_default_message_templates();
  v_message := public.render_message_template(v_clinic,'vaga_espera',v_wait.patient_id,v_slot.id,v_slot.fisio_id);
  IF v_message NOT ILIKE '%minut%' THEN
    v_message := v_message || format(' Esta oferta fica reservada por %s minutos e será confirmada para o primeiro paciente que aceitar.', greatest(5, least(coalesce(p_expiry_minutes,30),120)));
  END IF;

  INSERT INTO public.wa_logs (
    clinic_id, patient_id, appointment_id, waitlist_id, template, mensagem,
    enviado_em, status, scheduled_for, created_by, offer_expires_at
  ) VALUES (
    v_clinic, v_wait.patient_id, v_slot.id, v_wait.id, 'vaga_espera', v_message,
    now(), 'fila', now(), auth.uid(), now() + make_interval(mins => greatest(5, least(coalesce(p_expiry_minutes,30),120)))
  ) RETURNING id INTO v_id;

  UPDATE public.waitlist_entries
  SET status = 'ofertado', offered_at = now()
  WHERE id = v_wait.id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_waitlist_offer(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_waitlist_offer(uuid,uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.queue_waitlist_slot_offers(
  p_cancelled_appointment_id uuid,
  p_limit integer DEFAULT 3,
  p_expiry_minutes integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_slot public.appointments%ROWTYPE;
  v_unit uuid;
  v_count integer := 0;
  r record;
BEGIN
  IF v_role NOT IN ('owner','admin','recep') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501';
  END IF;

  PERFORM public.expire_waitlist_offers();

  SELECT * INTO v_slot
  FROM public.appointments
  WHERE id = p_cancelled_appointment_id
    AND clinic_id = v_clinic
  FOR UPDATE;

  IF NOT FOUND OR v_slot.status <> 'cancelado' THEN
    RAISE EXCEPTION 'Vaga não está mais disponível';
  END IF;

  SELECT unit_id INTO v_unit FROM public.rooms WHERE id = v_slot.room_id AND clinic_id = v_clinic;

  FOR r IN
    SELECT w.id
    FROM public.waitlist_entries w
    JOIN public.patients p ON p.id = w.patient_id AND p.clinic_id = w.clinic_id
    WHERE w.clinic_id = v_clinic
      AND w.status = 'aguardando'
      AND p.anonimizado = false
      AND p.opt_in_whats = true
      AND coalesce(trim(p.telefone),'') <> ''
      AND (w.professional_id IS NULL OR w.professional_id = v_slot.fisio_id)
      AND (w.unit_id IS NULL OR w.unit_id = v_unit)
      AND (cardinality(w.preferred_days) = 0 OR extract(isodow from v_slot.data)::smallint = ANY(w.preferred_days))
      AND (
        w.period = 'qualquer'
        OR (w.period = 'manha' AND v_slot.inicio < time '12:00')
        OR (w.period = 'tarde' AND v_slot.inicio >= time '12:00' AND v_slot.inicio < time '18:00')
        OR (w.period = 'noite' AND v_slot.inicio >= time '18:00')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.clinic_id = v_clinic
          AND a.paciente_id = w.patient_id
          AND a.status <> 'cancelado'
          AND a.data = v_slot.data
          AND a.inicio < v_slot.fim
          AND a.fim > v_slot.inicio
      )
    ORDER BY w.priority DESC, w.created_at ASC
    LIMIT greatest(1, least(coalesce(p_limit,3),10))
  LOOP
    PERFORM public.queue_waitlist_offer(r.id, v_slot.id, p_expiry_minutes);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_waitlist_slot_offers(uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_waitlist_slot_offers(uuid,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_waitlist_offer_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wait public.waitlist_entries%ROWTYPE;
  v_slot public.appointments%ROWTYPE;
  v_new public.appointments%ROWTYPE;
BEGIN
  IF NEW.template <> 'vaga_espera' OR NEW.response_action <> 'waitlist_interest_yes' OR NEW.reply_text IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.offer_expires_at IS NOT NULL AND NEW.offer_expires_at < now() THEN
    UPDATE public.wa_logs SET response_action='waitlist_offer_expired', needs_human=true WHERE id=NEW.id;
    UPDATE public.waitlist_entries SET status='aguardando', offered_at=NULL WHERE id=NEW.waitlist_id AND booked_appointment_id IS NULL;
    RETURN NEW;
  END IF;

  SELECT * INTO v_slot FROM public.appointments WHERE id=NEW.appointment_id FOR UPDATE;
  SELECT * INTO v_wait FROM public.waitlist_entries WHERE id=NEW.waitlist_id FOR UPDATE;

  IF NOT FOUND OR v_slot.id IS NULL OR v_wait.id IS NULL
     OR v_slot.clinic_id IS DISTINCT FROM NEW.clinic_id
     OR v_wait.clinic_id IS DISTINCT FROM NEW.clinic_id
     OR v_wait.patient_id IS DISTINCT FROM NEW.patient_id
     OR v_slot.status <> 'cancelado'
     OR v_wait.status NOT IN ('aguardando','ofertado') THEN
    UPDATE public.wa_logs SET response_action='waitlist_slot_unavailable', needs_human=true WHERE id=NEW.id;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.clinic_id = NEW.clinic_id
      AND a.id <> v_slot.id
      AND a.status <> 'cancelado'
      AND a.data = v_slot.data
      AND (a.fisio_id = v_slot.fisio_id OR a.room_id = v_slot.room_id OR a.paciente_id = v_wait.patient_id)
      AND a.inicio < v_slot.fim
      AND a.fim > v_slot.inicio
  ) THEN
    UPDATE public.wa_logs SET response_action='waitlist_slot_unavailable', needs_human=true WHERE id=NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.appointments (
    clinic_id, paciente_id, fisio_id, room_id, data, inicio, fim, status,
    tipo, valor, pacote_id, serie_id, notas, is_fit_in
  ) VALUES (
    v_slot.clinic_id, v_wait.patient_id, v_slot.fisio_id, v_slot.room_id,
    v_slot.data, v_slot.inicio, v_slot.fim, 'confirmado', v_slot.tipo, v_slot.valor,
    NULL, NULL, concat_ws(E'\n', NULLIF(v_wait.notes,''), 'Vaga recuperada automaticamente pela lista de espera.'), true
  ) RETURNING * INTO v_new;

  UPDATE public.waitlist_entries
  SET status='agendado', booked_appointment_id=v_new.id
  WHERE id=v_wait.id;

  UPDATE public.wa_logs
  SET response_action='waitlist_slot_booked', needs_human=false
  WHERE id=NEW.id;

  UPDATE public.wa_logs
  SET status='cancelado', response_action='waitlist_offer_taken', needs_human=false
  WHERE id<>NEW.id
    AND appointment_id=v_slot.id
    AND template='vaga_espera'
    AND status IN ('fila','enviando','enviado','entregue','lido')
    AND reply_text IS NULL;

  UPDATE public.waitlist_entries w
  SET status='aguardando', offered_at=NULL
  WHERE w.id <> v_wait.id
    AND w.status='ofertado'
    AND w.booked_appointment_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.wa_logs l
      WHERE l.waitlist_id=w.id
        AND l.appointment_id=v_slot.id
        AND l.template='vaga_espera'
        AND l.response_action='waitlist_offer_taken'
    );

  RETURN NEW;
EXCEPTION WHEN unique_violation OR exclusion_violation THEN
  UPDATE public.wa_logs SET response_action='waitlist_slot_unavailable', needs_human=true WHERE id=NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalize_waitlist_offer_reply ON public.wa_logs;
CREATE TRIGGER trg_finalize_waitlist_offer_reply
AFTER UPDATE OF reply_text ON public.wa_logs
FOR EACH ROW
WHEN (NEW.template = 'vaga_espera' AND NEW.reply_text IS NOT NULL)
EXECUTE FUNCTION public.finalize_waitlist_offer_reply();

REVOKE ALL ON FUNCTION public.finalize_waitlist_offer_reply() FROM PUBLIC;

COMMIT;
