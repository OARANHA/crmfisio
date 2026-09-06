-- MEDICSPRO — P0 patient clinical read boundary
-- Clinical fields stored on patients must never be part of the operational
-- tenant directory contract. This migration first introduces the canonical
-- server-side clinical snapshot used by the frontend before table-level column
-- privileges are tightened in the next hardening step.

BEGIN;

CREATE OR REPLACE FUNCTION public.list_patient_clinical_snapshot()
RETURNS TABLE (
  patient_id uuid,
  queixa_principal text,
  cid10 text[],
  anamnese jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF v_clinic IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'tenant_context_required' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('owner', 'admin', 'fisio') THEN
    RAISE EXCEPTION 'clinical_access_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.queixa_principal,
    p.cid10,
    p.anamnese
  FROM public.patients p
  WHERE p.clinic_id = v_clinic
    AND p.deleted_at IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_patient_clinical_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_patient_clinical_snapshot() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_patient_clinical_snapshot() TO authenticated;

COMMENT ON FUNCTION public.list_patient_clinical_snapshot() IS
  'Clinical-only patient projection. Requires active tenant context and owner/admin/fisio role.';

COMMIT;
