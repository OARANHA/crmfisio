-- MEDICSPRO — P0 temporary-password domain boundary
-- A user authenticated with a temporary password must not obtain tenant
-- identity/role resolution until the mandatory password change is complete.
-- The admin-team/change_own_password Edge Function remains the deliberate
-- self-service exception because it uses the service role and updates the
-- authenticated caller's own password/profile flag.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.clinic_id
  FROM public.profiles p
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND COALESCE(p.must_change_password, false) IS FALSE
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.role
  FROM public.profiles p
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND COALESCE(p.must_change_password, false) IS FALSE
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_clinic_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

COMMENT ON FUNCTION public.current_clinic_id() IS
  'Returns active tenant only for active users whose mandatory password change is complete and whose clinic lifecycle is active.';

COMMENT ON FUNCTION public.current_app_role() IS
  'Returns clinic role only for active users whose mandatory password change is complete and whose clinic lifecycle is active.';

COMMIT;
