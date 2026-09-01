-- MEDICSPRO — fluxo operacional e histórico de status da agenda
BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_status_history_appointment_idx
  ON public.appointment_status_history (appointment_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS appointment_status_history_clinic_idx
  ON public.appointment_status_history (clinic_id, changed_at DESC);

ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_status_history_select_tenant ON public.appointment_status_history;
CREATE POLICY appointment_status_history_select_tenant
ON public.appointment_status_history
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

GRANT SELECT ON public.appointment_status_history TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_role text;
  allowed boolean := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  app_role := public.current_app_role();

  -- Chamadas internas/service-role não possuem perfil de usuário e continuam permitidas.
  IF app_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF app_role IN ('owner', 'admin') THEN
    allowed := true;
  ELSIF app_role = 'recep' THEN
    allowed :=
      (OLD.status = 'agendado' AND NEW.status IN ('confirmado', 'faltou', 'cancelado'))
      OR (OLD.status = 'confirmado' AND NEW.status IN ('faltou', 'cancelado'));
  ELSIF app_role = 'fisio' THEN
    allowed :=
      (OLD.status = 'agendado' AND NEW.status IN ('confirmado', 'em_atendimento', 'faltou', 'cancelado'))
      OR (OLD.status = 'confirmado' AND NEW.status IN ('em_atendimento', 'faltou', 'cancelado'))
      OR (OLD.status = 'em_atendimento' AND NEW.status = 'finalizado');
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Transição de status não permitida para o perfil atual: % -> %', OLD.status, NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.appointment_status_history (
      clinic_id,
      appointment_id,
      from_status,
      to_status,
      changed_by
    ) VALUES (
      NEW.clinic_id,
      NEW.id,
      OLD.status::text,
      NEW.status::text,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_appointment_status_transition ON public.appointments;
CREATE TRIGGER trg_guard_appointment_status_transition
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_status_transition();

DROP TRIGGER IF EXISTS trg_audit_appointment_status_transition ON public.appointments;
CREATE TRIGGER trg_audit_appointment_status_transition
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.audit_appointment_status_transition();

REVOKE ALL ON FUNCTION public.guard_appointment_status_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_appointment_status_transition() FROM PUBLIC;

COMMIT;
