-- D2-A behavior matrix. Browser-facing paths run as authenticated with RLS;
-- trigger-only negative controls run as postgres.
UPDATE public.appointments SET status='em_atendimento'
WHERE id IN (
  'd2300000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000002',
  'd2300000-0000-4000-8000-000000000004','d2300000-0000-4000-8000-000000000005',
  'd2300000-0000-4000-8000-000000000006','d2300000-0000-4000-8000-000000000007'
);
UPDATE public.appointments SET status='finalizado'
WHERE id='d2300000-0000-4000-8000-000000000003';

DROP TABLE IF EXISTS d2_results;
CREATE TEMP TABLE d2_results(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON d2_results TO authenticated;
CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_name text,p_sql text,p_expected text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE ok boolean:=false;
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN ok:=p_expected IS NULL OR position(lower(p_expected) in lower(SQLERRM))>0;
  END;
  INSERT INTO d2_results VALUES(p_name,ok);
END $$;

-- Physician issuer. Appointment 1 deliberately has professional_id != issuer;
-- canonical ownership is fisio_id.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
INSERT INTO d2_results VALUES
 ('physician_templates_visible',(SELECT count(*)=4 FROM public.clinical_document_templates)),
 ('physician_versions_visible',(SELECT count(*)=4 FROM public.clinical_document_template_versions)),
 ('canonical_care_read_allow',public.can_access_patient_clinical_record('d2200000-0000-4000-8000-000000000001'));
SELECT (public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}')).id AS d2_doc \gset
INSERT INTO d2_results VALUES
 ('incomplete_medication_draft_allowed',(SELECT status='draft' AND payload='{}'::jsonb FROM public.clinical_documents WHERE id=:'d2_doc')),
 ('identifier_full_uuid_entropy',(SELECT document_identifier ~ '^DOC-[0-9]{8}-[0-9A-F]{32}$' FROM public.clinical_documents WHERE id=:'d2_doc'));
SELECT pg_temp.expect_error('medication_empty_items_issue_denied',format('SELECT public.issue_clinical_document(%L::uuid)',:'d2_doc'),'clinical_document_medication_items_required');
SELECT public.save_clinical_document_draft(:'d2_doc','{"items":[{}]}'::jsonb);
SELECT pg_temp.expect_error('medication_blank_name_issue_denied',format('SELECT public.issue_clinical_document(%L::uuid)',:'d2_doc'),'clinical_document_medication_item_invalid');
SELECT public.save_clinical_document_draft(:'d2_doc','{"items":[{"medication_name":"Item confirmado"}],"observations":"snapshot confirmado"}'::jsonb);
SELECT public.issue_clinical_document(:'d2_doc');
INSERT INTO d2_results VALUES
 ('physician_medication_issue',(SELECT status='issued' AND payload_snapshot IS NOT NULL AND context_snapshot IS NOT NULL AND template_definition_snapshot IS NOT NULL AND rendered_snapshot<>'' FROM public.clinical_documents WHERE id=:'d2_doc')),
 ('issued_history_visible_to_issuer',(SELECT count(*)=1 FROM public.clinical_documents WHERE id=:'d2_doc')),
 ('issued_event_visible_to_issuer',(SELECT count(*)=2 FROM public.clinical_document_events WHERE document_id=:'d2_doc'));
SELECT (public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000002','{}')).id AS d2_second_doc \gset
INSERT INTO d2_results VALUES ('identifier_unique_between_drafts',(SELECT a.document_identifier<>b.document_identifier FROM public.clinical_documents a,public.clinical_documents b WHERE a.id=:'d2_doc' AND b.id=:'d2_second_doc'));
SELECT pg_temp.expect_error('professional_id_only_encounter_denied',$$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000007','12100000-0000-4000-8000-000000000001','{}')$$,'clinical_document_own_active_encounter_required');
SELECT pg_temp.expect_error('finalized_encounter_create_denied',$$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000003','12100000-0000-4000-8000-000000000001','{}')$$,'clinical_document_own_active_encounter_required');
SELECT pg_temp.expect_error('other_professional_encounter_denied',$$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000002','12100000-0000-4000-8000-000000000003','{}')$$,'clinical_document_own_active_encounter_required');
SELECT pg_temp.expect_error('issued_direct_update_denied',format('UPDATE public.clinical_documents SET payload=%L::jsonb WHERE id=%L::uuid','{}',:'d2_doc'),NULL);
SELECT pg_temp.expect_error('issued_direct_delete_denied',format('DELETE FROM public.clinical_documents WHERE id=%L::uuid',:'d2_doc'),NULL);
SELECT pg_temp.expect_error('professional_template_insert_denied',$$INSERT INTO public.clinical_document_templates(owner_type,clinic_id,document_type,name) VALUES('clinic','d2000000-0000-4000-8000-000000000001','therapeutic_guidance','indevido')$$,NULL);
SELECT pg_temp.expect_error('professional_template_update_denied',$$UPDATE public.clinical_document_templates SET name='indevido' WHERE id='12000000-0000-4000-8000-000000000003'$$,NULL);
SELECT pg_temp.expect_error('professional_version_insert_denied',$$INSERT INTO public.clinical_document_template_versions(template_id,version) VALUES('12000000-0000-4000-8000-000000000003',2)$$,NULL);
COMMIT;

SELECT pg_temp.expect_error('published_version_immutable',$$UPDATE public.clinical_document_template_versions SET definition='{}'::jsonb WHERE id='12100000-0000-4000-8000-000000000001'$$,'clinical_document_published_version_immutable');
SELECT pg_temp.expect_error('issued_snapshot_immutable',format('UPDATE public.clinical_documents SET payload_snapshot=%L::jsonb WHERE id=%L::uuid','{}',:'d2_doc'),'clinical_document_issued_immutable');
SELECT pg_temp.expect_error('event_append_only',format('UPDATE public.clinical_document_events SET metadata=%L::jsonb WHERE document_id=%L::uuid','{}',:'d2_doc'),'clinical_document_event_append_only');

-- Guidance contract and non-physician eligibility.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000003',true);
INSERT INTO d2_results VALUES ('physio_guidance_templates_only',(SELECT count(*)=2 AND bool_and(document_type='therapeutic_guidance') FROM public.clinical_document_templates));
SELECT pg_temp.expect_error('physio_medication_denied',$$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000002','12100000-0000-4000-8000-000000000001','{}')$$,'clinical_document_eligibility_required');
SELECT (public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000002','12100000-0000-4000-8000-000000000003','{}')).id AS d2_guidance \gset
INSERT INTO d2_results VALUES ('incomplete_guidance_draft_allowed',(SELECT status='draft' FROM public.clinical_documents WHERE id=:'d2_guidance'));
SELECT pg_temp.expect_error('guidance_empty_issue_denied',format('SELECT public.issue_clinical_document(%L::uuid)',:'d2_guidance'),'clinical_document_guidance_items_required');
SELECT public.save_clinical_document_draft(:'d2_guidance','{"items":[{"guidance":""}]}'::jsonb);
SELECT pg_temp.expect_error('guidance_blank_item_issue_denied',format('SELECT public.issue_clinical_document(%L::uuid)',:'d2_guidance'),'clinical_document_guidance_item_invalid');
SELECT public.save_clinical_document_draft(:'d2_guidance','{"items":[{"guidance":"Orientação confirmada"}]}'::jsonb);
SELECT public.issue_clinical_document(:'d2_guidance');
INSERT INTO d2_results VALUES ('physio_guidance_issue_allowed',(SELECT status='issued' FROM public.clinical_documents WHERE id=:'d2_guidance'));
COMMIT;

BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000004',true);
SELECT (public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000005','12100000-0000-4000-8000-000000000004','{"items":[{"guidance":"Orientação psicológica confirmada"}]}')).id AS d2_psy \gset
SELECT public.issue_clinical_document(:'d2_psy');
INSERT INTO d2_results VALUES ('psychologist_guidance_issue_allowed',(SELECT status='issued' FROM public.clinical_documents WHERE id=:'d2_psy'));
COMMIT;

-- Explicit clinical.documents deny overrides professional fallback.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000002',true);
INSERT INTO d2_results VALUES ('documents_capability_false_templates_hidden',(SELECT count(*)=0 FROM public.clinical_document_templates));
SELECT pg_temp.expect_error('documents_capability_false_denied',$$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}')$$,'clinical_document_eligibility_required');
COMMIT;

-- History visibility delegates to the canonical post-#426 helper.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000009',true);
INSERT INTO d2_results VALUES
 ('timeline_denied_care_helper_denied',NOT public.can_access_patient_clinical_record('d2200000-0000-4000-8000-000000000001')),
 ('timeline_denied_document_hidden',(SELECT count(*)=0 FROM public.clinical_documents WHERE id=:'d2_doc'));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000010',true);
INSERT INTO d2_results VALUES
 ('professional_id_only_care_helper_denied',NOT public.can_access_patient_clinical_record('d2200000-0000-4000-8000-000000000001')),
 ('professional_id_only_document_hidden',(SELECT count(*)=0 FROM public.clinical_documents WHERE id=:'d2_doc'));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000008',true);
INSERT INTO d2_results VALUES
 ('cross_tenant_care_denied',NOT public.can_access_patient_clinical_record('d2200000-0000-4000-8000-000000000001')),
 ('cross_tenant_document_hidden',(SELECT count(*)=0 FROM public.clinical_documents WHERE id=:'d2_doc'));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000011',true);
INSERT INTO d2_results VALUES
 ('recep_history_denied',(SELECT count(*)=0 FROM public.clinical_documents WHERE id=:'d2_doc')),
 ('recep_event_history_denied',(SELECT count(*)=0 FROM public.clinical_document_events WHERE document_id=:'d2_doc'));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000012',true);
INSERT INTO d2_results VALUES
 ('financeiro_history_denied',(SELECT count(*)=0 FROM public.clinical_documents WHERE id=:'d2_doc')),
 ('financeiro_event_history_denied',(SELECT count(*)=0 FROM public.clinical_document_events WHERE document_id=:'d2_doc'));
COMMIT;

-- #426 preserves manager history reads, but managers get no D2 authorship bypass.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000005',true);
INSERT INTO d2_results VALUES
 ('owner_history_read_preserved',(SELECT count(*)=1 FROM public.clinical_documents WHERE id=:'d2_doc')),
 ('owner_templates_hidden',(SELECT count(*)=0 FROM public.clinical_document_templates));
SELECT pg_temp.expect_error('owner_authorship_denied',$$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}')$$,'clinical_document_eligibility_required');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000006',true);
INSERT INTO d2_results VALUES
 ('admin_history_read_preserved',(SELECT count(*)=1 FROM public.clinical_documents WHERE id=:'d2_doc')),
 ('admin_templates_hidden',(SELECT count(*)=0 FROM public.clinical_document_templates));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000007',true);
SELECT pg_temp.expect_error('inactive_professional_denied',$$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}')$$,'clinical_document_eligibility_required');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000099',true);
SELECT pg_temp.expect_error('platform_or_unscoped_actor_denied',$$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}')$$,'clinical_document_eligibility_required');
COMMIT;

-- Cancellation is historical: finalizing the Encounter must not erase the
-- original issuer's ability to cancel the immutable issued snapshot.
CREATE TEMP TABLE d2_cancel_before AS
SELECT id,payload,payload_snapshot,context_snapshot,template_definition_snapshot,
       rendered_snapshot,renderer_version,issued_at,issued_by
FROM public.clinical_documents WHERE id=:'d2_doc';
UPDATE public.appointments SET status='finalizado' WHERE id='d2300000-0000-4000-8000-000000000001';
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000010',true);
SELECT pg_temp.expect_error('non_issuer_cancel_denied',format('SELECT public.cancel_clinical_document(%L::uuid,%L)',:'d2_doc','indevido'),'clinical_document_cancel_actor_required');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
SELECT pg_temp.expect_error('cancel_requires_reason',format('SELECT public.cancel_clinical_document(%L::uuid,%L)',:'d2_doc',''),'clinical_document_cancel_reason_required');
SELECT public.cancel_clinical_document(:'d2_doc','Cancelamento histórico de teste');
INSERT INTO d2_results VALUES
 ('cancel_after_encounter_finalization_allowed',(SELECT status='canceled' AND canceled_by='d2100000-0000-4000-8000-000000000001'::uuid AND cancel_reason='Cancelamento histórico de teste' FROM public.clinical_documents WHERE id=:'d2_doc')),
 ('canceled_history_still_readable',(SELECT count(*)=1 FROM public.clinical_documents WHERE id=:'d2_doc'));
COMMIT;
INSERT INTO d2_results VALUES ('cancel_preserves_issued_snapshot',(
 SELECT d.payload IS NOT DISTINCT FROM b.payload
    AND d.payload_snapshot IS NOT DISTINCT FROM b.payload_snapshot
    AND d.context_snapshot IS NOT DISTINCT FROM b.context_snapshot
    AND d.template_definition_snapshot IS NOT DISTINCT FROM b.template_definition_snapshot
    AND d.rendered_snapshot IS NOT DISTINCT FROM b.rendered_snapshot
    AND d.renderer_version IS NOT DISTINCT FROM b.renderer_version
    AND d.issued_at IS NOT DISTINCT FROM b.issued_at
    AND d.issued_by IS NOT DISTINCT FROM b.issued_by
 FROM public.clinical_documents d JOIN d2_cancel_before b USING(id) WHERE d.id=:'d2_doc'
));

DO $$
DECLARE failures jsonb; total integer;
BEGIN
 SELECT jsonb_agg(to_jsonb(d2_results) ORDER BY name) INTO failures FROM d2_results WHERE NOT passed;
 IF failures IS NOT NULL THEN RAISE EXCEPTION 'clinical_documents_behavior_failed: %',failures; END IF;
 SELECT count(*) INTO total FROM d2_results;
 IF total < 50 THEN RAISE EXCEPTION 'clinical_documents_behavior_matrix_incomplete: %',total; END IF;
END $$;
SELECT count(*) AS passing_behavior_checks FROM d2_results WHERE passed;
SELECT 'CLINICAL DOCUMENTS FOUNDATION BEHAVIOR PASSED' AS result;
