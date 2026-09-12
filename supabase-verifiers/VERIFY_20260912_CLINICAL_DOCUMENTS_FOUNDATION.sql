BEGIN;
SET TRANSACTION READ ONLY;

DO $$
DECLARE
  n text;
  actor_def text := lower(pg_get_functiondef('public.assert_clinical_document_actor(uuid,text)'::regprocedure));
  payload_def text := lower(pg_get_functiondef('public.assert_clinical_document_payload_ready(text,jsonb)'::regprocedure));
  issue_def text := lower(pg_get_functiondef('public.issue_clinical_document(uuid)'::regprocedure));
  cancel_def text := lower(pg_get_functiondef('public.cancel_clinical_document(uuid,text)'::regprocedure));
  cancel_actor_def text := lower(pg_get_functiondef('public.assert_clinical_document_cancel_actor(uuid)'::regprocedure));
  create_def text := lower(pg_get_functiondef('public.create_clinical_document_draft(uuid,uuid,jsonb)'::regprocedure));
  care_def text := lower(pg_get_functiondef('public.can_access_patient_clinical_record(uuid)'::regprocedure));
  care_compact text;
BEGIN
  care_compact := regexp_replace(care_def, '\s+', '', 'g');

  FOREACH n IN ARRAY ARRAY[
    'clinical_document_templates',
    'clinical_document_template_versions',
    'clinical_documents',
    'clinical_document_events'
  ] LOOP
    IF to_regclass('public.' || n) IS NULL THEN
      RAISE EXCEPTION 'clinical_documents_missing_table:%', n;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.' || n)) THEN
      RAISE EXCEPTION 'clinical_documents_rls_disabled:%', n;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM public.clinical_document_templates
      WHERE id::text LIKE '12000000-0000-4000-8000-00000000000%'
        AND owner_type='platform' AND status='active') <> 4 THEN
    RAISE EXCEPTION 'clinical_documents_seed_drift';
  END IF;
  IF (SELECT count(*) FROM public.clinical_document_template_versions
      WHERE id::text LIKE '12100000-0000-4000-8000-00000000000%'
        AND published_at IS NOT NULL) <> 4 THEN
    RAISE EXCEPTION 'clinical_documents_seed_versions_drift';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clinical_document_templates t
    WHERE t.id::text LIKE '12000000-0000-4000-8000-00000000000%'
      AND NOT EXISTS (
        SELECT 1 FROM public.clinical_document_template_versions v
        WHERE v.id=t.current_version_id AND v.template_id=t.id
          AND v.version=1 AND v.published_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'clinical_documents_current_version_drift';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.create_clinical_document_draft(uuid,uuid,jsonb)'::regprocedure)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.save_clinical_document_draft(uuid,jsonb)'::regprocedure)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.issue_clinical_document(uuid)'::regprocedure)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.cancel_clinical_document(uuid,text)'::regprocedure)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.assert_clinical_document_payload_ready(text,jsonb)'::regprocedure)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.assert_clinical_document_cancel_actor(uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'clinical_documents_rpc_missing';
  END IF;

  IF has_table_privilege('authenticated','public.clinical_documents','INSERT')
     OR has_table_privilege('authenticated','public.clinical_documents','UPDATE')
     OR has_table_privilege('authenticated','public.clinical_documents','DELETE')
     OR has_table_privilege('authenticated','public.clinical_document_templates','INSERT')
     OR has_table_privilege('authenticated','public.clinical_document_templates','UPDATE')
     OR has_table_privilege('authenticated','public.clinical_document_template_versions','INSERT')
     OR has_table_privilege('authenticated','public.clinical_document_template_versions','UPDATE') THEN
    RAISE EXCEPTION 'clinical_documents_direct_mutation_granted';
  END IF;

  IF NOT has_function_privilege('authenticated','public.create_clinical_document_draft(uuid,uuid,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.save_clinical_document_draft(uuid,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.issue_clinical_document(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.cancel_clinical_document(uuid,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.current_user_can_issue_clinical_document(text)','EXECUTE') THEN
    RAISE EXCEPTION 'clinical_documents_public_rpc_acl_missing';
  END IF;

  IF has_function_privilege('authenticated','public.assert_clinical_document_actor(uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.assert_clinical_document_payload_ready(text,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.assert_clinical_document_cancel_actor(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.render_clinical_document_snapshot(text,text,jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'clinical_documents_internal_helper_exposed';
  END IF;

  IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
      WHERE c.relname='clinical_document_templates'
        AND p.polname='clinical_document_templates_read_available' AND p.polcmd='r') <> 1
     OR (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
         WHERE c.relname='clinical_document_template_versions'
           AND p.polname='clinical_document_template_versions_read_available' AND p.polcmd='r') <> 1
     OR (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
         WHERE c.relname='clinical_documents'
           AND p.polname='clinical_documents_read_clinical' AND p.polcmd='r') <> 1
     OR (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
         WHERE c.relname='clinical_document_events'
           AND p.polname='clinical_document_events_read_clinical' AND p.polcmd='r') <> 1 THEN
    RAISE EXCEPTION 'clinical_documents_read_policy_drift';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid='public.clinical_document_template_versions'::regclass
        AND tgname='trg_clinical_document_template_version_immutable' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid='public.clinical_documents'::regclass
        AND tgname='trg_clinical_document_integrity' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid='public.clinical_document_events'::regclass
        AND tgname='trg_clinical_document_event_append_only' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'clinical_documents_immutability_trigger_missing';
  END IF;

  IF position('clinical.documents' in lower(pg_get_functiondef('public.current_user_can_issue_clinical_document(text)'::regprocedure)))=0
     OR position('clinical.assessment.apply' in lower(pg_get_functiondef('public.current_user_can_issue_clinical_document(text)'::regprocedure)))>0
     OR position('fisio' in lower(pg_get_functiondef('public.current_user_can_issue_clinical_document(text)'::regprocedure)))>0 THEN
    RAISE EXCEPTION 'clinical_documents_eligibility_boundary_drift';
  END IF;

  IF position('a.fisio_id is distinct from auth.uid()' in actor_def)=0
     OR position('a.professional_id is distinct from auth.uid()' in actor_def)>0 THEN
    RAISE EXCEPTION 'clinical_documents_encounter_owner_boundary_drift';
  END IF;

  IF position('medication_name' in payload_def)=0
     OR position('guidance' in payload_def)=0
     OR position('jsonb_array_length' in payload_def)=0
     OR position('assert_clinical_document_payload_ready' in issue_def)=0 THEN
    RAISE EXCEPTION 'clinical_documents_typed_issue_contract_drift';
  END IF;

  IF position('assert_clinical_document_cancel_actor' in cancel_def)=0
     OR position('assert_clinical_document_actor' in cancel_def)>0
     OR position('issuer_id is distinct from auth.uid()' in cancel_actor_def)=0
     OR position('current_user_can_issue_clinical_document' in cancel_actor_def)=0
     OR position('em_atendimento' in cancel_actor_def)>0 THEN
    RAISE EXCEPTION 'clinical_documents_cancel_boundary_drift';
  END IF;

  IF position('replace(did::text' in create_def)=0 OR position('substr(' in create_def)>0 THEN
    RAISE EXCEPTION 'clinical_documents_identifier_entropy_drift';
  END IF;

  -- #426 is applied and verified immediately before D2-A. Match the
  -- appointments branch specifically so other canonical professional_id care
  -- relationships (assessments/evolutions/Nexus) cannot produce false reds.
  IF position('clinical.timeline.read' in care_def)=0
     OR position('v_rolein(''owner'',''admin'')' in care_compact)=0
     OR position('frompublic.appointmentsawherea.clinic_id=v_clinicanda.paciente_id=p_patient_idanda.fisio_id=v_uid' in care_compact)=0
     OR position('frompublic.appointmentsawherea.clinic_id=v_clinicanda.paciente_id=p_patient_idanda.professional_id=v_uid' in care_compact)>0 THEN
    RAISE EXCEPTION 'clinical_documents_canonical_care_helper_missing';
  END IF;
END;
$$;

SELECT 'CLINICAL DOCUMENTS FOUNDATION VERIFY PASSED' AS result;
ROLLBACK;
