-- MEDICSPRO — explicit tenant access state for authenticated session UX
-- Allows the client to distinguish a suspended clinic from an invalid/inactive profile
-- without exposing another tenant or weakening the canonical RLS boundary.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_tenant_access_state()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_active boolean;
  v_clinic_id uuid;
  v_clinic_deleted_at timestamptz;
  v_lifecycle_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'unauthenticated';
  END IF;

  SELECT p.ativo, p.clinic_id
    INTO v_profile_active, v_clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'no_profile';
  END IF;

  IF v_profile_active IS NOT TRUE THEN
    RETURN 'inactive_profile';
  END IF;

  SELECT c.deleted_at, c.lifecycle_status
    INTO v_clinic_deleted_at, v_lifecycle_status
  FROM public.clinics c
  WHERE c.id = v_clinic_id
  LIMIT 1;

  IF NOT FOUND OR v_clinic_deleted_at IS NOT NULL THEN
    RETURN 'clinic_unavailable';
  END IF;

  IF v_lifecycle_status = 'suspended' THEN
    RETURN 'suspended';
  END IF;

  IF v_lifecycle_status = 'active' THEN
    RETURN 'active';
  END IF;

  RETURN 'clinic_unavailable';
END;
$$;

REVOKE ALL ON FUNCTION public.current_tenant_access_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_access_state() TO authenticated;

COMMENT ON FUNCTION public.current_tenant_access_state() IS
  'Returns only the authenticated user tenant access state; used to render explicit suspended/inactive session UX without granting tenant data access.';

COMMIT;
