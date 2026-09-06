\pset pager off

SELECT '1) current tenant access state RPC exists' AS check,
       to_regprocedure('public.current_tenant_access_state()') IS NOT NULL AS ok;

SELECT '2) RPC is security definer and stable' AS check,
       p.prosecdef AND p.provolatile = 's'
FROM pg_proc p
WHERE p.oid = 'public.current_tenant_access_state()'::regprocedure;

SELECT '3) RPC checks authenticated user profile only' AS check,
       position('auth.uid()' in pg_get_functiondef('public.current_tenant_access_state()'::regprocedure)) > 0
       AND position('FROM public.profiles' in pg_get_functiondef('public.current_tenant_access_state()'::regprocedure)) > 0 AS ok;

SELECT '4) RPC distinguishes suspended clinic' AS check,
       position('suspended' in pg_get_functiondef('public.current_tenant_access_state()'::regprocedure)) > 0
       AND position('lifecycle_status' in pg_get_functiondef('public.current_tenant_access_state()'::regprocedure)) > 0 AS ok;

SELECT '5) RPC distinguishes inactive/missing profile and unavailable clinic' AS check,
       position('inactive_profile' in pg_get_functiondef('public.current_tenant_access_state()'::regprocedure)) > 0
       AND position('no_profile' in pg_get_functiondef('public.current_tenant_access_state()'::regprocedure)) > 0
       AND position('clinic_unavailable' in pg_get_functiondef('public.current_tenant_access_state()'::regprocedure)) > 0 AS ok;

SELECT '6) authenticated can execute RPC' AS check,
       has_function_privilege('authenticated', 'public.current_tenant_access_state()', 'EXECUTE') AS ok;

SELECT '7) anon cannot execute RPC' AS check,
       NOT has_function_privilege('anon', 'public.current_tenant_access_state()', 'EXECUTE') AS ok;

SELECT '8) canonical tenant resolver still requires active clinic' AS check,
       position('lifecycle_status = ''active''' in pg_get_functiondef('public.current_clinic_id()'::regprocedure)) > 0 AS ok;

SELECT '9) canonical role resolver still requires active clinic' AS check,
       position('lifecycle_status = ''active''' in pg_get_functiondef('public.current_app_role()'::regprocedure)) > 0 AS ok;

SELECT '10) access-state RPC does not expose clinic data columns' AS check,
       position('RETURNS text' in pg_get_functiondef('public.current_tenant_access_state()'::regprocedure)) > 0 AS ok;
