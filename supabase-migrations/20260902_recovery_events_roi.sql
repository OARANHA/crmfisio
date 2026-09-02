-- MEDICSPRO — atribuição de receita recuperada e ROI operacional
BEGIN;

CREATE TABLE IF NOT EXISTS public.recovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'overdue_payment_recovered',
    'waitlist_slot_recovered',
    'reactivation_booking',
    'package_renewal'
  )),
  value_kind text NOT NULL DEFAULT 'pipeline' CHECK (value_kind IN ('pipeline','realized')),
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  source_id uuid NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  wa_log_id uuid REFERENCES public.wa_logs(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recovery_events_source_unique
  ON public.recovery_events (clinic_id, event_type, source_id);
CREATE INDEX IF NOT EXISTS recovery_events_clinic_date_idx
  ON public.recovery_events (clinic_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS recovery_events_patient_idx
  ON public.recovery_events (clinic_id, patient_id, occurred_at DESC);

ALTER TABLE public.recovery_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recovery_events_select_tenant ON public.recovery_events;
CREATE POLICY recovery_events_select_tenant
ON public.recovery_events
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

REVOKE ALL ON public.recovery_events FROM PUBLIC;
GRANT SELECT ON public.recovery_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.recovery_events TO service_role;

CREATE OR REPLACE FUNCTION public.capture_overdue_payment_recovery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'receber'
     AND NEW.status = 'pago'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND (OLD.status = 'atrasado' OR OLD.vencimento < current_date) THEN
    INSERT INTO public.recovery_events (
      clinic_id, patient_id, event_type, value_kind, amount,
      source_id, payment_id, occurred_at, metadata
    ) VALUES (
      NEW.clinic_id, NEW.patient_id, 'overdue_payment_recovered', 'realized', NEW.valor,
      NEW.id, NEW.id, now(), jsonb_build_object('previous_status', OLD.status, 'due_date', OLD.vencimento)
    ) ON CONFLICT (clinic_id, event_type, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_overdue_payment_recovery ON public.payments;
CREATE TRIGGER trg_capture_overdue_payment_recovery
AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.capture_overdue_payment_recovery();

CREATE OR REPLACE FUNCTION public.capture_waitlist_recovery_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id uuid;
  v_amount numeric(12,2) := 0;
BEGIN
  IF NEW.template = 'vaga_espera'
     AND NEW.response_action = 'waitlist_slot_booked'
     AND OLD.response_action IS DISTINCT FROM NEW.response_action THEN
    SELECT booked_appointment_id INTO v_appointment_id
    FROM public.waitlist_entries
    WHERE id = NEW.waitlist_id AND clinic_id = NEW.clinic_id;

    IF v_appointment_id IS NOT NULL THEN
      SELECT coalesce(valor,0) INTO v_amount
      FROM public.appointments
      WHERE id = v_appointment_id AND clinic_id = NEW.clinic_id;

      INSERT INTO public.recovery_events (
        clinic_id, patient_id, event_type, value_kind, amount,
        source_id, appointment_id, wa_log_id, occurred_at,
        metadata
      ) VALUES (
        NEW.clinic_id, NEW.patient_id, 'waitlist_slot_recovered', 'pipeline', v_amount,
        NEW.id, v_appointment_id, NEW.id, now(),
        jsonb_build_object('waitlist_id', NEW.waitlist_id, 'cancelled_slot_id', NEW.appointment_id)
      ) ON CONFLICT (clinic_id, event_type, source_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_waitlist_recovery_event ON public.wa_logs;
CREATE TRIGGER trg_capture_waitlist_recovery_event
AFTER UPDATE OF response_action ON public.wa_logs
FOR EACH ROW EXECUTE FUNCTION public.capture_waitlist_recovery_event();

CREATE OR REPLACE FUNCTION public.capture_reactivation_booking_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  IF NEW.status NOT IN ('agendado','confirmado') THEN
    RETURN NEW;
  END IF;

  SELECT w.id INTO v_log_id
  FROM public.wa_logs w
  WHERE w.clinic_id = NEW.clinic_id
    AND w.patient_id = NEW.paciente_id
    AND w.template = 'reativacao'
    AND w.response_action = 'reactivation_interest_yes'
    AND coalesce(w.replied_at, w.updated_at, w.created_at) >= now() - interval '45 days'
  ORDER BY coalesce(w.replied_at, w.updated_at, w.created_at) DESC
  LIMIT 1;

  IF v_log_id IS NOT NULL THEN
    INSERT INTO public.recovery_events (
      clinic_id, patient_id, event_type, value_kind, amount,
      source_id, appointment_id, wa_log_id, occurred_at
    ) VALUES (
      NEW.clinic_id, NEW.paciente_id, 'reactivation_booking', 'pipeline', coalesce(NEW.valor,0),
      NEW.id, NEW.id, v_log_id, now()
    ) ON CONFLICT (clinic_id, event_type, source_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_reactivation_booking_event ON public.appointments;
CREATE TRIGGER trg_capture_reactivation_booking_event
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.capture_reactivation_booking_event();

CREATE OR REPLACE FUNCTION public.capture_package_renewal_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.patient_packages p
    WHERE p.clinic_id = NEW.clinic_id
      AND p.patient_id = NEW.patient_id
      AND p.id <> NEW.id
      AND p.created_at < NEW.created_at
  ) THEN
    INSERT INTO public.recovery_events (
      clinic_id, patient_id, event_type, value_kind, amount,
      source_id, occurred_at, metadata
    ) VALUES (
      NEW.clinic_id, NEW.patient_id, 'package_renewal', 'realized', coalesce(NEW.valor_pago,0),
      NEW.id, NEW.created_at, jsonb_build_object('package_id', NEW.package_id, 'sessions', NEW.sessoes_totais)
    ) ON CONFLICT (clinic_id, event_type, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_package_renewal_event ON public.patient_packages;
CREATE TRIGGER trg_capture_package_renewal_event
AFTER INSERT ON public.patient_packages
FOR EACH ROW EXECUTE FUNCTION public.capture_package_renewal_event();

CREATE OR REPLACE FUNCTION public.get_recovery_roi(
  p_from date DEFAULT date_trunc('month', current_date)::date,
  p_to date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_result jsonb;
BEGIN
  IF v_clinic IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='42501';
  END IF;

  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'realized_amount', coalesce(sum(amount) FILTER (WHERE value_kind='realized'),0),
    'pipeline_amount', coalesce(sum(amount) FILTER (WHERE value_kind='pipeline'),0),
    'events', count(*),
    'overdue_payments', count(*) FILTER (WHERE event_type='overdue_payment_recovered'),
    'waitlist_slots', count(*) FILTER (WHERE event_type='waitlist_slot_recovered'),
    'reactivations', count(*) FILTER (WHERE event_type='reactivation_booking'),
    'package_renewals', count(*) FILTER (WHERE event_type='package_renewal')
  ) INTO v_result
  FROM public.recovery_events
  WHERE clinic_id = v_clinic
    AND occurred_at >= p_from::timestamptz
    AND occurred_at < (p_to + 1)::timestamptz;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_recovery_roi(date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recovery_roi(date,date) TO authenticated;

COMMIT;
