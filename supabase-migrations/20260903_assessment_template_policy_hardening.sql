-- MedicsPro — Assessment template permission hardening
-- Keeps template administration clinic-scoped while avoiding creator lock-in.

BEGIN;

DROP POLICY IF EXISTS assessment_templates_read_available ON public.assessment_templates;
CREATE POLICY assessment_templates_read_available
ON public.assessment_templates
FOR SELECT TO authenticated
USING (
  public.current_app_role() IN ('owner', 'admin', 'fisio')
  AND (
    owner_type = 'platform'
    OR clinic_id = public.current_clinic_id()
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true
  )
);

DROP POLICY IF EXISTS assessment_templates_manage_clinic ON public.assessment_templates;
DROP POLICY IF EXISTS assessment_templates_insert_clinic ON public.assessment_templates;
DROP POLICY IF EXISTS assessment_templates_update_clinic ON public.assessment_templates;
DROP POLICY IF EXISTS assessment_templates_delete_clinic ON public.assessment_templates;

CREATE POLICY assessment_templates_insert_clinic
ON public.assessment_templates
FOR INSERT TO authenticated
WITH CHECK (
  owner_type = 'clinic'
  AND clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true
  )
);

CREATE POLICY assessment_templates_update_clinic
ON public.assessment_templates
FOR UPDATE TO authenticated
USING (
  owner_type = 'clinic'
  AND clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true
  )
)
WITH CHECK (
  owner_type = 'clinic'
  AND clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
);

CREATE POLICY assessment_templates_delete_clinic
ON public.assessment_templates
FOR DELETE TO authenticated
USING (
  owner_type = 'clinic'
  AND clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true
  )
);

DROP POLICY IF EXISTS assessment_versions_read_available ON public.assessment_template_versions;
CREATE POLICY assessment_versions_read_available
ON public.assessment_template_versions
FOR SELECT TO authenticated
USING (
  public.current_app_role() IN ('owner', 'admin', 'fisio')
  AND EXISTS (
    SELECT 1
    FROM public.assessment_templates t
    WHERE t.id = template_id
      AND (t.owner_type = 'platform' OR t.clinic_id = public.current_clinic_id())
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true
  )
);

COMMIT;
