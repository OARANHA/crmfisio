-- MEDICSPRO — Verifier: finalized appointment financial source lock

SELECT '1) finalized financial source guard function exists' AS check;
SELECT EXISTS (
  SELECT 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'guard_finalized_appointment_financial_source'
    AND p.prosecdef = true
) AS ok;

SELECT '2) finalized financial source trigger exists' AS check;
SELECT EXISTS (
  SELECT 1
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'appointments'
    AND t.tgname = 'trg_guard_finalized_appointment_financial_source'
    AND NOT t.tgisinternal
) AS ok;

SELECT '3) guard applies only after appointment is finalized' AS check;
SELECT position('OLD.status = ''finalizado''' in pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure)) > 0
  AS finalized_scoped;

SELECT '4) package source becomes immutable' AS check;
SELECT position('NEW.pacote_id IS DISTINCT FROM OLD.pacote_id' in pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure)) > 0
  AS package_locked;

SELECT '5) appointment amount becomes immutable' AS check;
SELECT position('NEW.valor IS DISTINCT FROM OLD.valor' in pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure)) > 0
  AS amount_locked;

SELECT '6) patient identity becomes immutable' AS check;
SELECT position('NEW.paciente_id IS DISTINCT FROM OLD.paciente_id' in pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure)) > 0
  AS patient_locked;

SELECT '7) tenant identity becomes immutable' AS check;
SELECT position('NEW.clinic_id IS DISTINCT FROM OLD.clinic_id' in pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure)) > 0
  AS tenant_locked;

SELECT '8) repair bypass is restricted to service role or trusted DB session' AS check;
SELECT (
  position('auth.role()' in pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure)) > 0
  AND position('service_role' in pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure)) > 0
  AND position('session_user' in pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure)) > 0
) AS controlled_bypass;

SELECT '9) NULL clinic app role cannot bypass the lock' AS check;
SELECT position('current_app_role' in pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure)) = 0
  AS no_null_role_bypass;

SELECT '10) authenticated and anon cannot execute guard directly' AS check;
SELECT
  NOT has_function_privilege('authenticated', 'public.guard_finalized_appointment_financial_source()', 'EXECUTE') AS authenticated_denied,
  NOT has_function_privilege('anon', 'public.guard_finalized_appointment_financial_source()', 'EXECUTE') AS anon_denied;
