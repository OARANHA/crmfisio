\echo '1) self-authorship guard function exists'
SELECT to_regprocedure('public.guard_legacy_clinical_self_authorship()') IS NOT NULL AS ok;

\echo '2) evaluation self-authorship trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'physiotherapy_evaluations'
    AND t.tgname = 'trg_evaluations_self_authorship' AND NOT t.tgisinternal
) AS ok;

\echo '3) evolution self-authorship trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'physiotherapy_evolutions'
    AND t.tgname = 'trg_evolutions_self_authorship' AND NOT t.tgisinternal
) AS ok;

\echo '4) guard restricts tenant writes to fisio role'
SELECT position('v_role <> ''fisio''' in pg_get_functiondef('public.guard_legacy_clinical_self_authorship()'::regprocedure)) > 0 AS role_guarded;

\echo '5) guard requires professional_id = auth.uid()'
SELECT position('NEW.professional_id IS DISTINCT FROM auth.uid()' in pg_get_functiondef('public.guard_legacy_clinical_self_authorship()'::regprocedure)) > 0 AS self_authored;

\echo '6) guard requires current clinic context'
SELECT position('NEW.clinic_id IS DISTINCT FROM v_clinic_id' in pg_get_functiondef('public.guard_legacy_clinical_self_authorship()'::regprocedure)) > 0 AS tenant_guarded;

\echo '7) author cannot be reassigned on update'
SELECT position('OLD.professional_id IS DISTINCT FROM NEW.professional_id' in pg_get_functiondef('public.guard_legacy_clinical_self_authorship()'::regprocedure)) > 0 AS author_immutable;

\echo '8) authenticated cannot hard-delete evaluations'
SELECT NOT has_table_privilege('authenticated', 'public.physiotherapy_evaluations', 'DELETE') AS delete_denied;

\echo '9) authenticated cannot hard-delete evolutions'
SELECT NOT has_table_privilege('authenticated', 'public.physiotherapy_evolutions', 'DELETE') AS delete_denied;

\echo '10) authenticated cannot directly execute trigger guard'
SELECT NOT has_function_privilege('authenticated', 'public.guard_legacy_clinical_self_authorship()', 'EXECUTE') AS execute_denied;
