-- MEDICSPRO — appointment mutation boundary
-- Prevents authenticated tenant users from bypassing canonical appointment flows
-- through direct table mutations while preserving status/check-in/cancellation RPCs.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_appointment_mutation_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_jwt_role text := coalesce(auth.role(), '');
BEGIN
  -- Only the real Supabase service role or a direct trusted database session may
  -- bypass this boundary. An authenticated user whose profile/clinic is inactive
  -- must fail closed instead of being mistaken for an internal actor.
  IF v_jwt_role = 'service_role'
     OR (v_jwt_role = '' AND session_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'appointment_active_tenant_role_required'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- The browser already binds a physiotherapist to their own agenda. Enforce
    -- the same contract server-side so direct REST inserts cannot assign a
    -- clinical appointment to another professional.
    IF v_role = 'fisio'
       AND (auth.uid() IS NULL OR NEW.fisio_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'appointment_fisio_self_assignment_required'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- A physiotherapist may only mutate appointments assigned to themselves.
    -- This also protects non-status columns such as arrival metadata from
    -- cross-professional direct table updates.
    IF v_role = 'fisio'
       AND (
         auth.uid() IS NULL
         OR OLD.fisio_id IS DISTINCT FROM auth.uid()
         OR NEW.fisio_id IS DISTINCT FROM auth.uid()
       ) THEN
      RAISE EXCEPTION 'appointment_fisio_self_mutation_required'
        USING ERRCODE = '42501';
    END IF;

    -- Existing appointments are structurally immutable for authenticated users.
    -- Rescheduling intentionally creates a replacement appointment and cancels
    -- the old one through reschedule_appointment(), preserving reason/history.
    -- Status, cancellation_reason, arrival metadata and updated_at remain
    -- mutable through their existing guarded/canonical flows.
    IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
       OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
       OR NEW.fisio_id IS DISTINCT FROM OLD.fisio_id
       OR NEW.room_id IS DISTINCT FROM OLD.room_id
       OR NEW.data IS DISTINCT FROM OLD.data
       OR NEW.inicio IS DISTINCT FROM OLD.inicio
       OR NEW.fim IS DISTINCT FROM OLD.fim
       OR NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.pacote_id IS DISTINCT FROM OLD.pacote_id
       OR NEW.serie_id IS DISTINCT FROM OLD.serie_id
       OR NEW.is_fit_in IS DISTINCT FROM OLD.is_fit_in
       OR NEW.rescheduled_from_id IS DISTINCT FROM OLD.rescheduled_from_id THEN
      RAISE EXCEPTION 'appointment_structural_update_requires_canonical_flow'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_mutation_boundary() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_appointment_mutation_boundary ON public.appointments;
CREATE TRIGGER trg_guard_appointment_mutation_boundary
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_mutation_boundary();

COMMENT ON FUNCTION public.guard_appointment_mutation_boundary() IS
  'Fails closed on inactive tenant roles, cross-professional fisio mutations and authenticated in-place changes to appointment structural/source fields; canonical reschedule remains insert + status update.';

COMMIT;
