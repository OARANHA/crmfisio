-- MedicsPro #400 — Encounter Temporal Start Boundary
-- Prevents normal authenticated application actors from entering em_atendimento
-- on a future operational clinic date. Same-day and past-date semantics remain
-- unchanged. Controlled service_role/direct database maintenance keeps the
-- existing internal bypass for repair and migrations.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF to_regclass('public.appointments') IS NULL THEN
    RAISE EXCEPTION 'encounter_temporal_start_appointments_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'data'
      AND data_type = 'date'
  ) THEN
    RAISE EXCEPTION 'encounter_temporal_start_date_contract_missing';
  END IF;

  IF to_regprocedure('public.can_apply_clinical_instrument_in_encounter(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'encounter_temporal_start_ci399_boundary_missing';
  END IF;
END;
$$;

-- The project already treats appointment date/time as Brazil-local components
-- and uses America/Sao_Paulo as the operational clinic timezone in messaging.
-- Centralize that established convention for this boundary without inventing a
-- per-clinic timezone subsystem in #400.
CREATE OR REPLACE FUNCTION public.current_clinic_operational_date()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT timezone('America/Sao_Paulo', now())::date
$$;

REVOKE ALL ON FUNCTION public.current_clinic_operational_date()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_clinic_operational_date()
  TO service_role;

COMMENT ON FUNCTION public.current_clinic_operational_date() IS
  'Current operational clinic date using the project-established America/Sao_Paulo appointment convention. Internal helper for temporal clinical boundaries.';

CREATE OR REPLACE FUNCTION public.guard_appointment_encounter_temporal_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role text := coalesce(auth.role(), '');
  v_operational_date date;
BEGIN
  -- Preserve the same controlled maintenance bypass used by the canonical
  -- appointment mutation boundary. Browser roles never receive this bypass.
  IF v_jwt_role = 'service_role'
     OR (v_jwt_role = '' AND session_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  -- This invariant applies only when a row ENTERS em_atendimento. Existing
  -- physical rows already in that status are not repaired or rewritten here.
  IF NEW.status IS DISTINCT FROM 'em_atendimento' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'em_atendimento' THEN
    RETURN NEW;
  END IF;

  v_operational_date := public.current_clinic_operational_date();

  IF NEW.data IS NULL THEN
    RAISE EXCEPTION 'appointment_encounter_start_date_required'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.data > v_operational_date THEN
    RAISE EXCEPTION 'appointment_future_encounter_start_forbidden'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_encounter_temporal_start()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.guard_appointment_encounter_temporal_start() IS
  'Blocks normal authenticated INSERT/UPDATE entry into em_atendimento when appointments.data is after the current America/Sao_Paulo operational date; same-day/past behavior is unchanged and trusted service/database maintenance bypass is preserved.';

-- Keep the temporal guard after the existing authorization/mutation guards in
-- the normal BEFORE-trigger name order. Separate INSERT/UPDATE triggers avoid
-- changing the established status-transition trigger itself.
DROP TRIGGER IF EXISTS trg_h_appointment_encounter_temporal_start_insert ON public.appointments;
CREATE TRIGGER trg_h_appointment_encounter_temporal_start_insert
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_encounter_temporal_start();

DROP TRIGGER IF EXISTS trg_h_appointment_encounter_temporal_start_update ON public.appointments;
CREATE TRIGGER trg_h_appointment_encounter_temporal_start_update
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_encounter_temporal_start();

COMMENT ON TRIGGER trg_h_appointment_encounter_temporal_start_insert ON public.appointments IS
  'Fails closed when a normal application INSERT attempts to create a future-dated appointment directly in em_atendimento.';

COMMENT ON TRIGGER trg_h_appointment_encounter_temporal_start_update ON public.appointments IS
  'Fails closed when a normal application UPDATE attempts to enter em_atendimento before the appointment local date.';

-- Defense in depth for #399: even a legacy/corrupt/internal row physically left
-- future-dated in em_atendimento must not become Apply-now authority.
-- Past dates remain accepted here because #400 intentionally does not redefine
-- historical Encounter semantics.
CREATE OR REPLACE FUNCTION public.can_apply_clinical_instrument_in_encounter(
  p_appointment_id uuid,
  p_instrument_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_patient uuid;
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR p_appointment_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT a.paciente_id
    INTO v_patient
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.clinic_id = v_clinic
    AND a.professional_id = v_uid
    AND a.status = 'em_atendimento'
    AND a.data <= public.current_clinic_operational_date()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN public.clinical_instrument_base_authorized(
    v_patient,
    p_instrument_key
  ) IS TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_apply_clinical_instrument_in_encounter(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_apply_clinical_instrument_in_encounter(uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.can_apply_clinical_instrument_in_encounter(uuid, text) IS
  'Apply-in-Encounter boundary: #399 authorization plus own em_atendimento appointment whose date is not future in the clinic operational timezone. Future physical legacy/corrupt rows fail closed.';

COMMIT;
