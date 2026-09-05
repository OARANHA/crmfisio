-- MEDICSPRO — clinical evolution/session linkage hardening
-- Prevent authenticated clinical evolutions from being linked to the wrong
-- patient, professional, clinic or appointment lifecycle state.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_clinical_evolution_session_linkage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_appointment public.appointments%ROWTYPE;
BEGIN
  -- Trusted internal/service repair paths keep working outside tenant app context.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.session_id IS DISTINCT FROM NEW.session_id
    OR OLD.patient_id IS DISTINCT FROM NEW.patient_id
    OR OLD.clinic_id IS DISTINCT FROM NEW.clinic_id
    OR OLD.professional_id IS DISTINCT FROM NEW.professional_id
  ) THEN
    RAISE EXCEPTION 'clinical_evolution_linkage_immutable' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.session_id IS NULL THEN
    RAISE EXCEPTION 'clinical_evolution_session_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.session_id IS NOT NULL THEN
    SELECT a.*
      INTO v_appointment
    FROM public.appointments AS a
    WHERE a.id = NEW.session_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'clinical_evolution_session_not_found' USING ERRCODE = '42501';
    END IF;

    IF v_appointment.clinic_id IS DISTINCT FROM NEW.clinic_id
       OR v_appointment.paciente_id IS DISTINCT FROM NEW.patient_id
       OR v_appointment.fisio_id IS DISTINCT FROM NEW.professional_id THEN
      RAISE EXCEPTION 'clinical_evolution_session_mismatch' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' AND v_appointment.status <> 'em_atendimento' THEN
      RAISE EXCEPTION 'clinical_evolution_requires_active_session' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_clinical_evolution_session_linkage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_evolutions_session_linkage ON public.physiotherapy_evolutions;
CREATE TRIGGER trg_evolutions_session_linkage
BEFORE INSERT OR UPDATE ON public.physiotherapy_evolutions
FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_evolution_session_linkage();

COMMENT ON FUNCTION public.guard_clinical_evolution_session_linkage() IS
  'For authenticated tenant writes, requires evolution/session linkage to match clinic, patient and professional; new evolutions require an active appointment and linkage fields are immutable.';

COMMIT;