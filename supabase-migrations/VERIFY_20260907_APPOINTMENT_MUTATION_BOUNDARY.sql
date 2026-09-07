\set ON_ERROR_STOP on

\echo '1) appointment mutation guard exists'
SELECT to_regprocedure('public.guard_appointment_mutation_boundary()') IS NOT NULL AS ok;

\echo '2) appointment mutation trigger covers insert and update'
SELECT EXISTS (
  SELECT 1
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'appointments'
    AND t.tgname = 'trg_guard_appointment_mutation_boundary'
    AND NOT t.tgisinternal
    AND pg_get_triggerdef(t.oid) ILIKE '%BEFORE INSERT OR UPDATE%'
) AS ok;

\echo '3) authenticated session without active tenant role fails closed'
SELECT (
  pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%appointment_active_tenant_role_required%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%v_jwt_role = ''service_role''%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%session_user IN (''postgres'', ''supabase_admin'')%'
) AS hardened;

\echo '4) fisio direct insert/update fails closed outside own agenda'
SELECT (
  pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%appointment_fisio_self_assignment_required%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%appointment_fisio_self_mutation_required%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%OLD.fisio_id IS DISTINCT FROM auth.uid()%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%NEW.fisio_id IS DISTINCT FROM auth.uid()%'
) AS hardened;

\echo '5) structural/source fields require canonical flow'
SELECT (
  pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%appointment_structural_update_requires_canonical_flow%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%NEW.paciente_id IS DISTINCT FROM OLD.paciente_id%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%NEW.fisio_id IS DISTINCT FROM OLD.fisio_id%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%NEW.data IS DISTINCT FROM OLD.data%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%NEW.inicio IS DISTINCT FROM OLD.inicio%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%NEW.fim IS DISTINCT FROM OLD.fim%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%NEW.valor IS DISTINCT FROM OLD.valor%'
  AND pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure)
    LIKE '%NEW.pacote_id IS DISTINCT FROM OLD.pacote_id%'
) AS hardened;

\echo '6) canonical reschedule RPC remains installed'
SELECT to_regprocedure('public.reschedule_appointment(uuid,date,time without time zone,time without time zone,uuid,uuid,text,boolean)') IS NOT NULL AS ok;

\echo '7) clinical self-transition and status workflow guards remain installed'
SELECT
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'appointments'
      AND t.tgname = 'trg_appointment_clinical_self_transition' AND NOT t.tgisinternal
  ) AS clinical_self_guard,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'appointments'
      AND t.tgname = 'trg_guard_appointment_status_transition' AND NOT t.tgisinternal
  ) AS status_guard;
