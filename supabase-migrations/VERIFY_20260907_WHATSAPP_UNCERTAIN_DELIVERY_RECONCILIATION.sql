\pset pager off

\echo '1) stale-delivery quarantine RPC exists'
SELECT to_regprocedure('public.requeue_stale_messages(integer)') IS NOT NULL AS requeue_rpc_exists;

\echo '2) stale-delivery RPC is SECURITY DEFINER with pinned search_path'
SELECT
  p.prosecdef AS security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') LIKE '%search_path=public, pg_temp%' AS search_path_pinned
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'requeue_stale_messages';

\echo '3) stale-delivery RPC is service-role only'
WITH fn AS (
  SELECT p.oid, coalesce(p.proacl, acldefault('f', p.proowner)) AS acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'requeue_stale_messages'
), expanded AS (
  SELECT
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
    x.privilege_type
  FROM fn
  CROSS JOIN LATERAL aclexplode(fn.acl) x
)
SELECT
  NOT EXISTS (SELECT 1 FROM expanded WHERE grantee='PUBLIC' AND privilege_type='EXECUTE') AS public_denied,
  NOT EXISTS (SELECT 1 FROM expanded WHERE grantee='anon' AND privilege_type='EXECUTE') AS anon_denied,
  NOT EXISTS (SELECT 1 FROM expanded WHERE grantee='authenticated' AND privilege_type='EXECUTE') AS authenticated_denied,
  EXISTS (SELECT 1 FROM expanded WHERE grantee='service_role' AND privilege_type='EXECUTE') AS service_role_allowed;

\echo '4) stale sends are quarantined instead of blindly requeued'
WITH fn AS (
  SELECT pg_get_functiondef(p.oid) AS src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='requeue_stale_messages'
)
SELECT
  src LIKE '%status = ''falhou''%' AS stale_marked_failed,
  src LIKE '%provider_status = ''DELIVERY_UNCERTAIN''%' AS uncertain_status_recorded,
  src NOT LIKE '%SET status=''fila''%' AND src NOT LIKE '%SET status = ''fila''%' AS blind_requeue_removed
FROM fn;

\echo '5) outbound reconciliation RPC exists and is hardened'
SELECT
  to_regprocedure('public.reconcile_whatsapp_outbound_event(text,text,text)') IS NOT NULL AS reconcile_rpc_exists,
  p.prosecdef AS security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') LIKE '%search_path=public, pg_temp%' AS search_path_pinned
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname='reconcile_whatsapp_outbound_event';

\echo '6) reconciliation RPC is service-role only'
WITH fn AS (
  SELECT p.oid, coalesce(p.proacl, acldefault('f', p.proowner)) AS acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='reconcile_whatsapp_outbound_event'
), expanded AS (
  SELECT CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
         x.privilege_type
  FROM fn CROSS JOIN LATERAL aclexplode(fn.acl) x
)
SELECT
  NOT EXISTS (SELECT 1 FROM expanded WHERE grantee='PUBLIC' AND privilege_type='EXECUTE') AS public_denied,
  NOT EXISTS (SELECT 1 FROM expanded WHERE grantee='anon' AND privilege_type='EXECUTE') AS anon_denied,
  NOT EXISTS (SELECT 1 FROM expanded WHERE grantee='authenticated' AND privilege_type='EXECUTE') AS authenticated_denied,
  EXISTS (SELECT 1 FROM expanded WHERE grantee='service_role' AND privilege_type='EXECUTE') AS service_role_allowed;

\echo '7) reconciliation matches strict recipient/text/time/uncertain state'
WITH fn AS (
  SELECT pg_get_functiondef(p.oid) AS src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='reconcile_whatsapp_outbound_event'
)
SELECT
  src LIKE '%w.mensagem = v_message_text%' AS exact_text_match,
  src LIKE '%regexp_replace%' AS phone_normalized,
  src LIKE '%interval ''6 hours''%' AS bounded_time_window,
  src LIKE '%w.provider_message_id IS NULL%' AS only_unlinked_rows,
  src LIKE '%w.status = ''enviando''%' AS sending_candidate,
  src LIKE '%w.provider_status = ''DELIVERY_UNCERTAIN''%' AS uncertain_candidate
FROM fn;

\echo '8) ambiguous reconciliation fails closed'
WITH fn AS (
  SELECT pg_get_functiondef(p.oid) AS src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='reconcile_whatsapp_outbound_event'
)
SELECT
  src LIKE '%v_count <> 1%' AS exactly_one_candidate_required,
  src LIKE '%provider_message_id = v_provider_message_id%' AS provider_id_persisted,
  src LIKE '%provider_status = ''RECONCILED''%' AS reconciliation_marked
FROM fn;
