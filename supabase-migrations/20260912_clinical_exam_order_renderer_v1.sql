-- MedicsPro — D2-D2 Exam Order Professional Print Renderer V1
-- Publishes one immutable platform template version for the closed A4 visual contract.
-- No authorization, RLS, grant, capability, lifecycle or authorship boundary changes.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

INSERT INTO public.clinical_document_template_versions(
  id,
  template_id,
  version,
  definition,
  render_definition,
  variables_contract,
  published_at,
  published_by
)
VALUES (
  '12100000-0000-4000-8000-000000000015',
  '12000000-0000-4000-8000-000000000006',
  2,
  '{"kind":"exam_order","fields":["items","clinical_indication","impression","priority","observations"]}'::jsonb,
  '{"layout":"clinical-document/exam-order-v1","title":"Pedido de exames","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb,
  '["patient.name","patient.birth_date","clinic.name","clinic.address","clinic.phone","issuer.name","issuer.professional_type","issuer.specialty","issuer.council_type","issuer.council_state","issuer.registro","appointment.id","issued_at"]'::jsonb,
  now(),
  NULL
)
ON CONFLICT (template_id, version) DO NOTHING;

DO $$
DECLARE
  v public.clinical_document_template_versions%ROWTYPE;
BEGIN
  SELECT * INTO v
  FROM public.clinical_document_template_versions
  WHERE template_id = '12000000-0000-4000-8000-000000000006'::uuid
    AND version = 2;

  IF v.id IS DISTINCT FROM '12100000-0000-4000-8000-000000000015'::uuid
     OR v.published_at IS NULL
     OR v.definition IS DISTINCT FROM '{"kind":"exam_order","fields":["items","clinical_indication","impression","priority","observations"]}'::jsonb
     OR (SELECT count(*) FROM jsonb_object_keys(v.render_definition)) <> 6
     OR v.render_definition ?& ARRAY[
       'layout','title','show_clinic_address','show_clinic_phone','show_patient_birth_date','show_specialty'
     ] IS NOT TRUE
     OR v.render_definition->>'layout' IS DISTINCT FROM 'clinical-document/exam-order-v1'
     OR v.render_definition->>'title' IS DISTINCT FROM 'Pedido de exames'
     OR jsonb_typeof(v.render_definition->'show_clinic_address') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(v.render_definition->'show_clinic_phone') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(v.render_definition->'show_patient_birth_date') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(v.render_definition->'show_specialty') IS DISTINCT FROM 'boolean'
     OR v.variables_contract @> '["patient.name","patient.birth_date","clinic.name","clinic.address","clinic.phone","issuer.name","issuer.professional_type","issuer.specialty","issuer.council_type","issuer.council_state","issuer.registro","appointment.id","issued_at"]'::jsonb IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_exam_order_renderer_v1_version_conflict';
  END IF;
END $$;

UPDATE public.clinical_document_templates t
SET current_version_id = v.id
FROM public.clinical_document_template_versions v
WHERE t.id = '12000000-0000-4000-8000-000000000006'::uuid
  AND t.owner_type = 'platform'
  AND t.document_type = 'exam_order'
  AND t.status = 'active'
  AND v.id = '12100000-0000-4000-8000-000000000015'::uuid
  AND v.template_id = t.id
  AND v.version = 2
  AND v.published_at IS NOT NULL
  AND v.render_definition->>'layout' = 'clinical-document/exam-order-v1'
  AND (
    t.current_version_id = '12100000-0000-4000-8000-000000000006'::uuid
    OR t.current_version_id = v.id
  );

COMMIT;
