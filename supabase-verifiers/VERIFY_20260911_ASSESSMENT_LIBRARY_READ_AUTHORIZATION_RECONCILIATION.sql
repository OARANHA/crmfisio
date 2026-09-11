\set ON_ERROR_STOP on

\echo '1) assessment library RLS + canonical read policies'
DO $$
DECLARE
  v_templates_qual text;
  v_versions_qual text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'assessment_templates' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'assessment_templates_rls_not_enabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'assessment_template_versions' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'assessment_template_versions_rls_not_enabled';
  END IF;

  SELECT qual INTO v_templates_qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'assessment_templates'
    AND policyname = 'assessment_templates_read_available'
    AND cmd = 'SELECT'
    AND permissive = 'PERMISSIVE'
    AND 'authenticated' = ANY(roles);

  IF v_templates_qual IS NULL THEN
    RAISE EXCEPTION 'assessment_templates_read_policy_missing';
  END IF;

  SELECT qual INTO v_versions_qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'assessment_template_versions'
    AND policyname = 'assessment_template_versions_read_available'
    AND cmd = 'SELECT'
    AND permissive = 'PERMISSIVE'
    AND 'authenticated' = ANY(roles);

  IF v_versions_qual IS NULL THEN
    RAISE EXCEPTION 'assessment_template_versions_read_policy_missing';
  END IF;

  -- Detect the exact legacy regression without freezing SQL formatting.
  IF v_templates_qual ILIKE '%current_app_role%'
     OR v_versions_qual ILIKE '%current_app_role%'
     OR v_templates_qual ILIKE '%fisio%'
     OR v_versions_qual ILIKE '%fisio%' THEN
    RAISE EXCEPTION 'assessment_library_legacy_role_gate_detected';
  END IF;

  IF v_templates_qual NOT ILIKE '%current_clinic_id%'
     OR v_versions_qual NOT ILIKE '%current_clinic_id%' THEN
    RAISE EXCEPTION 'assessment_library_active_tenant_boundary_missing';
  END IF;
END $$;

\echo '2) active professional can read platform library without cross-tenant leakage'
SELECT p.id AS verification_professional_id
FROM public.profiles p
WHERE p.ativo IS TRUE
  AND p.clinic_id IS NOT NULL
  AND p.role::text = 'professional'
ORDER BY p.id
LIMIT 1
\gset

\if :{?verification_professional_id}
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'verification_professional_id', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_clinic_id uuid := public.current_clinic_id();
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'verification_professional_has_no_active_clinic';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_templates t
    WHERE t.owner_type = 'platform'
  ) THEN
    RAISE EXCEPTION 'active_professional_cannot_read_platform_assessment_templates';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.assessment_templates t
    WHERE t.owner_type = 'clinic'
      AND t.clinic_id IS DISTINCT FROM v_clinic_id
  ) THEN
    RAISE EXCEPTION 'cross_tenant_assessment_template_visible';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.assessment_template_versions v
    JOIN public.assessment_templates t ON t.id = v.template_id
    WHERE t.owner_type = 'platform'
  ) THEN
    RAISE EXCEPTION 'active_professional_cannot_read_platform_assessment_template_versions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assessment_template_versions v
    JOIN public.assessment_templates t ON t.id = v.template_id
    WHERE t.owner_type = 'clinic'
      AND t.clinic_id IS DISTINCT FROM v_clinic_id
  ) THEN
    RAISE EXCEPTION 'cross_tenant_assessment_template_version_visible';
  END IF;
END $$;
ROLLBACK;
\else
\echo 'NOTICE: no active professional profile available; behavioral professional probe skipped.'
\endif

\echo '3) disabled professional remains fail-closed when one is available'
SELECT p.id AS verification_disabled_id
FROM public.profiles p
WHERE p.ativo IS FALSE
  AND p.role::text = 'professional'
ORDER BY p.id
LIMIT 1
\gset

\if :{?verification_disabled_id}
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'verification_disabled_id', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.current_clinic_id() IS NOT NULL THEN
    RAISE EXCEPTION 'disabled_professional_resolved_active_clinic';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assessment_templates) THEN
    RAISE EXCEPTION 'disabled_professional_can_read_assessment_templates';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assessment_template_versions) THEN
    RAISE EXCEPTION 'disabled_professional_can_read_assessment_template_versions';
  END IF;
END $$;
ROLLBACK;
\else
\echo 'NOTICE: no disabled professional profile available; disabled-user behavioral probe skipped.'
\endif

\echo 'ASSESSMENT LIBRARY READ AUTHORIZATION RECONCILIATION VERIFY PASSED'
