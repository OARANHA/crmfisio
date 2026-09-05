\set ON_ERROR_STOP on

\echo '1) finalize guard function exists'
SELECT to_regprocedure('public.require_evolution_before_appointment_finalize()') IS NOT NULL AS ok;

\echo '2) finalize guard trigger exists on appointments'
SELECT EXISTS (
  SELECT 1
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'appointments'
    AND t.tgname = 'trg_require_evolution_before_appointment_finalize'
    AND NOT t.tgisinternal
) AS ok;

\echo '3) guard is scoped to em_atendimento -> finalizado'
SELECT pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) ILIKE '%OLD.status = ''em_atendimento''%'
   AND pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) ILIKE '%NEW.status = ''finalizado''%' AS scoped_transition;

\echo '4) guard applies to authenticated clinical role'
SELECT pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) ILIKE '%v_role = ''fisio''%' AS clinical_guarded;

\echo '5) matching evolution must belong to same session'
SELECT pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) ILIKE '%e.session_id = NEW.id%' AS same_session;

\echo '6) matching evolution must belong to same clinic and patient'
SELECT pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) ILIKE '%e.clinic_id = NEW.clinic_id%'
   AND pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) ILIKE '%e.patient_id = NEW.paciente_id%' AS same_context;

\echo '7) matching evolution must be authored by current professional'
SELECT pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) ILIKE '%e.professional_id = auth.uid()%' AS same_author;

\echo '8) deleted evolutions cannot satisfy finalize gate'
SELECT pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) ILIKE '%e.deleted_at IS NULL%' AS active_only;

\echo '9) authenticated users have no direct execute privilege on trigger function'
SELECT NOT has_function_privilege('authenticated', 'public.require_evolution_before_appointment_finalize()', 'EXECUTE') AS execute_denied;

\echo '10) existing one-active-evolution-per-session invariant remains present'
SELECT to_regclass('public.uq_evolution_active_session') IS NOT NULL AS unique_session_evolution;
