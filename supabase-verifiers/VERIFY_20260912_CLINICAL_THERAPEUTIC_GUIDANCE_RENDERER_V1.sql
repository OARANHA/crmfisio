-- MedicsPro — D2-C.1 production-safe verifier
-- Read-only structural checks. ROLLBACK is intentional and does not undo a separately committed migration.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  v_issue_def text;
BEGIN
  IF to_regclass('public.clinical_document_templates') IS NULL
     OR to_regclass('public.clinical_document_template_versions') IS NULL
     OR to_regclass('public.clinical_documents') IS NULL THEN
    RAISE EXCEPTION 'clinical_therapeutic_guidance_renderer_v1_foundation_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.clinical_document_template_versions'::regclass
      AND t.tgname = 'trg_clinical_document_template_version_immutable'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'clinical_therapeutic_guidance_renderer_v1_version_immutability_missing';
  END IF;

  IF (
    SELECT count(*)
    FROM public.clinical_document_template_versions v
    WHERE v.template_id IN (
      '12000000-0000-4000-8000-000000000003'::uuid,
      '12000000-0000-4000-8000-000000000004'::uuid
    )
      AND v.version = 1
      AND v.published_at IS NOT NULL
      AND v.render_definition = '{"layout":"clinical-document/plain-text-v1"}'::jsonb
  ) <> 2 THEN
    RAISE EXCEPTION 'clinical_therapeutic_guidance_renderer_v1_legacy_versions_drift';
  END IF;

  IF (
    SELECT count(*)
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
      AND v.variables_contract @> '["patient.name","patient.birth_date","clinic.name","clinic.address","clinic.phone","issuer.name","issuer.professional_type","issuer.specialty","issuer.council_type","issuer.council_state","issuer.registro","appointment.id","issued_at"]'::jsonb
  ) <> 2 THEN
    RAISE EXCEPTION 'clinical_therapeutic_guidance_renderer_v1_versions_invalid';
  END IF;

  IF (
    SELECT count(*)
    FROM public.clinical_document_templates t
    JOIN public.clinical_document_template_versions v
      ON v.id = t.current_version_id
     AND v.template_id = t.id
    WHERE t.id IN (
      '12000000-0000-4000-8000-000000000003'::uuid,
      '12000000-0000-4000-8000-000000000004'::uuid
    )
      AND t.owner_type = 'platform'
      AND t.document_type = 'therapeutic_guidance'
      AND t.status = 'active'
      AND v.version >= 2
      AND v.published_at IS NOT NULL
      AND v.render_definition->>'layout' = 'clinical-document/therapeutic-guidance-v1'
  ) <> 2 THEN
    RAISE EXCEPTION 'clinical_therapeutic_guidance_renderer_v1_current_versions_missing';
  END IF;

  SELECT pg_get_functiondef('public.issue_clinical_document(uuid)'::regprocedure)
  INTO v_issue_def;

  IF v_issue_def NOT LIKE '%assert_clinical_document_actor%'
     OR v_issue_def NOT LIKE '%assert_clinical_document_payload_ready%'
     OR v_issue_def NOT LIKE '%template_definition_snapshot%'
     OR v_issue_def NOT LIKE '%render_definition%'
     OR v_issue_def NOT LIKE '%context_snapshot%'
     OR v_issue_def NOT LIKE '%rendered_snapshot%' THEN
    RAISE EXCEPTION 'clinical_therapeutic_guidance_renderer_v1_issue_snapshot_drift';
  END IF;

  IF has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'DELETE') THEN
    RAISE EXCEPTION 'clinical_therapeutic_guidance_renderer_v1_direct_version_mutation_exposed';
  END IF;
END $$;

SELECT 'CLINICAL THERAPEUTIC GUIDANCE RENDERER V1 VERIFY PASSED' AS result;
ROLLBACK;
