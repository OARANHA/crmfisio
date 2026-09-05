-- MEDICSPRO — appointment tenant link integrity
-- Prevents cross-tenant patient/professional/room references in appointments.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    LEFT JOIN public.patients p ON p.id = a.paciente_id
    WHERE p.id IS NULL OR p.clinic_id IS DISTINCT FROM a.clinic_id
  ) THEN
    RAISE EXCEPTION 'Existing appointment/patient tenant mismatch detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    LEFT JOIN public.profiles pr ON pr.id = a.fisio_id
    WHERE pr.id IS NULL OR pr.clinic_id IS DISTINCT FROM a.clinic_id
  ) THEN
    RAISE EXCEPTION 'Existing appointment/professional tenant mismatch detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    LEFT JOIN public.rooms r ON r.id = a.room_id
    WHERE a.room_id IS NOT NULL
      AND (r.id IS NULL OR r.clinic_id IS DISTINCT FROM a.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Existing appointment/room tenant mismatch detected';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_appointment_tenant_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.paciente_id
      AND p.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'appointment_patient_tenant_mismatch' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = NEW.fisio_id
      AND pr.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'appointment_professional_tenant_mismatch' USING ERRCODE = '42501';
  END IF;

  IF NEW.room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = NEW.room_id
      AND r.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'appointment_room_tenant_mismatch' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_tenant_links() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_appointment_tenant_links ON public.appointments;
CREATE TRIGGER trg_guard_appointment_tenant_links
BEFORE INSERT OR UPDATE OF clinic_id, paciente_id, fisio_id, room_id
ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_tenant_links();

COMMENT ON FUNCTION public.guard_appointment_tenant_links() IS
  'Enforces that appointment patient, professional and room references belong to the appointment clinic.';

COMMIT;
