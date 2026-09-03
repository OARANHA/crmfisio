-- MedicsPro — Assessment Engine integrity hardening
-- Follow-up to the additive foundation migration.

BEGIN;

-- Published template versions are historical contracts and must not be deleted,
-- even before a clinical assessment references them.
CREATE OR REPLACE FUNCTION public.guard_assessment_template_version_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Versão publicada de avaliação não pode ser excluída';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_assessment_version_delete_guard ON public.assessment_template_versions;
CREATE TRIGGER trg_assessment_version_delete_guard
BEFORE DELETE ON public.assessment_template_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_template_version_delete();

-- An inactive professional must lose clinical write access immediately.
DROP POLICY IF EXISTS clinical_assessments_insert_fisio ON public.clinical_assessments;
CREATE POLICY clinical_assessments_insert_fisio
ON public.clinical_assessments
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_app_role() = 'fisio'
  AND status = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND p.clinic_id = clinic_id
  )
);

DROP POLICY IF EXISTS clinical_assessments_update_author ON public.clinical_assessments;
CREATE POLICY clinical_assessments_update_author
ON public.clinical_assessments
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_app_role() = 'fisio'
  AND status = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND p.clinic_id = clinical_assessments.clinic_id
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_app_role() = 'fisio'
  AND status IN ('draft', 'finalized')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND p.clinic_id = clinical_assessments.clinic_id
  )
);

DROP POLICY IF EXISTS assessment_body_points_insert_author ON public.assessment_body_points;
CREATE POLICY assessment_body_points_insert_author
ON public.assessment_body_points
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND p.clinic_id = assessment_body_points.clinic_id
  )
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
      AND a.clinic_id = public.current_clinic_id()
  )
);

DROP POLICY IF EXISTS assessment_body_points_update_author ON public.assessment_body_points;
CREATE POLICY assessment_body_points_update_author
ON public.assessment_body_points
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND p.clinic_id = assessment_body_points.clinic_id
  )
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
  )
);

DROP POLICY IF EXISTS assessment_body_points_delete_author ON public.assessment_body_points;
CREATE POLICY assessment_body_points_delete_author
ON public.assessment_body_points
FOR DELETE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND p.clinic_id = assessment_body_points.clinic_id
  )
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
  )
);

COMMIT;
