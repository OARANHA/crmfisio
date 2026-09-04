-- MEDICSPRO — Verifier: finalized appointment financial source lock
-- Structural verifier; transactional behavior is covered during self-hosted rollout.

DO $$
DECLARE
  v_trigger_count integer;
  v_function_count integer;
  v_function_def text;
BEGIN
  SELECT count(*) INTO v_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'appointments'
    AND t.tgname = 'trg_guard_finalized_appointment_financial_source'
    AND NOT t.tgisinternal;

  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Expected finalized appointment financial source trigger, found %', v_trigger_count;
  END IF;

  SELECT count(*), max(pg_get_functiondef(p.oid)) INTO v_function_count, v_function_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'guard_finalized_appointment_financial_source'
    AND p.prosecdef = true;

  IF v_function_count <> 1 THEN
    RAISE EXCEPTION 'Expected SECURITY DEFINER guard function, found %', v_function_count;
  END IF;

  IF position('auth.role()' in v_function_def) = 0
     OR position('service_role' in v_function_def) = 0 THEN
    RAISE EXCEPTION 'Financial source guard must restrict bypass using Supabase JWT role';
  END IF;

  IF position('current_app_role' in v_function_def) > 0 THEN
    RAISE EXCEPTION 'NULL application role must not grant repair bypass';
  END IF;

  IF has_function_privilege('anon', 'public.guard_finalized_appointment_financial_source()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute financial source guard directly';
  END IF;

  IF has_function_privilege('authenticated', 'public.guard_finalized_appointment_financial_source()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute financial source guard directly';
  END IF;

  RAISE NOTICE 'FINALIZED_APPOINTMENT_FINANCIAL_SOURCE_LOCK_OK bypass=service_role_or_trusted_db_only';
END $$;
