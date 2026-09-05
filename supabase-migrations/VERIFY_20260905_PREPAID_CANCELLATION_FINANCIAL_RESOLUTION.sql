\echo '1) resolution table exists'
SELECT to_regclass('public.appointment_payment_resolutions') IS NOT NULL AS ok;

\echo '2) one resolution per appointment is enforced'
SELECT EXISTS (
  SELECT 1
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'appointment_payment_resolutions'
    AND c.conname = 'appointment_payment_resolutions_one_per_appointment'
    AND c.contype = 'u'
) AS ok;

\echo '3) regular cancellation fails closed for paid linked appointments'
SELECT pg_get_functiondef(p.oid) ILIKE '%status = ''pago''%'
   AND pg_get_functiondef(p.oid) ILIKE '%appointment_payment_resolutions%'
   AND pg_get_functiondef(p.oid) ILIKE '%resolução financeira antes de cancelar%'
   AS hardened
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'cancel_appointment_with_reason'
  AND pg_get_function_identity_arguments(p.oid) = 'p_appointment_id uuid, p_reason text';

\echo '4) explicit prepaid cancellation RPC exists'
SELECT EXISTS (
  SELECT 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'cancel_prepaid_appointment_with_resolution'
) AS ok;

\echo '5) prepaid resolution preserves paid payment and records explicit disposition'
SELECT pg_get_functiondef(p.oid) ILIKE '%INSERT INTO public.appointment_payment_resolutions%'
   AND pg_get_functiondef(p.oid) ILIKE '%refund_due%'
   AND pg_get_functiondef(p.oid) ILIKE '%credit_due%'
   AND pg_get_functiondef(p.oid) ILIKE '%retained%'
   AND pg_get_functiondef(p.oid) NOT ILIKE '%UPDATE public.payments%'
   AS audit_first
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'cancel_prepaid_appointment_with_resolution';

\echo '6) direct authenticated mutation of resolution ledger is denied'
SELECT
  NOT has_table_privilege('authenticated', 'public.appointment_payment_resolutions', 'INSERT') AS insert_denied,
  NOT has_table_privilege('authenticated', 'public.appointment_payment_resolutions', 'UPDATE') AS update_denied,
  NOT has_table_privilege('authenticated', 'public.appointment_payment_resolutions', 'DELETE') AS delete_denied;

\echo '7) cancellation context RPC exists and is authenticated-only'
SELECT
  has_function_privilege('authenticated', 'public.get_appointment_cancellation_context(uuid)', 'EXECUTE') AS authenticated_allowed,
  NOT has_function_privilege('anon', 'public.get_appointment_cancellation_context(uuid)', 'EXECUTE') AS anon_denied;

\echo '8) retained disposition is restricted to owner/admin'
SELECT pg_get_functiondef(p.oid) ILIKE '%p_resolution_type = ''retained''%'
   AND pg_get_functiondef(p.oid) ILIKE '%app_role NOT IN (''owner'', ''admin'')%'
   AS retained_restricted
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'cancel_prepaid_appointment_with_resolution';
