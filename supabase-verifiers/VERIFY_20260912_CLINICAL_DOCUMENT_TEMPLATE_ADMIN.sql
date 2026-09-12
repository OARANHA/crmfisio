-- MedicsPro — D2-B.2A production-safe verifier
-- Read-only: all checks run inside a transaction that is rolled back.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  v_missing text;
  v_def text;
BEGIN
  SELECT string_agg(signature, ', ' ORDER BY signature)
  INTO v_missing
  FROM (VALUES
    ('public.require_clinical_document_template_manager()'),
    ('public.validate_clinical_document_template_contract(text,jsonb,jsonb,jsonb)'),
    ('public.list_clinical_document_templates_for_management(text)'),
    ('public.create_clinic_clinical_document_template(text,text,jsonb,jsonb,jsonb,jsonb)'),
    ('public.clone_clinical_document_template_to_clinic(uuid,text,text)'),
    ('public.publish_clinic_clinical_document_template_version(uuid,jsonb,jsonb,jsonb)'),
    ('public.update_clinic_clinical_document_template_metadata(uuid,text,text,jsonb,text)')
  ) AS expected(signature)
  WHERE to_regprocedure(signature) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'clinical_document_template_admin_missing_functions: %', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    WHERE p.oid IN (
      'public.require_clinical_document_template_manager()'::regprocedure,
      'public.validate_clinical_document_template_contract(text,jsonb,jsonb,jsonb)'::regprocedure,
      'public.list_clinical_document_templates_for_management(text)'::regprocedure,
      'public.create_clinic_clinical_document_template(text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure,
      'public.clone_clinical_document_template_to_clinic(uuid,text,text)'::regprocedure,
      'public.publish_clinic_clinical_document_template_version(uuid,jsonb,jsonb,jsonb)'::regprocedure,
      'public.update_clinic_clinical_document_template_metadata(uuid,text,text,jsonb,text)'::regprocedure
    )
      AND p.prosecdef IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'clinical_document_template_admin_security_definer_required';
  END IF;

  -- Internal guards/validators are intentionally not browser RPCs.
  IF has_function_privilege('authenticated', 'public.require_clinical_document_template_manager()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.require_clinical_document_template_manager()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.validate_clinical_document_template_contract(text,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.validate_clinical_document_template_contract(text,jsonb,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'clinical_document_template_admin_internal_helper_exposed';
  END IF;

  -- Explicit management RPCs are authenticated-only client boundaries.
  IF NOT has_function_privilege('authenticated', 'public.list_clinical_document_templates_for_management(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.create_clinic_clinical_document_template(text,text,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.clone_clinical_document_template_to_clinic(uuid,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.publish_clinic_clinical_document_template_version(uuid,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.update_clinic_clinical_document_template_metadata(uuid,text,text,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'clinical_document_template_admin_authenticated_rpc_missing';
  END IF;

  IF has_function_privilege('anon', 'public.list_clinical_document_templates_for_management(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.create_clinic_clinical_document_template(text,text,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.clone_clinical_document_template_to_clinic(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.publish_clinic_clinical_document_template_version(uuid,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.update_clinic_clinical_document_template_metadata(uuid,text,text,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'clinical_document_template_admin_anon_rpc_exposed';
  END IF;

  -- D2-A table ACL stays read-only for authenticated clients; all mutations go
  -- through the typed RPC layer above.
  IF has_table_privilege('authenticated', 'public.clinical_document_templates', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_document_templates', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinical_document_templates', 'DELETE')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clinical_document_template_versions', 'DELETE') THEN
    RAISE EXCEPTION 'clinical_document_template_admin_direct_table_mutation_exposed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.clinical_document_template_versions'::regclass
      AND t.tgname = 'trg_clinical_document_template_version_immutable'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'clinical_document_template_version_immutability_trigger_missing';
  END IF;

  SELECT pg_get_functiondef('public.require_clinical_document_template_manager()'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%role IN (''owner'', ''admin'')%'
     OR v_def NOT LIKE '%p.ativo IS TRUE%'
     OR v_def NOT LIKE '%lifecycle_status = ''active''%'
     OR v_def NOT LIKE '%current_clinic_id()%'
     OR v_def LIKE '%clinical.documents%' THEN
    RAISE EXCEPTION 'clinical_document_template_manager_boundary_drift';
  END IF;

  SELECT pg_get_functiondef('public.validate_clinical_document_template_contract(text,jsonb,jsonb,jsonb)'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%medication_prescription%'
     OR v_def NOT LIKE '%clinical-document/plain-text-v1%'
     OR v_def NOT LIKE '%clinical_document_template_renderer_invalid%'
     OR v_def NOT LIKE '%clinical_document_template_fields_invalid%' THEN
    RAISE EXCEPTION 'clinical_document_template_contract_validator_drift';
  END IF;

  SELECT pg_get_functiondef('public.clone_clinical_document_template_to_clinic(uuid,text,text)'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%owner_type = ''platform''%'
     OR v_def NOT LIKE '%v_source.clinic_id = v_clinic_id%'
     OR v_def NOT LIKE '%owner_type, document_type%'
     OR v_def NOT LIKE '%''clinic''%' THEN
    RAISE EXCEPTION 'clinical_document_template_clone_tenant_boundary_drift';
  END IF;

  SELECT pg_get_functiondef('public.publish_clinic_clinical_document_template_version(uuid,jsonb,jsonb,jsonb)'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%max(version)%'
     OR v_def NOT LIKE '%current_version_id%'
     OR v_def NOT LIKE '%owner_type <> ''clinic''%'
     OR v_def NOT LIKE '%v_template.clinic_id IS DISTINCT FROM v_clinic_id%' THEN
    RAISE EXCEPTION 'clinical_document_template_publish_boundary_drift';
  END IF;
END $$;

SELECT 'CLINICAL DOCUMENT TEMPLATE ADMIN VERIFY PASSED' AS result;
ROLLBACK;
