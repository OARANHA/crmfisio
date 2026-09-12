\set ON_ERROR_STOP on

BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';
SET LOCAL application_name = 'medicspro-verify-clinical-referral-foundation';

DO $$
DECLARE
  v_templates_check text;
  v_documents_check text;
  v_eligibility text;
  v_payload text;
  v_renderer text;
  v_template_count integer;
  v_version_count integer;
  v_current uuid;
  v_proc record;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_templates_check
  FROM pg_constraint c
  WHERE c.conrelid = 'public.clinical_document_templates'::regclass
    AND c.conname = 'clinical_document_templates_document_type_check'
    AND c.contype = 'c';

  SELECT pg_get_constraintdef(c.oid) INTO v_documents_check
  FROM pg_constraint c
  WHERE c.conrelid = 'public.clinical_documents'::regclass
    AND c.conname = 'clinical_documents_document_type_check'
    AND c.contype = 'c';

  IF v_templates_check IS NULL
     OR position('medication_prescription' in v_templates_check) = 0
     OR position('therapeutic_guidance' in v_templates_check) = 0
     OR position('exam_order' in v_templates_check) = 0
     OR position('referral' in v_templates_check) = 0 THEN
    RAISE EXCEPTION 'referral or prior document type missing from clinical_document_templates constraint';
  END IF;

  IF v_documents_check IS NULL
     OR position('medication_prescription' in v_documents_check) = 0
     OR position('therapeutic_guidance' in v_documents_check) = 0
     OR position('exam_order' in v_documents_check) = 0
     OR position('referral' in v_documents_check) = 0 THEN
    RAISE EXCEPTION 'referral or prior document type missing from clinical_documents constraint';
  END IF;

  SELECT pg_get_functiondef('public.current_user_can_issue_clinical_document(text)'::regprocedure)
    INTO v_eligibility;
  IF position('referral' in v_eligibility) = 0
     OR position('therapeutic_guidance' in v_eligibility) = 0
     OR position('medication_prescription' in v_eligibility) = 0
     OR position('exam_order' in v_eligibility) = 0
     OR position('clinical.documents' in v_eligibility) = 0
     OR position('current_user_has_valid_clinical_identity' in v_eligibility) = 0
     OR position('council_type' in v_eligibility) = 0
     OR position('crm' in lower(v_eligibility)) = 0
     OR position('clinical.assessment.apply' in v_eligibility) > 0
     OR position('fisio' in lower(v_eligibility)) > 0
     OR position('owner' in lower(v_eligibility)) > 0
     OR position('admin' in lower(v_eligibility)) > 0 THEN
    RAISE EXCEPTION 'referral eligibility boundary fingerprint missing or broadened';
  END IF;

  SELECT pg_get_functiondef('public.assert_clinical_document_payload_ready(text,jsonb)'::regprocedure)
    INTO v_payload;
  IF position('clinical_document_medication_items_required' in v_payload) = 0
     OR position('clinical_document_guidance_items_required' in v_payload) = 0
     OR position('clinical_document_exam_items_required' in v_payload) = 0
     OR position('clinical_document_referral_recipient_required' in v_payload) = 0
     OR position('clinical_document_referral_recipient_invalid' in v_payload) = 0
     OR position('clinical_document_referral_reason_required' in v_payload) = 0
     OR position('clinical_document_referral_priority_invalid' in v_payload) = 0
     OR position('clinical_document_referral_payload_invalid' in v_payload) = 0
     OR position('professional_name' in v_payload) = 0
     OR position('professional_type' in v_payload) = 0
     OR position('specialty' in v_payload) = 0
     OR position('service' in v_payload) = 0
     OR position('facility' in v_payload) = 0 THEN
    RAISE EXCEPTION 'referral payload contract fingerprint missing';
  END IF;

  SELECT pg_get_functiondef('public.render_clinical_document_snapshot(text,text,jsonb,jsonb)'::regprocedure)
    INTO v_renderer;
  IF position('referral' in v_renderer) = 0
     OR position('Encaminhamento clínico' in v_renderer) = 0
     OR position('exam_order' in v_renderer) = 0
     OR position('clinical_document_render_contract_invalid' in v_renderer) = 0 THEN
    RAISE EXCEPTION 'referral renderer contract missing or regressed';
  END IF;

  FOR v_proc IN
    SELECT p.oid::regprocedure AS signature, p.prosecdef, p.proconfig
    FROM pg_proc p
    WHERE p.oid IN (
      'public.current_user_can_issue_clinical_document(text)'::regprocedure,
      'public.assert_clinical_document_payload_ready(text,jsonb)'::regprocedure,
      'public.render_clinical_document_snapshot(text,text,jsonb,jsonb)'::regprocedure
    )
  LOOP
    IF v_proc.prosecdef IS NOT TRUE
       OR v_proc.proconfig IS NULL
       OR NOT (v_proc.proconfig @> ARRAY['search_path=public, pg_temp']) THEN
      RAISE EXCEPTION 'referral function security contract invalid for %', v_proc.signature;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_template_count
  FROM public.clinical_document_templates
  WHERE id = '12000000-0000-4000-8000-000000000007'::uuid
    AND owner_type = 'platform'
    AND clinic_id IS NULL
    AND document_type = 'referral'
    AND name = 'Encaminhamento clínico'
    AND status = 'active';

  SELECT current_version_id INTO v_current
  FROM public.clinical_document_templates
  WHERE id = '12000000-0000-4000-8000-000000000007'::uuid;

  IF v_template_count <> 1
     OR v_current IS DISTINCT FROM '12100000-0000-4000-8000-000000000007'::uuid THEN
    RAISE EXCEPTION 'referral platform template drift';
  END IF;

  SELECT count(*) INTO v_version_count
  FROM public.clinical_document_template_versions
  WHERE id = '12100000-0000-4000-8000-000000000007'::uuid
    AND template_id = '12000000-0000-4000-8000-000000000007'::uuid
    AND version = 1
    AND published_at IS NOT NULL
    AND definition = '{"kind":"referral","fields":["recipient","reason","clinical_summary","requested_action","priority","observations"]}'::jsonb
    AND render_definition = '{"layout":"clinical-document/plain-text-v1"}'::jsonb
    AND variables_contract = '["patient.name","issuer.name","issuer.professional_type","issuer.registro","appointment.id"]'::jsonb;

  IF v_version_count <> 1 THEN
    RAISE EXCEPTION 'referral platform template version drift';
  END IF;

  IF has_function_privilege('anon', 'public.current_user_can_issue_clinical_document(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly executes clinical document eligibility';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.current_user_can_issue_clinical_document(text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.current_user_can_issue_clinical_document(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'clinical document eligibility execute grants missing';
  END IF;
  IF has_function_privilege('authenticated', 'public.assert_clinical_document_payload_ready(text,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.render_clinical_document_snapshot(text,text,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly executes internal clinical document functions';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.assert_clinical_document_payload_ready(text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.render_clinical_document_snapshot(text,text,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role internal clinical document grants missing';
  END IF;

  IF has_table_privilege('authenticated', 'public.clinical_documents', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_documents', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinical_documents', 'DELETE')
     OR has_table_privilege('authenticated', 'public.clinical_document_templates', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_document_templates', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinical_document_templates', 'DELETE')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated regained direct Clinical Documents writes';
  END IF;
END $$;

SELECT 'CLINICAL REFERRAL FOUNDATION VERIFY PASSED' AS result;
ROLLBACK;
