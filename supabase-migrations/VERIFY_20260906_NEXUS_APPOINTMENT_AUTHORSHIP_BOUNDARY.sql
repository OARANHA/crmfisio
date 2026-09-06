WITH checks AS (
  SELECT '01_invite_function_exists' AS check_name,
         to_regprocedure('public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)') IS NOT NULL AS ok
  UNION ALL
  SELECT '02_invite_security_definer',
         coalesce((SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)')), false)
  UNION ALL
  SELECT '03_authenticated_execute',
         has_function_privilege('authenticated', 'public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)', 'EXECUTE')
  UNION ALL
  SELECT '04_anon_no_execute',
         NOT has_function_privilege('anon', 'public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)', 'EXECUTE')
  UNION ALL
  SELECT '05_patient_state_boundary',
         position('p.deleted_at IS NULL' in pg_get_functiondef(to_regprocedure('public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)'))) > 0
         AND position('anonimizado' in pg_get_functiondef(to_regprocedure('public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)'))) > 0
  UNION ALL
  SELECT '06_invite_appointment_author',
         position('a.fisio_id = auth.uid()' in pg_get_functiondef(to_regprocedure('public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer)'))) > 0
  UNION ALL
  SELECT '07_result_validator_exists',
         to_regprocedure('public.validate_nexus_result_context()') IS NOT NULL
  UNION ALL
  SELECT '08_result_validator_security_definer',
         coalesce((SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.validate_nexus_result_context()')), false)
  UNION ALL
  SELECT '09_result_appointment_author',
         position('a.fisio_id = NEW.professional_id' in pg_get_functiondef(to_regprocedure('public.validate_nexus_result_context()'))) > 0
  UNION ALL
  SELECT '10_context_trigger_active',
         EXISTS (
           SELECT 1
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public'
             AND c.relname = 'nexus_clinical_results'
             AND t.tgname = 'trg_nexus_result_context'
             AND NOT t.tgisinternal
         )
)
SELECT check_name, ok FROM checks ORDER BY check_name;
