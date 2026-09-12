-- MedicsPro — D2-B.2C production-safe verifier
-- Read-only checks only; transaction is rolled back intentionally.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  v_def text;
BEGIN
  IF to_regprocedure('public.save_clinic_prescription_template_presentation(uuid,text,text,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_save_rpc_missing';
  END IF;

  IF NOT (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.save_clinic_prescription_template_presentation(uuid,text,text,jsonb,jsonb)'::regprocedure
  ) THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_save_rpc_security_definer_required';
  END IF;

  IF NOT has_function_privilege(
      'authenticated',
      'public.save_clinic_prescription_template_presentation(uuid,text,text,jsonb,jsonb)',
      'EXECUTE'
    )
     OR has_function_privilege(
      'anon',
      'public.save_clinic_prescription_template_presentation(uuid,text,text,jsonb,jsonb)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_save_rpc_acl_invalid';
  END IF;

  IF has_table_privilege('authenticated', 'public.clinical_document_templates', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_document_templates', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'UPDATE') THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_direct_mutation_exposed';
  END IF;

  SELECT pg_get_functiondef(
    'public.validate_clinical_document_template_contract(text,jsonb,jsonb,jsonb)'::regprocedure
  ) INTO v_def;

  IF v_def NOT LIKE '%clinical-document/plain-text-v1%'
     OR v_def NOT LIKE '%clinical-document/prescription-v2%'
     OR v_def NOT LIKE '%coalesce(p_render_definition ->> ''preset''::text, ''''::text)%'
     OR v_def NOT LIKE '%coalesce(p_render_definition ->> ''accent''::text, ''''::text)%'
     OR v_def NOT LIKE '%coalesce(p_render_definition ->> ''medication_style''::text, ''''::text)%'
     OR v_def NOT LIKE '%issuer.specialty%'
     OR v_def NOT LIKE '%clinical_document_template_renderer_invalid%' THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_validator_drift';
  END IF;

  SELECT pg_get_functiondef(
    'public.save_clinic_prescription_template_presentation(uuid,text,text,jsonb,jsonb)'::regprocedure
  ) INTO v_def;

  IF v_def NOT LIKE '%require_clinical_document_template_manager()%'
     OR v_def NOT LIKE '%owner_type <> ''clinic''%'
     OR v_def NOT LIKE '%v_template.clinic_id IS DISTINCT FROM v_clinic_id%'
     OR v_def NOT LIKE '%validate_clinical_document_template_contract%'
     OR v_def NOT LIKE '%max(version)%'
     OR v_def NOT LIKE '%current_version_id%' THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_save_boundary_drift';
  END IF;

  SELECT pg_get_functiondef('public.issue_clinical_document(uuid)'::regprocedure)
  INTO v_def;

  IF v_def NOT LIKE '%assert_clinical_document_actor%'
     OR v_def NOT LIKE '%assert_clinical_document_payload_ready%'
     OR v_def NOT LIKE '%to_jsonb(pat)%nascimento%'
     OR v_def NOT LIKE '%to_jsonb(c)%address%'
     OR v_def NOT LIKE '%to_jsonb(c)%phone%'
     OR v_def NOT LIKE '%to_jsonb(p)%especialidade%'
     OR v_def NOT LIKE '%''template_name''%'
     OR v_def NOT LIKE '%template_definition_snapshot%'
     OR v_def NOT LIKE '%rendered_snapshot%'
     OR v_def NOT LIKE '%d2-a/plain-text-v1%' THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_issue_snapshot_drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.clinical_document_template_versions'::regclass
      AND t.tgname = 'trg_clinical_document_template_version_immutable'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_version_immutability_missing';
  END IF;

  IF (
    SELECT count(*)
    FROM public.clinical_document_templates t
    JOIN public.clinical_document_template_versions v
      ON v.id = t.current_version_id AND v.template_id = t.id
    WHERE t.id IN (
      '12000000-0000-4000-8000-000000000001'::uuid,
      '12000000-0000-4000-8000-000000000002'::uuid,
      '12000000-0000-4000-8000-000000000005'::uuid
    )
      AND t.owner_type = 'platform'
      AND t.document_type = 'medication_prescription'
      AND t.status = 'active'
      AND v.published_at IS NOT NULL
      AND v.render_definition->>'layout' = 'clinical-document/prescription-v2'
  ) <> 3 THEN
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_platform_presets_missing';
  END IF;
END $$;

SELECT public.validate_clinical_document_template_contract(
  'medication_prescription',
  '{"kind":"medication_prescription","fields":["items","observations"]}'::jsonb,
  '{"layout":"clinical-document/prescription-v2","preset":"institutional","accent":"navy","title":"Receita médica","medication_style":"cards","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb,
  '["patient.name","patient.birth_date","clinic.name","clinic.address","clinic.phone","issuer.name","issuer.specialty","issuer.registro","appointment.id","issued_at"]'::jsonb
);

DO $$
BEGIN
  BEGIN
    PERFORM public.validate_clinical_document_template_contract(
      'medication_prescription',
      '{"kind":"medication_prescription","fields":["items"]}'::jsonb,
      '{"layout":"clinical-document/prescription-v2","preset":"institutional","accent":"navy","title":"Receita","medication_style":"cards","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true,"html":"<script>alert(1)</script>"}'::jsonb,
      '["patient.name"]'::jsonb
    );
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_arbitrary_markup_not_rejected';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN NULL;
  END;

  BEGIN
    PERFORM public.validate_clinical_document_template_contract(
      'medication_prescription',
      '{"kind":"medication_prescription","fields":["items"]}'::jsonb,
      '{"layout":"clinical-document/prescription-v2","accent":"navy","title":"Receita","medication_style":"cards","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb,
      '["patient.name"]'::jsonb
    );
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_missing_preset_not_rejected';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN NULL;
  END;

  BEGIN
    PERFORM public.validate_clinical_document_template_contract(
      'medication_prescription',
      '{"kind":"medication_prescription","fields":["items"]}'::jsonb,
      '{"layout":"clinical-document/prescription-v2","preset":"classic","title":"Receita","medication_style":"numbered","show_clinic_address":true,"show_clinic_phone":true,"show_patient_birth_date":true,"show_specialty":true}'::jsonb,
      '["patient.name"]'::jsonb
    );
    RAISE EXCEPTION 'clinical_prescription_renderer_v2_missing_accent_not_rejected';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN NULL;
  END;
END $$;

SELECT 'CLINICAL PRESCRIPTION RENDERER V2 VERIFY PASSED' AS result;
ROLLBACK;