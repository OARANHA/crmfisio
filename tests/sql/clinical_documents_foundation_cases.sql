-- Every protected operation runs as authenticated with RLS enabled.
DROP TABLE IF EXISTS d2_results;
CREATE TEMP TABLE d2_results(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON d2_results TO authenticated;
CREATE OR REPLACE FUNCTION pg_temp.expect_denied(p_name text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql; INSERT INTO d2_results VALUES (p_name, false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO d2_results VALUES (p_name, true);
  END;
END $$;

-- Active physician with clinical.documents, own active encounter: issue,
-- immutable snapshot and explicit cancellation.
BEGIN;
SET LOCAL ROLE authenticated; SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
INSERT INTO d2_results VALUES ('physician_templates_visible', (SELECT count(*)=4 FROM public.clinical_document_templates));
INSERT INTO d2_results VALUES ('physician_template_versions_visible', (SELECT count(*)=4 FROM public.clinical_document_template_versions));
SELECT (public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{"items":[{"medication_name":"Item confirmado"}]}'::jsonb)).id AS d2_doc \gset
SELECT public.save_clinical_document_draft(:'d2_doc','{"items":[{"medication_name":"Item confirmado"}],"observations":"snapshot confirmado"}'::jsonb);
INSERT INTO d2_results VALUES ('physician_draft_save', (SELECT payload->>'observations'='snapshot confirmado' FROM public.clinical_documents WHERE id=:'d2_doc'));
SELECT (public.issue_clinical_document(:'d2_doc')).id AS d2_issued \gset
INSERT INTO d2_results VALUES ('physician_medication_draft_issue', (SELECT status='issued' AND payload_snapshot IS NOT NULL AND context_snapshot IS NOT NULL AND rendered_snapshot <> '' FROM public.clinical_documents WHERE id=:'d2_doc'));
INSERT INTO d2_results VALUES ('issued_document_readable_history', (SELECT count(*)=1 FROM public.clinical_documents WHERE id=:'d2_doc'));
SELECT pg_temp.expect_denied('issued_direct_update_denied', $$UPDATE public.clinical_documents SET payload='{}'::jsonb WHERE id='$$ || :'d2_doc' || $$'$$);
SELECT pg_temp.expect_denied('issued_direct_delete_denied', $$DELETE FROM public.clinical_documents WHERE id='$$ || :'d2_doc' || $$'$$);
SELECT pg_temp.expect_denied('professional_template_insert_denied', $$INSERT INTO public.clinical_document_templates(owner_type,document_type,name) VALUES('clinic','therapeutic_guidance','indevido')$$);
SELECT pg_temp.expect_denied('professional_template_update_denied', $$UPDATE public.clinical_document_templates SET name='indevido' WHERE id='12000000-0000-4000-8000-000000000003'$$);
SELECT pg_temp.expect_denied('professional_version_insert_denied', $$INSERT INTO public.clinical_document_template_versions(template_id,version) VALUES('12000000-0000-4000-8000-000000000003',2)$$);
SELECT pg_temp.expect_denied('other_professional_encounter_denied', $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000002','12100000-0000-4000-8000-000000000003','{}'::jsonb)$$);
SELECT pg_temp.expect_denied('finalized_encounter_denied', $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000003','12100000-0000-4000-8000-000000000001','{}'::jsonb)$$);
SELECT pg_temp.expect_denied('cancel_requires_reason', $$SELECT public.cancel_clinical_document('$$ || :'d2_doc' || $$','')$$);
SELECT public.cancel_clinical_document(:'d2_doc','Cancelamento de teste');
INSERT INTO d2_results VALUES ('cancel_rpc_with_reason', (SELECT status='canceled' AND cancel_reason='Cancelamento de teste' FROM public.clinical_documents WHERE id=:'d2_doc'));
COMMIT;

-- clinical.documents is an explicit gate, never a role fallback.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000002',true);
INSERT INTO d2_results VALUES ('documents_capability_false_templates_hidden', (SELECT count(*)=0 FROM public.clinical_document_templates));
SELECT pg_temp.expect_denied('documents_capability_false_denied', $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}'::jsonb)$$); COMMIT;

-- Non-physicians may issue guidance only when they have the base eligibility.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000003',true);
INSERT INTO d2_results VALUES ('physio_guidance_templates_only', (SELECT count(*)=2 AND bool_and(document_type='therapeutic_guidance') FROM public.clinical_document_templates));
SELECT pg_temp.expect_denied('physio_medication_denied', $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000002','12100000-0000-4000-8000-000000000001','{}'::jsonb)$$);
SELECT (public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000002','12100000-0000-4000-8000-000000000003','{"items":[{"guidance":"Orientação"}]}'::jsonb)).id AS d2_guidance \gset
INSERT INTO d2_results VALUES ('physio_guidance_allowed', (SELECT status='draft' FROM public.clinical_documents WHERE id=:'d2_guidance')); COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000004',true);
SELECT (public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000005','12100000-0000-4000-8000-000000000004','{}'::jsonb)).id AS d2_psy \gset
INSERT INTO d2_results VALUES ('psychologist_guidance_allowed', (SELECT status='draft' FROM public.clinical_documents WHERE id=:'d2_psy')); COMMIT;

-- No manager, inactive, platform, or cross-tenant bypass exists.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000005',true);
SELECT pg_temp.expect_denied('owner_without_identity_denied', $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}'::jsonb)$$); COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000007',true);
SELECT pg_temp.expect_denied('inactive_identity_denied', $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}'::jsonb)$$); COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000008',true);
SELECT pg_temp.expect_denied('cross_tenant_denied', $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}'::jsonb)$$); COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000099',true);
SELECT pg_temp.expect_denied('platform_without_clinic_denied', $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000001','{}'::jsonb)$$); COMMIT;

DO $$
DECLARE failures jsonb;
BEGIN
  SELECT jsonb_agg(to_jsonb(d2_results)) INTO failures FROM d2_results WHERE NOT passed;
  IF failures IS NOT NULL OR (SELECT count(*) FROM d2_results) <> 24 THEN RAISE EXCEPTION 'clinical_documents_behavior_failed: %', failures; END IF;
END $$;
SELECT 'CLINICAL DOCUMENTS FOUNDATION BEHAVIOR PASSED' AS result;
