-- Verification checklist for 20260903_assessment_engine_foundation.sql
-- Run after applying the migration in a staging database.

-- 1. Tables exist.
SELECT to_regclass('public.assessment_templates') AS assessment_templates,
       to_regclass('public.assessment_template_versions') AS assessment_template_versions,
       to_regclass('public.clinical_assessments') AS clinical_assessments,
       to_regclass('public.assessment_body_points') AS assessment_body_points;

-- 2. RLS is enabled on every new table.
SELECT relname, relrowsecurity
FROM pg_class
WHERE oid IN (
  'public.assessment_templates'::regclass,
  'public.assessment_template_versions'::regclass,
  'public.clinical_assessments'::regclass,
  'public.assessment_body_points'::regclass
)
ORDER BY relname;

-- 3. Expected policies are present.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'assessment_templates',
    'assessment_template_versions',
    'clinical_assessments',
    'assessment_body_points'
  )
ORDER BY tablename, policyname;

-- 4. Integrity constraints for normalized body coordinates and pain intensity.
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.assessment_body_points'::regclass
ORDER BY conname;

-- 5. Published versions must be immutable. In a transaction on staging, publish
-- a clinic-owned version, then attempt to UPDATE schema; it must raise:
-- 'Versão publicada de avaliação é imutável'.

-- 6. Clinical authorization tests must be executed with real JWTs:
-- - fisio active, same tenant: can create draft/finalize own assessment;
-- - owner/admin: can read clinical assessment but cannot INSERT/UPDATE clinical act;
-- - recep/financeiro: cannot read clinical assessment payload;
-- - inactive fisio: cannot create assessment;
-- - Clinic A user cannot read Clinic B clinic templates/assessments/body points;
-- - tenant cannot UPDATE/DELETE platform-owned template;
-- - fisio cannot attach another clinic's patient/appointment/template/version;
-- - finalized assessment cannot be overwritten;
-- - body points cannot be modified after assessment finalization.

-- 7. Legacy path remains present/readable during transition.
SELECT to_regclass('public.physiotherapy_evaluations') AS legacy_evaluations,
       to_regclass('public.physiotherapy_evolutions') AS legacy_evolutions;
