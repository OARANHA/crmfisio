-- D2-B.2A behavior matrix.
-- Management authority is deliberately independent from clinical authorship.

UPDATE public.appointments
SET status = 'em_atendimento'
WHERE id = 'd2300000-0000-4000-8000-000000000001';

DROP TABLE IF EXISTS d2b2a_results;
CREATE TEMP TABLE d2b2a_results(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON d2b2a_results TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.d2b2a_expect_error(
  p_name text,
  p_sql text,
  p_expected text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  ok boolean := false;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    ok := p_expected IS NULL OR position(lower(p_expected) in lower(SQLERRM)) > 0;
  END;
  INSERT INTO d2b2a_results VALUES (p_name, ok);
END;
$$;

-- Admin A: no medical identity, but tenant administration is allowed.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000006',true);

INSERT INTO d2b2a_results VALUES
  ('admin_management_list_allowed', (
    SELECT count(*) >= 2
       AND bool_and(document_type = 'medication_prescription')
       AND bool_and((owner_type = 'platform') = read_only)
    FROM public.list_clinical_document_templates_for_management('medication_prescription')
  ));

SELECT template_id AS d2b2a_platform_template
FROM public.list_clinical_document_templates_for_management('medication_prescription')
WHERE owner_type = 'platform'
ORDER BY template_id
LIMIT 1 \gset

SELECT (public.create_clinic_clinical_document_template(
  'Receita da clínica',
  'Modelo administrável sem conceder autoria clínica',
  '{"specialty":"clinica_medica"}'::jsonb,
  '{"kind":"medication_prescription","fields":["items","observations"]}'::jsonb,
  '{"layout":"clinical-document/plain-text-v1"}'::jsonb,
  '["patient.name","issuer.name","issuer.registro","appointment.id"]'::jsonb
)).id AS d2b2a_clinic_template \gset

SELECT current_version_id AS d2b2a_v1
FROM public.list_clinical_document_templates_for_management('medication_prescription')
WHERE template_id = :'d2b2a_clinic_template'::uuid \gset

SELECT (public.clone_clinical_document_template_to_clinic(
  :'d2b2a_platform_template'::uuid,
  'Cópia clínica segura',
  'Clone independente do modelo MedicsPro'
)).id AS d2b2a_clone_template \gset

INSERT INTO d2b2a_results VALUES
  ('admin_without_crm_can_create', EXISTS (
    SELECT 1
    FROM public.list_clinical_document_templates_for_management('medication_prescription')
    WHERE template_id = :'d2b2a_clinic_template'::uuid
      AND owner_type = 'clinic'
      AND read_only = false
      AND current_version = 1
  )),
  ('platform_clone_becomes_independent_clinic_template', EXISTS (
    SELECT 1
    FROM public.list_clinical_document_templates_for_management('medication_prescription')
    WHERE template_id = :'d2b2a_clone_template'::uuid
      AND owner_type = 'clinic'
      AND clinic_id = 'd2000000-0000-4000-8000-000000000001'::uuid
      AND current_version = 1
      AND read_only = false
  ));

SELECT pg_temp.d2b2a_expect_error(
  'admin_cannot_issue_by_management_role',
  format(
    'SELECT public.create_clinical_document_draft(%L::uuid,%L::uuid,%L::jsonb)',
    'd2300000-0000-4000-8000-000000000001', :'d2b2a_v1', '{}'
  ),
  'clinical_document_eligibility_required'
);
SELECT pg_temp.d2b2a_expect_error(
  'direct_template_insert_still_denied',
  $$INSERT INTO public.clinical_document_templates(owner_type,clinic_id,document_type,name)
    VALUES('clinic','d2000000-0000-4000-8000-000000000001','medication_prescription','direto indevido')$$,
  NULL
);
SELECT pg_temp.d2b2a_expect_error(
  'direct_version_insert_still_denied',
  format(
    'INSERT INTO public.clinical_document_template_versions(template_id,version,definition,render_definition,variables_contract) VALUES(%L::uuid,99,%L::jsonb,%L::jsonb,%L::jsonb)',
    :'d2b2a_clinic_template',
    '{"kind":"medication_prescription","fields":["items"]}',
    '{"layout":"clinical-document/plain-text-v1"}',
    '[]'
  ),
  NULL
);
SELECT pg_temp.d2b2a_expect_error(
  'platform_template_metadata_mutation_denied',
  format(
    'SELECT public.update_clinic_clinical_document_template_metadata(%L::uuid,%L,%L,%L::jsonb,%L)',
    :'d2b2a_platform_template', 'Não pode', '', '{}', 'active'
  ),
  'clinical_document_clinic_template_required'
);
SELECT pg_temp.d2b2a_expect_error(
  'cross_tenant_metadata_mutation_denied',
  $$SELECT public.update_clinic_clinical_document_template_metadata(
      'd2500000-0000-4000-8000-000000000001','Não pode','','{}'::jsonb,'active')$$,
  'clinical_document_clinic_template_required'
);
SELECT pg_temp.d2b2a_expect_error(
  'cross_tenant_clone_denied',
  $$SELECT public.clone_clinical_document_template_to_clinic(
      'd2500000-0000-4000-8000-000000000001',NULL,NULL)$$,
  'clinical_document_template_clone_source_denied'
);
SELECT pg_temp.d2b2a_expect_error(
  'freeform_renderer_denied',
  format(
    'SELECT public.publish_clinic_clinical_document_template_version(%L::uuid,%L::jsonb,%L::jsonb,%L::jsonb)',
    :'d2b2a_clinic_template',
    '{"kind":"medication_prescription","fields":["items"]}',
    '{"layout":"html","html":"<script>alert(1)</script>"}',
    '["patient.name"]'
  ),
  'clinical_document_template_renderer_invalid'
);
SELECT pg_temp.d2b2a_expect_error(
  'unknown_template_field_denied',
  format(
    'SELECT public.publish_clinic_clinical_document_template_version(%L::uuid,%L::jsonb,%L::jsonb,%L::jsonb)',
    :'d2b2a_clinic_template',
    '{"kind":"medication_prescription","fields":["items","unsafe_html"]}',
    '{"layout":"clinical-document/plain-text-v1"}',
    '["patient.name"]'
  ),
  'clinical_document_template_fields_invalid'
);
COMMIT;

-- Professional A may issue using a clinic-owned published version, but cannot
-- administer templates just because the professional has clinical.documents.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
SELECT pg_temp.d2b2a_expect_error(
  'professional_management_denied',
  $$SELECT * FROM public.list_clinical_document_templates_for_management('medication_prescription')$$,
  'clinical_document_template_manager_required'
);
SELECT (public.create_clinical_document_draft(
  'd2300000-0000-4000-8000-000000000001',
  :'d2b2a_v1'::uuid,
  '{"items":[{"medication_name":"Snapshot D2-B.2A"}],"observations":"versão original"}'::jsonb
)).id AS d2b2a_document \gset
SELECT public.issue_clinical_document(:'d2b2a_document'::uuid);
COMMIT;

CREATE TEMP TABLE d2b2a_issued_before AS
SELECT id, template_version_id, template_definition_snapshot, payload_snapshot,
       context_snapshot, rendered_snapshot, renderer_version, issued_at, issued_by
FROM public.clinical_documents
WHERE id = :'d2b2a_document'::uuid;

-- Admin publishes a new append-only version after the historical prescription.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000006',true);
SELECT (public.publish_clinic_clinical_document_template_version(
  :'d2b2a_clinic_template'::uuid,
  '{"kind":"medication_prescription","fields":["items"]}'::jsonb,
  '{"layout":"clinical-document/plain-text-v1"}'::jsonb,
  '["patient.name","issuer.name","issuer.registro","appointment.id"]'::jsonb
)).id AS d2b2a_v2 \gset

SELECT public.update_clinic_clinical_document_template_metadata(
  :'d2b2a_clinic_template'::uuid,
  'Receita da clínica atualizada',
  'Metadados alteráveis sem tocar versões históricas',
  '{"specialty":"clinica_medica","priority":10}'::jsonb,
  'active'
);

INSERT INTO d2b2a_results VALUES
  ('publish_advances_current_version', EXISTS (
    SELECT 1
    FROM public.list_clinical_document_templates_for_management('medication_prescription')
    WHERE template_id = :'d2b2a_clinic_template'::uuid
      AND current_version_id = :'d2b2a_v2'::uuid
      AND current_version = 2
      AND name = 'Receita da clínica atualizada'
  ));
COMMIT;

INSERT INTO d2b2a_results VALUES
  ('issued_snapshot_survives_template_v2', EXISTS (
    SELECT 1
    FROM public.clinical_documents d
    JOIN d2b2a_issued_before b ON b.id = d.id
    WHERE d.template_version_id = b.template_version_id
      AND d.template_definition_snapshot IS NOT DISTINCT FROM b.template_definition_snapshot
      AND d.payload_snapshot IS NOT DISTINCT FROM b.payload_snapshot
      AND d.context_snapshot IS NOT DISTINCT FROM b.context_snapshot
      AND d.rendered_snapshot IS NOT DISTINCT FROM b.rendered_snapshot
      AND d.renderer_version IS NOT DISTINCT FROM b.renderer_version
      AND d.issued_at IS NOT DISTINCT FROM b.issued_at
      AND d.issued_by IS NOT DISTINCT FROM b.issued_by
  ));

SELECT pg_temp.d2b2a_expect_error(
  'published_v1_update_immutable',
  format(
    'UPDATE public.clinical_document_template_versions SET definition=%L::jsonb WHERE id=%L::uuid',
    '{"kind":"medication_prescription","fields":["items"]}', :'d2b2a_v1'
  ),
  'clinical_document_published_version_immutable'
);
SELECT pg_temp.d2b2a_expect_error(
  'published_v1_delete_immutable',
  format('DELETE FROM public.clinical_document_template_versions WHERE id=%L::uuid', :'d2b2a_v1'),
  'clinical_document_published_version_immutable'
);

-- Owner is also a tenant manager, independently of clinical identity.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000005',true);
INSERT INTO d2b2a_results VALUES
  ('owner_management_allowed', (SELECT count(*) >= 4 FROM public.list_clinical_document_templates_for_management('medication_prescription')));
COMMIT;

-- Reception, finance, care professionals and unscoped/platform-only actors do
-- not inherit tenant template-management authority.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000011',true);
SELECT pg_temp.d2b2a_expect_error('recep_management_denied', $$SELECT * FROM public.list_clinical_document_templates_for_management('medication_prescription')$$, 'clinical_document_template_manager_required');
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000012',true);
SELECT pg_temp.d2b2a_expect_error('financeiro_management_denied', $$SELECT * FROM public.list_clinical_document_templates_for_management('medication_prescription')$$, 'clinical_document_template_manager_required');
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000099',true);
SELECT pg_temp.d2b2a_expect_error('platform_or_unscoped_management_denied', $$SELECT * FROM public.list_clinical_document_templates_for_management('medication_prescription')$$, 'clinical_document_template_manager_required');
COMMIT;

-- Archiving removes the clinic template from issuer visibility without deleting
-- historical versions or issued documents.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000006',true);
SELECT public.update_clinic_clinical_document_template_metadata(
  :'d2b2a_clinic_template'::uuid,
  'Receita da clínica atualizada',
  'Arquivada administrativamente',
  '{"specialty":"clinica_medica"}'::jsonb,
  'archived'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
INSERT INTO d2b2a_results VALUES
  ('archived_template_hidden_from_issuer', NOT EXISTS (
    SELECT 1 FROM public.clinical_document_templates WHERE id = :'d2b2a_clinic_template'::uuid
  )),
  ('issued_document_survives_template_archive', EXISTS (
    SELECT 1 FROM public.clinical_documents
    WHERE id = :'d2b2a_document'::uuid AND status = 'issued'
  ));
COMMIT;

SELECT string_agg(name, ', ' ORDER BY name) AS failed_cases
FROM d2b2a_results
WHERE passed IS NOT TRUE
\gset

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM d2b2a_results WHERE passed IS NOT TRUE) THEN
    RAISE EXCEPTION 'clinical_document_template_admin_cases_failed: %', :'failed_cases';
  END IF;
END $$;

SELECT count(*) AS passed_cases
FROM d2b2a_results
WHERE passed IS TRUE;
