-- MedicsPro — D2-C.1 Therapeutic Guidance Professional Print Renderer V1
-- Publishes immutable platform template versions for the closed visual contract.
-- No authorization, RLS, grant, capability or clinical authorship boundary changes.

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
VALUES
(
  '12100000-0000-4000-8000-000000000013',
  '12000000-0000-4000-8000-000000000003',
  2,
  '{"kind":"therapeutic_guidance","fields":["items","patient_instructions","observations"]}'::jsonb,
  '{"layout":"clinical-document/therapeutic-guidance-v1","title":"Orientações terapêuticas","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb,
  '["patient.name","patient.birth_date","clinic.name","clinic.address","clinic.phone","issuer.name","issuer.professional_type","issuer.specialty","issuer.council_type","issuer.council_state","issuer.registro","appointment.id","issued_at"]'::jsonb,
  now(),
  NULL
),
(
  '12100000-0000-4000-8000-000000000014',
  '12000000-0000-4000-8000-000000000004',
  2,
  '{"kind":"therapeutic_guidance","fields":["items","patient_instructions","observations"]}'::jsonb,
  '{"layout":"clinical-document/therapeutic-guidance-v1","title":"Orientações pós-atendimento","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb,
  '["patient.name","patient.birth_date","clinic.name","clinic.address","clinic.phone","issuer.name","issuer.professional_type","issuer.specialty","issuer.council_type","issuer.council_state","issuer.registro","appointment.id","issued_at"]'::jsonb,
  now(),
  NULL
)
ON CONFLICT (template_id, version) DO NOTHING;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
  INTO v_count
  FROM public.clinical_document_template_versions v
  WHERE v.template_id IN (
      '12000000-0000-4000-8000-000000000003'::uuid,
      '12000000-0000-4000-8000-000000000004'::uuid
    )
    AND v.version = 2
    AND v.published_at IS NOT NULL
    AND v.definition = '{"kind":"therapeutic_guidance","fields":["items","patient_instructions","observations"]}'::jsonb
    AND jsonb_object_length(v.render_definition) = 6
    AND v.render_definition ?& ARRAY[
      'layout',
      'title',
      'show_clinic_address',
      'show_clinic_phone',
      'show_patient_birth_date',
      'show_specialty'
    ]
    AND v.render_definition->>'layout' = 'clinical-document/therapeutic-guidance-v1'
    AND jsonb_typeof(v.render_definition->'title') = 'string'
    AND nullif(btrim(v.render_definition->>'title'), '') IS NOT NULL
    AND length(v.render_definition->>'title') <= 80
    AND jsonb_typeof(v.render_definition->'show_clinic_address') = 'boolean'
    AND jsonb_typeof(v.render_definition->'show_clinic_phone') = 'boolean'
    AND jsonb_typeof(v.render_definition->'show_patient_birth_date') = 'boolean'
    AND jsonb_typeof(v.render_definition->'show_specialty') = 'boolean'
    AND v.variables_contract @> '["patient.name","patient.birth_date","clinic.name","clinic.address","clinic.phone","issuer.name","issuer.professional_type","issuer.specialty","issuer.council_type","issuer.council_state","issuer.registro","appointment.id","issued_at"]'::jsonb;

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'clinical_therapeutic_guidance_renderer_v1_version_conflict';
  END IF;
END $$;

UPDATE public.clinical_document_templates t
SET current_version_id = v.id
FROM public.clinical_document_template_versions v
WHERE v.template_id = t.id
  AND v.version = 2
  AND v.published_at IS NOT NULL
  AND jsonb_object_length(v.render_definition) = 6
  AND v.render_definition->>'layout' = 'clinical-document/therapeutic-guidance-v1'
  AND t.owner_type = 'platform'
  AND t.document_type = 'therapeutic_guidance'
  AND t.status = 'active'
  AND t.id IN (
    '12000000-0000-4000-8000-000000000003'::uuid,
    '12000000-0000-4000-8000-000000000004'::uuid
  )
  AND (
    t.current_version_id IN (
      '12100000-0000-4000-8000-000000000003'::uuid,
      '12100000-0000-4000-8000-000000000004'::uuid
    )
    OR t.current_version_id = v.id
  );

COMMIT;
