-- MEDICSPRO — clinic catalog for Platform Admin entitlement management
-- Exposes only SaaS/tenant metadata required to select a clinic in the control-plane.

BEGIN;

CREATE OR REPLACE FUNCTION public.platform_list_clinics()
RETURNS TABLE (
  clinic_id uuid,
  clinic_name text,
  cnpj text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.cnpj, c.created_at
  FROM public.clinics c
  WHERE c.deleted_at IS NULL
  ORDER BY lower(c.name), c.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_clinics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_list_clinics() TO authenticated;

COMMENT ON FUNCTION public.platform_list_clinics() IS
  'Returns non-clinical clinic metadata for authorized Platform Admin control-plane UI.';

COMMIT;
