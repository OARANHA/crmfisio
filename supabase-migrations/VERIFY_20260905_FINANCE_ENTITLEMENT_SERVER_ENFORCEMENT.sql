-- MEDICSPRO — verifier: finance entitlement server-side enforcement
-- Expected: all rows below report true/OK and no missing policies/functions.

\echo '1) helper exists'
SELECT to_regprocedure('public.current_clinic_entitlement_allowed(text)') IS NOT NULL AS ok;

\echo '2) payment policies include finance entitlement helper'
SELECT policyname,
       position('current_clinic_entitlement_allowed' in coalesce(qual,'')) > 0
       OR position('current_clinic_entitlement_allowed' in coalesce(with_check,'')) > 0 AS has_entitlement_gate
FROM pg_policies
WHERE schemaname='public'
  AND tablename='payments'
  AND policyname IN ('payments_select_tenant','payments_insert_financial','payments_update_financial')
ORDER BY policyname;

\echo '3) payment history policy includes finance entitlement helper'
SELECT policyname,
       position('current_clinic_entitlement_allowed' in coalesce(qual,'')) > 0 AS has_entitlement_gate
FROM pg_policies
WHERE schemaname='public'
  AND tablename='payment_status_history'
  AND policyname='payment_status_history_select_financial';

\echo '4) finance package RPCs contain entitlement enforcement'
SELECT p.proname,
       position('current_clinic_entitlement_allowed' in pg_get_functiondef(p.oid)) > 0 AS has_entitlement_gate
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('upsert_session_package','sell_session_package')
ORDER BY p.proname;

\echo '5) helper grant is authenticated only (no anon/public execute)'
SELECT
  has_function_privilege('authenticated','public.current_clinic_entitlement_allowed(text)','EXECUTE') AS authenticated_execute,
  has_function_privilege('anon','public.current_clinic_entitlement_allowed(text)','EXECUTE') AS anon_execute;
