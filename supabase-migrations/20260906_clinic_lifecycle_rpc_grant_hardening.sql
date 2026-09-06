-- MEDICSPRO — clinic lifecycle RPC grant hardening
-- Supabase installations may grant function EXECUTE directly to anon through
-- default privileges. Revoke explicitly so clinic lifecycle remains authenticated-only.

BEGIN;

REVOKE ALL ON FUNCTION public.platform_suspend_clinic(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_reactivate_clinic(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_clinics() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.platform_suspend_clinic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_reactivate_clinic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_clinics() TO authenticated;

COMMIT;
