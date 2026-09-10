-- Test-only compatibility shim for the reduced Financial Clinical Finalization
-- Boundary fixture. Production already has the canonical care-relationship read
-- function and Evolution.created_at DEFAULT NOW(); the reduced #388 fixture does
-- not, so restore only those prerequisites before installing #394.

ALTER TABLE public.physiotherapy_evolutions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.can_access_patient_clinical_record(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_patient_id IS NOT NULL
    AND public.current_clinic_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = p_patient_id
        AND p.clinic_id = public.current_clinic_id()
        AND p.deleted_at IS NULL
    )
$$;

REVOKE ALL ON FUNCTION public.can_access_patient_clinical_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_patient_clinical_record(uuid) TO authenticated, service_role;
