-- MedicsPro — assessment library read authorization reconciliation
--
-- Production drift was observed where an authenticated clinical professional
-- with clinical.assessment.apply could not see any assessment_templates or
-- assessment_template_versions, even though the canonical Assessment Engine
-- foundation makes platform templates tenant-readable.
--
-- Scope is deliberately narrow:
--   * reassert SELECT visibility for platform + same-clinic templates;
--   * require an active tenant profile through current_clinic_id();
--   * keep cross-clinic templates hidden;
--   * do not change authoring/management, clinical-assessment write policies,
--     published-version immutability, capabilities, roles, RPCs or triggers.
--
-- This is a reconciliation migration: DROP + CREATE on the canonical policy
-- names intentionally repairs an upgrade/prod state whose policy definition
-- drifted from the repository contract.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP POLICY IF EXISTS assessment_templates_read_available
  ON public.assessment_templates;
CREATE POLICY assessment_templates_read_available
ON public.assessment_templates
FOR SELECT TO authenticated
USING (
  public.current_clinic_id() IS NOT NULL
  AND (
    owner_type = 'platform'
    OR (
      owner_type = 'clinic'
      AND clinic_id = public.current_clinic_id()
    )
  )
);

COMMENT ON POLICY assessment_templates_read_available
ON public.assessment_templates IS
  'Active tenant users may read platform assessment templates and templates owned by their clinic. Clinical application remains capability-gated separately.';

DROP POLICY IF EXISTS assessment_template_versions_read_available
  ON public.assessment_template_versions;
CREATE POLICY assessment_template_versions_read_available
ON public.assessment_template_versions
FOR SELECT TO authenticated
USING (
  public.current_clinic_id() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.assessment_templates AS t
    WHERE t.id = assessment_template_versions.template_id
      AND (
        t.owner_type = 'platform'
        OR (
          t.owner_type = 'clinic'
          AND t.clinic_id = public.current_clinic_id()
        )
      )
  )
);

COMMENT ON POLICY assessment_template_versions_read_available
ON public.assessment_template_versions IS
  'Active tenant users may read versions of platform assessment templates and templates owned by their clinic; cross-tenant versions remain hidden.';

COMMIT;
