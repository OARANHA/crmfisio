SELECT proname, prosecdef, proconfig, pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('current_clinic_id', 'current_app_role')
ORDER BY proname;

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;

SELECT
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') AS authenticated_can_update_profiles,
  has_table_privilege('service_role', 'public.profiles', 'UPDATE') AS service_role_can_update_profiles;

SELECT count(*) AS inactive_profiles
FROM public.profiles
WHERE ativo IS NOT TRUE;

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('physiotherapy_evaluations', 'physiotherapy_evolutions')
ORDER BY tablename, policyname;
