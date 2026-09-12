BEGIN; SET TRANSACTION READ ONLY;
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['clinical_document_templates','clinical_document_template_versions','clinical_documents','clinical_document_events'] LOOP
    IF to_regclass('public.' || n) IS NULL THEN RAISE EXCEPTION 'clinical_documents_missing_table:%',n; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.' || n)) THEN RAISE EXCEPTION 'clinical_documents_rls_disabled:%',n; END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.clinical_document_templates WHERE id::text LIKE '12000000-0000-4000-8000-00000000000%' AND owner_type='platform' AND status='active') <> 4 THEN RAISE EXCEPTION 'clinical_documents_seed_drift'; END IF;
  IF (SELECT count(*) FROM public.clinical_document_template_versions WHERE id::text LIKE '12100000-0000-4000-8000-00000000000%' AND published_at IS NOT NULL) <> 4 THEN RAISE EXCEPTION 'clinical_documents_seed_versions_drift'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.clinical_document_templates t
    WHERE t.id::text LIKE '12000000-0000-4000-8000-00000000000%'
      AND NOT EXISTS (SELECT 1 FROM public.clinical_document_template_versions v WHERE v.id=t.current_version_id AND v.template_id=t.id AND v.version=1 AND v.published_at IS NOT NULL)
  ) THEN RAISE EXCEPTION 'clinical_documents_current_version_drift'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.create_clinical_document_draft(uuid,uuid,jsonb)'::regprocedure) OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.save_clinical_document_draft(uuid,jsonb)'::regprocedure) OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.issue_clinical_document(uuid)'::regprocedure) OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.cancel_clinical_document(uuid,text)'::regprocedure) THEN RAISE EXCEPTION 'clinical_documents_rpc_missing'; END IF;
  IF has_table_privilege('authenticated','public.clinical_documents','INSERT') OR has_table_privilege('authenticated','public.clinical_documents','UPDATE') OR has_table_privilege('authenticated','public.clinical_documents','DELETE')
     OR has_table_privilege('authenticated','public.clinical_document_templates','INSERT') OR has_table_privilege('authenticated','public.clinical_document_template_versions','UPDATE') THEN RAISE EXCEPTION 'clinical_documents_direct_mutation_granted'; END IF;
  IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname='clinical_document_templates' AND p.polname='clinical_document_templates_read_available' AND p.polcmd='r') <> 1
     OR (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname='clinical_document_template_versions' AND p.polname='clinical_document_template_versions_read_available' AND p.polcmd='r') <> 1 THEN RAISE EXCEPTION 'clinical_documents_read_policy_drift'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.clinical_document_template_versions'::regclass AND tgname='trg_clinical_document_template_version_immutable' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.clinical_documents'::regclass AND tgname='trg_clinical_document_integrity' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.clinical_document_events'::regclass AND tgname='trg_clinical_document_event_append_only' AND NOT tgisinternal) THEN RAISE EXCEPTION 'clinical_documents_immutability_trigger_missing'; END IF;
  IF position('clinical.documents' in lower(pg_get_functiondef('public.current_user_can_issue_clinical_document(text)'::regprocedure))) = 0
     OR position('clinical.assessment.apply' in lower(pg_get_functiondef('public.current_user_can_issue_clinical_document(text)'::regprocedure))) > 0 THEN RAISE EXCEPTION 'clinical_documents_eligibility_boundary_drift'; END IF;
  IF position('fisio' in lower(pg_get_functiondef('public.current_user_can_issue_clinical_document(text)'::regprocedure))) > 0 THEN RAISE EXCEPTION 'clinical_documents_legacy_role_bypass'; END IF;
END $$;
SELECT 'CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED' AS result;
ROLLBACK;
