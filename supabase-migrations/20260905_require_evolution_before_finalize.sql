-- MEDICSPRO — require a clinical evolution before an authenticated care session can be finalized
-- Closes the gap where UI required evolution but a direct authorized status mutation could bypass it.

BEGIN;

CREATE OR REPLACE FUNCTION public.require_evolution_before_appointment_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- This boundary applies to the authenticated clinical workflow only.
  -- Internal/service operations have no app role and remain unchanged.
  IF v_role = 'fisio'
     AND OLD.status = 'em_atendimento'
     AND NEW.status = 'finalizado' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.physiotherapy_evolutions e
      WHERE e.session_id = NEW.id
        AND e.clinic_id = NEW.clinic_id
        AND e.patient_id = NEW.paciente_id
        AND e.professional_id = auth.uid()
        AND e.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Registre a evolução clínica desta sessão antes de finalizar o atendimento'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.require_evolution_before_appointment_finalize() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_require_evolution_before_appointment_finalize ON public.appointments;
CREATE TRIGGER trg_require_evolution_before_appointment_finalize
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.require_evolution_before_appointment_finalize();

COMMENT ON FUNCTION public.require_evolution_before_appointment_finalize() IS
  'Authenticated fisio must have one active evolution authored by self for the same clinic/patient/session before em_atendimento -> finalizado.';

COMMIT;
