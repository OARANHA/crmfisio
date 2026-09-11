\echo '1) assessments.custom authoring predicate exists and is fail-closed by construction'
SELECT to_regprocedure('public.assessment_custom_authoring_allowed(uuid)') IS NOT NULL AS ok;

\echo '2) no unconfigured fallback remains in custom authoring guards'
SELECT p.proname,
  pg_get_functiondef(p.oid) ILIKE '%assessment_custom_authoring_allowed%' AS uses_fail_closed_predicate,
  pg_get_functiondef(p.oid) NOT ILIKE '%clinic_entitlement_allowed%' AS does_not_use_generic_rollout_predicate
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'require_assessment_template_manager',
    'guard_custom_assessment_template_entitlement',
    'guard_custom_assessment_version_entitlement'
  )
ORDER BY p.proname;

\echo '3) platform templates stay readable without custom authoring gate'
SELECT NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'assessment_templates'
    AND policyname = 'assessment_templates_read_available'
    AND coalesce(qual, '') ILIKE '%assessment_custom_authoring_allowed%'
) AS library_read_is_independent;

\echo '4) published versions retain the immutable trigger'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.assessment_template_versions'::regclass
    AND tgname = 'trg_assessment_version_immutable' AND NOT tgisinternal
) AS immutable_version_guard_present;
