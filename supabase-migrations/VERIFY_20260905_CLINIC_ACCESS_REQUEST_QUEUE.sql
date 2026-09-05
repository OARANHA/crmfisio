\echo '1) access request table exists'
SELECT to_regclass('public.clinic_access_requests') IS NOT NULL AS ok;

\echo '2) public roles have no direct table access'
SELECT NOT has_table_privilege('anon','public.clinic_access_requests','SELECT')
   AND NOT has_table_privilege('authenticated','public.clinic_access_requests','SELECT')
   AND NOT has_table_privilege('authenticated','public.clinic_access_requests','INSERT') AS direct_access_denied;

\echo '3) list RPC exists'
SELECT to_regprocedure('public.platform_list_clinic_access_requests(text,integer)') IS NOT NULL AS ok;

\echo '4) reject RPC exists'
SELECT to_regprocedure('public.platform_reject_clinic_access_request(uuid,text)') IS NOT NULL AS ok;

\echo '5) list RPC is Platform Admin guarded'
SELECT position('is_platform_admin' in pg_get_functiondef('public.platform_list_clinic_access_requests(text,integer)'::regprocedure)) > 0 AS platform_admin_guarded;

\echo '6) reject RPC is Platform Admin guarded'
SELECT position('is_platform_admin' in pg_get_functiondef('public.platform_reject_clinic_access_request(uuid,text)'::regprocedure)) > 0 AS platform_admin_guarded;

\echo '7) reject only accepts pending requests'
SELECT position('access_request_not_pending' in pg_get_functiondef('public.platform_reject_clinic_access_request(uuid,text)'::regprocedure)) > 0 AS pending_only;

\echo '8) rejection is audited'
SELECT position('CLINIC_ACCESS_REQUEST_REJECTED' in pg_get_functiondef('public.platform_reject_clinic_access_request(uuid,text)'::regprocedure)) > 0 AS audited;

\echo '9) authenticated may call review RPCs and anon cannot'
SELECT has_function_privilege('authenticated','public.platform_list_clinic_access_requests(text,integer)','EXECUTE') AS list_allowed,
       has_function_privilege('authenticated','public.platform_reject_clinic_access_request(uuid,text)','EXECUTE') AS reject_allowed,
       NOT has_function_privilege('anon','public.platform_list_clinic_access_requests(text,integer)','EXECUTE') AS list_anon_denied,
       NOT has_function_privilege('anon','public.platform_reject_clinic_access_request(uuid,text)','EXECUTE') AS reject_anon_denied;

\echo '10) queue tracks provisioning linkage'
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='clinic_access_requests' AND column_name='provisioning_request_id'
) AS provisioning_linked;