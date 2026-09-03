-- Verification helper — Assessment Engine Phase B
-- Run in staging after applying the Phase A/B migrations.

-- 1. Platform standards must exist and be published.
SELECT
  t.id,
  t.name,
  t.owner_type,
  t.status,
  v.version,
  v.published_at IS NOT NULL AS published
FROM public.assessment_templates t
JOIN public.assessment_template_versions v ON v.template_id = t.id
WHERE t.owner_type = 'platform'
ORDER BY t.name, v.version;

-- Expected: at least the two MedicsPro templates, owner_type=platform,
-- status=active and published=true.

-- 2. Check normalized/integrity constraints used by body map.
SELECT
  conname,
  pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (
  'public.assessment_templates'::regclass,
  'public.assessment_template_versions'::regclass,
  'public.clinical_assessments'::regclass,
  'public.assessment_body_points'::regclass
)
ORDER BY conrelid::regclass::text, conname;

-- 3. Inspect RLS policies. Confirm that template/version reads are limited to
-- owner/admin/fisio and clinic writes are limited to owner/admin.
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'assessment_templates',
    'assessment_template_versions',
    'clinical_assessments',
    'assessment_body_points'
  )
ORDER BY tablename, policyname;

-- 4. Helper RPCs should be executable only by authenticated users.
SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'require_assessment_template_manager',
    'create_clinic_assessment_template',
    'duplicate_standard_assessment_template',
    'create_next_assessment_template_version',
    'publish_assessment_template_version'
  )
ORDER BY p.proname;

-- Expected: anon_execute=false and authenticated_execute=true.

-- Manual role checks to perform with real JWT sessions:
-- A) owner/admin active: list standards + own clinic templates; create/duplicate/edit/publish clinic templates.
-- B) fisio active: list standards + own clinic active templates; cannot create/update/archive templates.
-- C) recep/financeiro: cannot select assessment template schemas/versions.
-- D) Clinic A owner/admin/fisio: cannot read or mutate Clinic B templates.
-- E) Tenant user: cannot update/delete platform templates or published platform versions.
-- F) owner/admin from same clinic but different from created_by: can manage clinic template metadata (no creator lock-in).
