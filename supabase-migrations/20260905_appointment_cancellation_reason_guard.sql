-- MEDICSPRO — authenticated appointment cancellation reason guard
-- Any browser-authenticated cancellation must carry a non-empty reason,
-- regardless of whether it comes from the canonical RPC or a direct table update.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_appointment_cancellation_reason()
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

  -- Trusted internal/service operations without tenant app context remain available
  -- for controlled repair/migration jobs.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelado'
     AND nullif(trim(coalesce(NEW.cancellation_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'appointment_cancellation_reason_required'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_cancellation_reason() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_appointment_cancellation_reason ON public.appointments;
CREATE TRIGGER trg_guard_appointment_cancellation_reason
BEFORE UPDATE OF status, cancellation_reason
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_cancellation_reason();

COMMENT ON FUNCTION public.guard_appointment_cancellation_reason() IS
  'Requires a non-empty cancellation_reason whenever an authenticated tenant user transitions an appointment to cancelado.';

COMMIT;
