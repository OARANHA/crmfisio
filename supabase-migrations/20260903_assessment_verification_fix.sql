BEGIN;

REVOKE EXECUTE ON FUNCTION public.require_assessment_template_manager() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_clinic_assessment_template(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_standard_assessment_template(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_next_assessment_template_version(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.publish_assessment_template_version(uuid, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.require_assessment_template_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_clinic_assessment_template(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_standard_assessment_template(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_next_assessment_template_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_assessment_template_version(uuid, uuid) TO authenticated;

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
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.ativo = true
      AND pr.clinic_id = clinical_assessments.clinic_id
  )
);

COMMIT;
