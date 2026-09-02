-- MEDICSPRO — recuperação automática de vagas canceladas via lista de espera
BEGIN;

ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS waitlist_auto_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waitlist_offer_limit integer NOT NULL DEFAULT 3 CHECK (waitlist_offer_limit BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS waitlist_expiry_minutes integer NOT NULL DEFAULT 30 CHECK (waitlist_expiry_minutes BETWEEN 5 AND 120);

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS queued_waitlist_offers integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.run_waitlist_auto_recovery_tick(p_run_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.automation_settings%ROWTYPE;
  slot record;
  candidate record;
  v_now_local timestamp;
  v_unit uuid;
  v_message text;
  v_slot_count integer;
  v_total integer := 0;
BEGIN
  FOR cfg IN
    SELECT *
    FROM public.automation_settings
    WHERE active = true
      AND waitlist_auto_enabled = true
    ORDER BY clinic_id
  LOOP
    v_now_local := timezone(cfg.timezone, now());

    IF v_now_local::time < cfg.send_window_start OR v_now_local::time >= cfg.send_window_end THEN
      CONTINUE;
    END IF;

    FOR slot IN
      SELECT a.*
      FROM public.appointments a
      WHERE a.clinic_id = cfg.clinic_id
        AND a.status = 'cancelado'
        AND (a.data + a.inicio) >= v_now_local
        AND NOT EXISTS (
          SELECT 1
          FROM public.appointments occupied
          WHERE occupied.clinic_id = a.clinic_id
            AND occupied.id <> a.id
            AND occupied.status <> 'cancelado'
            AND occupied.data = a.data
            AND (occupied.fisio_id = a.fisio_id OR occupied.room_id = a.room_id)
            AND occupied.inicio < a.fim
            AND occupied.fim > a.inicio
        )
      ORDER BY a.data, a.inicio
    LOOP
      SELECT r.unit_id INTO v_unit
      FROM public.rooms r
      WHERE r.id = slot.room_id
        AND r.clinic_id = cfg.clinic_id;

      v_slot_count := 0;

      FOR candidate IN
        SELECT w.id AS waitlist_id, w.patient_id
        FROM public.waitlist_entries w
        JOIN public.patients p
          ON p.id = w.patient_id
         AND p.clinic_id = w.clinic_id
        WHERE w.clinic_id = cfg.clinic_id
          AND w.status IN ('aguardando','ofertado')
          AND w.booked_appointment_id IS NULL
          AND p.anonimizado = false
          AND p.opt_in_whats = true
          AND coalesce(trim(p.telefone),'') <> ''
          AND (w.professional_id IS NULL OR w.professional_id = slot.fisio_id)
          AND (w.unit_id IS NULL OR w.unit_id = v_unit)
          AND (coalesce(cardinality(w.preferred_days),0) = 0 OR extract(isodow from slot.data)::smallint = ANY(w.preferred_days))
          AND (
            w.period = 'qualquer'
            OR (w.period = 'manha' AND slot.inicio < time '12:00')
            OR (w.period = 'tarde' AND slot.inicio >= time '12:00' AND slot.inicio < time '18:00')
            OR (w.period = 'noite' AND slot.inicio >= time '18:00')
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.appointments pa
            WHERE pa.clinic_id = cfg.clinic_id
              AND pa.paciente_id = w.patient_id
              AND pa.status <> 'cancelado'
              AND pa.data = slot.data
              AND pa.inicio < slot.fim
              AND pa.fim > slot.inicio
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.wa_logs prior
            WHERE prior.clinic_id = cfg.clinic_id
              AND prior.waitlist_id = w.id
              AND prior.appointment_id = slot.id
              AND prior.template = 'vaga_espera'
          )
        ORDER BY w.priority DESC, w.created_at ASC
        LIMIT cfg.waitlist_offer_limit
      LOOP
        v_message := public.render_message_template(
          cfg.clinic_id,
          'vaga_espera',
          candidate.patient_id,
          slot.id,
          slot.fisio_id
        );

        IF v_message NOT ILIKE '%minut%' THEN
          v_message := v_message || format(
            ' Esta oferta fica reservada por %s minutos e será confirmada para o primeiro paciente que aceitar.',
            cfg.waitlist_expiry_minutes
          );
        END IF;

        INSERT INTO public.wa_logs (
          clinic_id,
          patient_id,
          appointment_id,
          waitlist_id,
          template,
          mensagem,
          enviado_em,
          status,
          scheduled_for,
          created_by,
          offer_expires_at
        ) VALUES (
          cfg.clinic_id,
          candidate.patient_id,
          slot.id,
          candidate.waitlist_id,
          'vaga_espera',
          v_message,
          now(),
          'fila',
          now(),
          NULL,
          now() + make_interval(mins => cfg.waitlist_expiry_minutes)
        );

        UPDATE public.waitlist_entries
        SET status = 'ofertado', offered_at = now()
        WHERE id = candidate.waitlist_id;

        v_slot_count := v_slot_count + 1;
        v_total := v_total + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  IF p_run_id IS NOT NULL THEN
    UPDATE public.automation_runs
    SET queued_waitlist_offers = v_total
    WHERE id = p_run_id;
  END IF;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.run_waitlist_auto_recovery_tick(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_waitlist_auto_recovery_tick(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_waitlist_auto_recovery_tick(uuid) TO service_role;

COMMIT;
