\pset pager off

SELECT '1) authenticated direct DELETE on patients is denied' AS check,
       NOT has_table_privilege('authenticated', 'public.patients', 'DELETE') AS ok;

SELECT '2) anon direct DELETE on patients is denied' AS check,
       NOT has_table_privilege('anon', 'public.patients', 'DELETE') AS ok;

SELECT '3) audited soft-delete RPC remains executable by authenticated' AS check,
       has_function_privilege('authenticated', 'public.soft_delete_patient(uuid,text)', 'EXECUTE') AS ok;

SELECT '4) audited restore RPC remains executable by authenticated' AS check,
       has_function_privilege('authenticated', 'public.restore_soft_deleted_patient(uuid,text)', 'EXECUTE') AS ok;

SELECT '5) lifecycle RPCs remain unavailable to anon' AS check,
       NOT has_function_privilege('anon', 'public.soft_delete_patient(uuid,text)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.restore_soft_deleted_patient(uuid,text)', 'EXECUTE') AS ok;
