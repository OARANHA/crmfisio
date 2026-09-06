\pset pager off

SELECT '1) authenticated can execute suspend RPC' AS check,
       has_function_privilege('authenticated', 'public.platform_suspend_clinic(uuid,text)', 'EXECUTE') AS ok;

SELECT '2) authenticated can execute reactivate RPC' AS check,
       has_function_privilege('authenticated', 'public.platform_reactivate_clinic(uuid,text)', 'EXECUTE') AS ok;

SELECT '3) anon cannot execute suspend RPC' AS check,
       NOT has_function_privilege('anon', 'public.platform_suspend_clinic(uuid,text)', 'EXECUTE') AS ok;

SELECT '4) anon cannot execute reactivate RPC' AS check,
       NOT has_function_privilege('anon', 'public.platform_reactivate_clinic(uuid,text)', 'EXECUTE') AS ok;

SELECT '5) clinic catalog exposes lifecycle status and remains authenticated-only' AS check,
       position('lifecycle_status' in pg_get_functiondef('public.platform_list_clinics()'::regprocedure)) > 0
       AND has_function_privilege('authenticated', 'public.platform_list_clinics()', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.platform_list_clinics()', 'EXECUTE') AS ok;
