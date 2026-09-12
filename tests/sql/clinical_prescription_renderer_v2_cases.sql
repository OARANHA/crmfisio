-- D2-B.2C behavior matrix.
-- Safe visual presets remain template configuration, never clinical authorization.

DROP TABLE IF EXISTS d2b2c_results;
CREATE TEMP TABLE d2b2c_results(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON d2b2c_results TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.d2b2c_expect_error(
  p_name text,
  p_sql text,
  p_expected text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    ok := p_expected IS NULL OR position(lower(p_expected) in lower(SQLERRM)) > 0;
  END;
  INSERT INTO d2b2c_results VALUES (p_name, ok);
END;
$$;

-- Admin creates a clinic template and upgrades its presentation atomically.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000006',true);

SELECT (public.create_clinic_clinical_document_template(
  'Receita Renderer V2',
  'Template de teste antes do upgrade visual',
  '{"specialty":"clinica_medica"}'::jsonb,
  '{"kind":"medication_prescription","fields":["items","observations"]}'::jsonb,
  '{"layout":"clinical-document/plain-text-v1"}'::jsonb,
  '["patient.name","issuer.name","issuer.registro","appointment.id"]'::jsonb
)).id AS d2b2c_template \gset

SELECT current_version_id AS d2b2c_v1
FROM public.list_clinical_document_templates_for_management('medication_prescription')
WHERE template_id = :'d2b2c_template'::uuid \gset

SELECT public.save_clinic_prescription_template_presentation(
  :'d2b2c_template'::uuid,
  'Receita Renderer V2',
  'Template com renderer seguro e versionado',
  '{"specialty":"clinica_medica"}'::jsonb,
  '{"layout":"clinical-document/prescription-v2","preset":"institutional","accent":"navy","title":"Prescrição médica","medication_style":"cards","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb
);

SELECT current_version_id AS d2b2c_v2, current_version AS d2b2c_version_no
FROM public.list_clinical_document_templates_for_management('medication_prescription')
WHERE template_id = :'d2b2c_template'::uuid \gset

INSERT INTO d2b2c_results VALUES
('presentation_save_publishes_new_version', :'d2b2c_v2'::uuid IS DISTINCT FROM :'d2b2c_v1'::uuid AND :'d2b2c_version_no'::int = 2),
('presentation_save_keeps_clinic_metadata', EXISTS (
  SELECT 1
  FROM public.list_clinical_document_templates_for_management('medication_prescription')
  WHERE template_id = :'d2b2c_template'::uuid
    AND description = 'Template com renderer seguro e versionado'
    AND render_definition->>'layout' = 'clinical-document/prescription-v2'
    AND render_definition->>'preset' = 'institutional'
));

-- Metadata-only save with identical renderer must not create version noise.
SELECT public.save_clinic_prescription_template_presentation(
  :'d2b2c_template'::uuid,
  'Receita Renderer V2 renomeada',
  'Somente metadados',
  '{"specialty":"clinica_medica"}'::jsonb,
  '{"layout":"clinical-document/prescription-v2","preset":"institutional","accent":"navy","title":"Prescrição médica","medication_style":"cards","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb
);

INSERT INTO d2b2c_results VALUES
('identical_renderer_does_not_publish_extra_version', (
  SELECT current_version = 2
  FROM public.list_clinical_document_templates_for_management('medication_prescription')
  WHERE template_id = :'d2b2c_template'::uuid
));

SELECT pg_temp.d2b2c_expect_error(
  'arbitrary_html_key_denied',
  format(
    'SELECT public.save_clinic_prescription_template_presentation(%L::uuid,%L,%L,%L::jsonb,%L::jsonb)',
    :'d2b2c_template', 'Unsafe', '', '{}',
    '{"layout":"clinical-document/prescription-v2","preset":"classic","accent":"monochrome","title":"Receita","medication_style":"numbered","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true,"html":"<script>alert(1)</script>"}'
  ),
  'clinical_document_template_renderer_invalid'
);

SELECT pg_temp.d2b2c_expect_error(
  'platform_template_edit_denied',
  $$SELECT public.save_clinic_prescription_template_presentation(
      '12000000-0000-4000-8000-000000000001',
      'Não pode', '', '{}'::jsonb,
      '{"layout":"clinical-document/prescription-v2","preset":"classic","accent":"monochrome","title":"Receita","medication_style":"numbered","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb
    )$$,
  'clinical_document_clinic_template_required'
);

SELECT pg_temp.d2b2c_expect_error(
  'cross_tenant_presentation_edit_denied',
  $$SELECT public.save_clinic_prescription_template_presentation(
      'd2500000-0000-4000-8000-000000000001',
      'Não pode', '', '{}'::jsonb,
      '{"layout":"clinical-document/prescription-v2","preset":"classic","accent":"monochrome","title":"Receita","medication_style":"numbered","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb
    )$$,
  'clinical_document_clinic_template_required'
);
COMMIT;

-- Professional uses the published version through the unchanged D2-A clinical boundary.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);

SELECT pg_temp.d2b2c_expect_error(
  'professional_cannot_manage_presentation',
  format(
    'SELECT public.save_clinic_prescription_template_presentation(%L::uuid,%L,%L,%L::jsonb,%L::jsonb)',
    :'d2b2c_template', 'Não pode', '', '{}',
    '{"layout":"clinical-document/prescription-v2","preset":"classic","accent":"monochrome","title":"Receita","medication_style":"numbered","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'
  ),
  'clinical_document_template_manager_required'
);

SELECT (public.create_clinical_document_draft(
  'd2300000-0000-4000-8000-000000000001',
  :'d2b2c_v2'::uuid,
  '{"items":[{"medication_name":"Dipirona 500 mg","dose":"1 comprimido","route":"oral","frequency":"8/8h","duration":"3 dias","instructions":"Se dor"}],"observations":"Hidratar-se."}'::jsonb
)).id AS d2b2c_document \gset

SELECT public.issue_clinical_document(:'d2b2c_document'::uuid);
COMMIT;

INSERT INTO d2b2c_results VALUES
('issued_snapshot_freezes_v2_renderer', EXISTS (
  SELECT 1
  FROM public.clinical_documents
  WHERE id = :'d2b2c_document'::uuid
    AND status = 'issued'
    AND template_version_id = :'d2b2c_v2'::uuid
    AND template_definition_snapshot->'render_definition'->>'layout' = 'clinical-document/prescription-v2'
    AND template_definition_snapshot->'render_definition'->>'preset' = 'institutional'
    AND template_definition_snapshot->>'template_name' = 'Receita Renderer V2 renomeada'
)),
('issued_context_freezes_print_identity', EXISTS (
  SELECT 1
  FROM public.clinical_documents
  WHERE id = :'d2b2c_document'::uuid
    AND context_snapshot->'patient'->>'birth_date' = '1985-03-15'
    AND context_snapshot->'clinic'->>'address' = 'Av. Clínica, 100 - Porto Alegre/RS'
    AND context_snapshot->'clinic'->>'phone' = '(51) 3333-4444'
    AND context_snapshot->'issuer'->>'registro' = 'D2-CRM-1'
)),
('plain_text_audit_snapshot_preserved', EXISTS (
  SELECT 1
  FROM public.clinical_documents
  WHERE id = :'d2b2c_document'::uuid
    AND btrim(coalesce(rendered_snapshot, '')) <> ''
    AND renderer_version = 'd2-a/plain-text-v1'
));

CREATE TEMP TABLE d2b2c_issued_before AS
SELECT template_version_id, template_definition_snapshot, payload_snapshot,
       context_snapshot, rendered_snapshot, renderer_version
FROM public.clinical_documents
WHERE id = :'d2b2c_document'::uuid;

-- Later admin visual evolution must not rewrite the already issued prescription.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000006',true);
SELECT public.save_clinic_prescription_template_presentation(
  :'d2b2c_template'::uuid,
  'Receita Renderer V2 renomeada',
  'Terceira versão visual',
  '{"specialty":"clinica_medica"}'::jsonb,
  '{"layout":"clinical-document/prescription-v2","preset":"compact","accent":"emerald","title":"Receita médica","medication_style":"numbered","show_clinic_address":false,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb
);
COMMIT;

INSERT INTO d2b2c_results VALUES
('issued_document_immutable_after_template_v3', EXISTS (
  SELECT 1
  FROM public.clinical_documents d
  CROSS JOIN d2b2c_issued_before b
  WHERE d.id = :'d2b2c_document'::uuid
    AND d.template_version_id IS NOT DISTINCT FROM b.template_version_id
    AND d.template_definition_snapshot IS NOT DISTINCT FROM b.template_definition_snapshot
    AND d.payload_snapshot IS NOT DISTINCT FROM b.payload_snapshot
    AND d.context_snapshot IS NOT DISTINCT FROM b.context_snapshot
    AND d.rendered_snapshot IS NOT DISTINCT FROM b.rendered_snapshot
    AND d.renderer_version IS NOT DISTINCT FROM b.renderer_version
));

DO $$
DECLARE v_failed text;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY name)
  INTO v_failed
  FROM d2b2c_results
  WHERE passed IS NOT TRUE;

  IF v_failed IS NOT NULL THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_cases_failed: %', v_failed;
  END IF;
END $$;

SELECT count(*) AS passed_cases
FROM d2b2c_results
WHERE passed IS TRUE;

SELECT 'CLINICAL PRESCRIPTION RENDERER V2 BEHAVIOR PASSED' AS result;