SELECT to_regclass('public.platform_admins') AS platform_admins,
       to_regclass('public.clinic_provisioning_requests') AS provisioning_requests,
       to_regclass('public.platform_audit_log') AS platform_audit_log;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('platform_admins', 'clinic_provisioning_requests', 'platform_audit_log')
ORDER BY tablename;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('platform_admins', 'clinic_provisioning_requests', 'platform_audit_log')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

SELECT
  has_function_privilege('anon', 'public.complete_clinic_provisioning(uuid,uuid)', 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', 'public.complete_clinic_provisioning(uuid,uuid)', 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', 'public.complete_clinic_provisioning(uuid,uuid)', 'EXECUTE') AS service_role_execute;

SELECT
  has_table_privilege('service_role', 'public.platform_audit_log', 'SELECT') AS audit_select,
  has_table_privilege('service_role', 'public.platform_audit_log', 'INSERT') AS audit_insert,
  has_table_privilege('service_role', 'public.platform_audit_log', 'UPDATE') AS audit_update,
  has_table_privilege('service_role', 'public.platform_audit_log', 'DELETE') AS audit_delete,
  has_table_privilege('service_role', 'public.platform_audit_log', 'TRUNCATE') AS audit_truncate;

SELECT count(*) AS active_platform_admins
FROM public.platform_admins
WHERE ativo IS TRUE;
