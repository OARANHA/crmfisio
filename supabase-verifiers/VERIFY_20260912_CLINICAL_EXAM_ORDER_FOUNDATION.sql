\set ON_ERROR_STOP on

BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';
SET LOCAL application_name = 'medicspro-verify-clinical-exam-order-foundation';

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

  IF v_templates_check IS NULL OR position('exam_order' in v_templates_check) = 0 THEN
    RAISE EXCEPTION 'exam_order missing from clinical_document_templates type constraint';
  END IF;
  IF v_documents_check IS NULL OR position('exam_order' in v_documents_check) = 0 THEN
    RAISE EXCEPTION 'exam_order missing from clinical_documents type constraint';
  END IF;

  SELECT pg_get_functiondef('public.current_user_can_issue_clinical_document(text)'::regprocedure)
    INTO v_eligibility;
  IF position('exam_order' in v_eligibility) = 0
     OR position('clinical.documents' in v_eligibility) = 0
     OR position('current_user_has_valid_clinical_identity' in v_eligibility) = 0
     OR position('council_type' in v_eligibility) = 0
     OR position('crm' in lower(v_eligibility)) = 0 THEN
    RAISE EXCEPTION 'exam_order eligibility boundary fingerprint missing';
  END IF;

  SELECT pg_get_functiondef('public.assert_clinical_document_payload_ready(text,jsonb)'::regprocedure)
    INTO v_payload;
  IF position('clinical_document_exam_items_required' in v_payload) = 0
     OR position('clinical_document_exam_item_invalid' in v_payload) = 0
     OR position('clinical_document_exam_priority_invalid' in v_payload) = 0
     OR position('exam_name' in v_payload) = 0 THEN
    RAISE EXCEPTION 'exam_order payload boundary fingerprint missing';
  END IF;

  SELECT pg_get_functiondef('public.render_clinical_document_snapshot(text,text,jsonb,jsonb)'::regprocedure)
    INTO v_renderer;
  IF position('exam_order' in v_renderer) = 0 THEN
    RAISE EXCEPTION 'exam_order renderer contract missing';
  END IF;

  SELECT count(*) INTO v_template_count
  FROM public.clinical_document_templates
  WHERE id = '12000000-0000-4000-8000-000000000006'::uuid
    AND owner_type = 'platform'
    AND clinic_id IS NULL
    AND document_type = 'exam_order'
    AND name = 'Pedido de exames'
    AND status = 'active';

  SELECT current_version_id INTO v_current
  FROM public.clinical_document_templates
  WHERE id = '12000000-0000-4000-8000-000000000006'::uuid;

  IF v_template_count <> 1
     OR v_current IS DISTINCT FROM '12100000-0000-4000-8000-000000000006'::uuid THEN
    RAISE EXCEPTION 'exam_order platform template drift';
  END IF;

  SELECT count(*) INTO v_version_count
  FROM public.clinical_document_template_versions
  WHERE id = '12100000-0000-4000-8000-000000000006'::uuid
    AND template_id = '12000000-0000-4000-8000-000000000006'::uuid
    AND version = 1
    AND published_at IS NOT NULL
    AND definition->>'kind' = 'exam_order'
    AND definition->'fields' ? 'items'
    AND render_definition->>'layout' = 'clinical-document/plain-text-v1';

  IF v_version_count <> 1 THEN
    RAISE EXCEPTION 'exam_order platform template version drift';
  END IF;

  IF has_function_privilege('anon', 'public.current_user_can_issue_clinical_document(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly executes clinical document eligibility';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.current_user_can_issue_clinical_document(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated missing clinical document eligibility execute';
  END IF;
  IF has_function_privilege('authenticated', 'public.assert_clinical_document_payload_ready(text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly executes internal payload assertion';
  END IF;
  IF has_function_privilege('authenticated', 'public.render_clinical_document_snapshot(text,text,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly executes internal renderer';
  END IF;

  IF has_table_privilege('authenticated', 'public.clinical_documents', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_documents', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinical_documents', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated regained direct clinical_documents writes';
  END IF;
END $$;

SELECT 'CLINICAL EXAM ORDER FOUNDATION VERIFY PASSED' AS result;
ROLLBACK;
