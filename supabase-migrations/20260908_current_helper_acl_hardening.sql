-- MEDICSPRO — repair production ACL drift on canonical current-session helpers
-- Scope is intentionally limited to EXECUTE privileges. Function bodies, RLS,
-- application roles and all other helpers remain unchanged.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.current_clinic_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM anon;

GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;

COMMIT;
