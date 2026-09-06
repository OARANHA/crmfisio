\echo '1) cancellation reason guard function exists'
SELECT to_regprocedure('public.guard_appointment_cancellation_reason()') IS NOT NULL AS ok;

\echo '2) cancellation reason trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'appointments'
    AND t.tgname = 'trg_guard_appointment_cancellation_reason' AND NOT t.tgisinternal
) AS ok;

\echo '3) guard checks transition to cancelado'
SELECT pg_get_functiondef('public.guard_appointment_cancellation_reason()'::regprocedure) ILIKE '%NEW.status = ''cancelado''%' AS cancel_guarded;

\echo '4) guard requires non-empty cancellation reason'
SELECT pg_get_functiondef('public.guard_appointment_cancellation_reason()'::regprocedure) ILIKE '%cancellation_reason%'
   AND pg_get_functiondef('public.guard_appointment_cancellation_reason()'::regprocedure) ILIKE '%nullif(trim%' AS reason_required;

\echo '5) guard raises stable validation error'
SELECT pg_get_functiondef('public.guard_appointment_cancellation_reason()'::regprocedure) ILIKE '%appointment_cancellation_reason_required%'
   AND pg_get_functiondef('public.guard_appointment_cancellation_reason()'::regprocedure) ILIKE '%22023%' AS stable_error;

\echo '6) trusted internal/service path is preserved'
SELECT pg_get_functiondef('public.guard_appointment_cancellation_reason()'::regprocedure) ILIKE '%v_role IS NULL%'
   AND pg_get_functiondef('public.guard_appointment_cancellation_reason()'::regprocedure) ILIKE '%RETURN NEW%' AS service_path;

\echo '7) trigger covers status updates'
SELECT pg_get_triggerdef(t.oid) ILIKE '%UPDATE OF status, cancellation_reason%'
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'appointments'
  AND t.tgname = 'trg_guard_appointment_cancellation_reason' AND NOT t.tgisinternal;

\echo '8) canonical cancel RPC still requires a reason'
SELECT pg_get_functiondef('public.cancel_appointment_with_reason(uuid,text)'::regprocedure) ILIKE '%nullif(trim(p_reason), '''') IS NULL%'
   AND pg_get_functiondef('public.cancel_appointment_with_reason(uuid,text)'::regprocedure) ILIKE '%cancellation_reason = trim(p_reason)%' AS canonical_rpc_guarded;

\echo '9) existing cancelled appointments have reasons or are legacy-visible for audit'
SELECT NOT EXISTS (
  SELECT 1 FROM public.appointments
  WHERE status = 'cancelado'
    AND nullif(trim(coalesce(cancellation_reason, '')), '') IS NULL
    AND updated_at >= timestamptz '2026-09-05 00:00:00+00'
) AS no_recent_reasonless_cancellations;

\echo '10) browser roles cannot execute guard directly'
SELECT NOT has_function_privilege('authenticated', 'public.guard_appointment_cancellation_reason()', 'EXECUTE') AS authenticated_denied,
       NOT has_function_privilege('anon', 'public.guard_appointment_cancellation_reason()', 'EXECUTE') AS anon_denied;
