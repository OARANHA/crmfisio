\pset pager off

SELECT '1) current_active_profile exists' AS check_name;
SELECT to_regprocedure('public.current_active_profile()') IS NOT NULL AS rpc_exists;

SELECT '2) RPC is SECURITY DEFINER with pinned search_path' AS check_name;
SELECT
  p.prosecdef AS security_definer,
  EXISTS (
    SELECT 1
    FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
    WHERE cfg LIKE 'search_path=public, pg_temp%'
  ) AS search_path_pinned
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'current_active_profile';

SELECT '3) anon/PUBLIC denied; authenticated allowed' AS check_name;
SELECT
  NOT has_function_privilege('anon', 'public.current_active_profile()', 'EXECUTE') AS anon_denied,
  NOT has_function_privilege('public', 'public.current_active_profile()', 'EXECUTE') AS public_denied,
  has_function_privilege('authenticated', 'public.current_active_profile()', 'EXECUTE') AS authenticated_allowed;

SELECT '4) RPC is bound to auth.uid() and active tenant/profile' AS check_name;
WITH fn AS (
  SELECT lower(pg_get_functiondef(p.oid)) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'current_active_profile'
)
SELECT
  def LIKE '%p.id = auth.uid()%' AS bound_to_auth_uid,
  def LIKE '%p.ativo is true%' AS requires_active_profile,
  def LIKE '%c.deleted_at is null%' AS requires_existing_clinic,
  def LIKE '%c.lifecycle_status = ''active''%' AS requires_active_clinic
FROM fn;

SELECT '5) profiles SELECT RLS remains unchanged/present' AS check_name;
SELECT EXISTS (
  SELECT 1
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'profiles_select_same_tenant'
    AND cmd = 'SELECT'
) AS profiles_rls_present;
