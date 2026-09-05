\echo '1) v2 entitlement catalog exists'
SELECT to_regprocedure('public.platform_get_clinic_entitlements_v2(uuid)') IS NOT NULL AS ok;

\echo '2) reset entitlement RPC exists'
SELECT to_regprocedure('public.platform_reset_clinic_entitlement(uuid,text)') IS NOT NULL AS ok;

\echo '3) v2 catalog exposes configured state'
SELECT pg_get_function_result(p.oid) ILIKE '%configured boolean%' AS configured_exposed
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'platform_get_clinic_entitlements_v2';

\echo '4) v2 catalog is Platform Admin protected'
SELECT pg_get_functiondef(p.oid) ILIKE '%is_platform_admin()%'
   AND pg_get_functiondef(p.oid) ILIKE '%platform_admin_required%'
   AS platform_admin_guarded
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'platform_get_clinic_entitlements_v2';

\echo '5) reset is Platform Admin protected and key validated'
SELECT pg_get_functiondef(p.oid) ILIKE '%is_platform_admin()%'
   AND pg_get_functiondef(p.oid) ILIKE '%unknown_clinic_entitlement%'
   AS reset_guarded
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'platform_reset_clinic_entitlement';

\echo '6) reset deletes only the requested explicit row'
SELECT pg_get_functiondef(p.oid) ILIKE '%DELETE FROM public.platform_clinic_entitlements%'
   AND pg_get_functiondef(p.oid) ILIKE '%e.clinic_id = p_clinic_id%'
   AND pg_get_functiondef(p.oid) ILIKE '%e.entitlement_key = p_entitlement_key%'
   AS scoped_delete
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'platform_reset_clinic_entitlement';

\echo '7) reset writes append-only Platform audit event'
SELECT pg_get_functiondef(p.oid) ILIKE '%PLATFORM_CLINIC_ENTITLEMENT_RESET%'
   AND pg_get_functiondef(p.oid) ILIKE '%platform_audit_log%'
   AND pg_get_functiondef(p.oid) ILIKE '%before%'
   AS audited
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'platform_reset_clinic_entitlement';

\echo '8) reset documents Nexus fail-closed semantics'
SELECT pg_get_functiondef(p.oid) ILIKE '%nexus.access%'
   AND pg_get_functiondef(p.oid) ILIKE '%fail_closed_until_explicitly_enabled%'
   AS nexus_safe
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'platform_reset_clinic_entitlement';

\echo '9) direct tenant table privileges remain denied'
SELECT
  NOT has_table_privilege('authenticated', 'public.platform_clinic_entitlements', 'INSERT') AS insert_denied,
  NOT has_table_privilege('authenticated', 'public.platform_clinic_entitlements', 'UPDATE') AS update_denied,
  NOT has_table_privilege('authenticated', 'public.platform_clinic_entitlements', 'DELETE') AS delete_denied;

\echo '10) authenticated can call control-plane RPCs but anon cannot'
SELECT
  has_function_privilege('authenticated', 'public.platform_get_clinic_entitlements_v2(uuid)', 'EXECUTE') AS get_allowed,
  has_function_privilege('authenticated', 'public.platform_reset_clinic_entitlement(uuid,text)', 'EXECUTE') AS reset_allowed,
  NOT has_function_privilege('anon', 'public.platform_get_clinic_entitlements_v2(uuid)', 'EXECUTE') AS get_anon_denied,
  NOT has_function_privilege('anon', 'public.platform_reset_clinic_entitlement(uuid,text)', 'EXECUTE') AS reset_anon_denied;
