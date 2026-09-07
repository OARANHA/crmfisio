-- MEDICSPRO — appointment clinical self-transition boundary
-- Prevents an authenticated physiotherapist from starting/finalizing another
-- professional's appointment. Managers/reception keep their existing workflow;
-- internal/service operations without app role remain unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_appointment_clinical_self_transition()
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

  -- Internal/service operations have no tenant app role and remain available for
  -- controlled repair/automation paths.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_role = 'fisio' THEN
    IF auth.uid() IS NULL
       OR OLD.fisio_id IS DISTINCT FROM auth.uid()
       OR NEW.fisio_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'clinical_appointment_self_transition_required'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_clinical_self_transition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_appointment_clinical_self_transition ON public.appointments;
CREATE TRIGGER trg_appointment_clinical_self_transition
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_clinical_self_transition();

COMMENT ON FUNCTION public.guard_appointment_clinical_self_transition() IS
  'Authenticated fisio may change appointment status only when the appointment remains assigned to auth.uid(); prevents cross-professional clinical session takeover.';

COMMIT;
