-- D2-D0 — Exam Order Canonical Foundation behavior matrix.
-- Uses the established D2-A identities/appointments; no helper is redefined here.

DROP TABLE IF EXISTS d2d0_results;
CREATE TEMP TABLE d2d0_results(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON d2d0_results TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.d2d0_expect_error(
  p_name text,
  p_sql text,
  p_expected text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    ok := p_expected IS NULL OR position(lower(p_expected) in lower(SQLERRM)) > 0;
  END;
  INSERT INTO d2d0_results VALUES (p_name, ok);
END $$;

-- Medical issuer: same common D2-A boundary + explicit medical/CRM eligibility.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);

INSERT INTO d2d0_results VALUES
  ('physician_exam_order_eligible', public.current_user_can_issue_clinical_document('exam_order')),
  ('prescription_eligibility_preserved', public.current_user_can_issue_clinical_document('medication_prescription')),
  ('guidance_eligibility_preserved', public.current_user_can_issue_clinical_document('therapeutic_guidance')),
  ('unknown_type_fail_closed', NOT public.current_user_can_issue_clinical_document('unknown_document')),
  ('exam_template_visible', (
    SELECT count(*) = 1
    FROM public.clinical_document_templates
    WHERE document_type = 'exam_order'
      AND id = '12000000-0000-4000-8000-000000000006'::uuid
  ));

SELECT pg_temp.d2d0_expect_error(
  'professional_id_only_not_document_owner',
  $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000007','12100000-0000-4000-8000-000000000006','{}'::jsonb)$$,
  'clinical_document_own_active_encounter_required'
);

SELECT pg_temp.d2d0_expect_error(
  'terminal_encounter_exam_draft_denied',
  $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000003','12100000-0000-4000-8000-000000000006','{}'::jsonb)$$,
  'clinical_document_own_active_encounter_required'
);

SELECT (public.create_clinical_document_draft(
  'd2300000-0000-4000-8000-000000000001',
  '12100000-0000-4000-8000-000000000006',
  '{}'::jsonb
)).id AS exam_doc \gset

INSERT INTO d2d0_results VALUES
  ('incomplete_exam_draft_allowed', (
    SELECT status = 'draft' AND document_type = 'exam_order' AND payload = '{}'::jsonb
    FROM public.clinical_documents WHERE id = :'exam_doc'
  ));

SELECT pg_temp.d2d0_expect_error(
  'exam_empty_items_issue_denied',
  format('SELECT public.issue_clinical_document(%L::uuid)', :'exam_doc'),
  'clinical_document_exam_items_required'
);

SELECT public.save_clinical_document_draft(:'exam_doc', '{"items":{}}'::jsonb);
SELECT pg_temp.d2d0_expect_error(
  'exam_non_array_items_issue_denied',
  format('SELECT public.issue_clinical_document(%L::uuid)', :'exam_doc'),
  'clinical_document_exam_items_required'
);

SELECT public.save_clinical_document_draft(:'exam_doc', '{"items":[{}]}'::jsonb);
SELECT pg_temp.d2d0_expect_error(
  'exam_blank_name_issue_denied',
  format('SELECT public.issue_clinical_document(%L::uuid)', :'exam_doc'),
  'clinical_document_exam_item_invalid'
);

SELECT public.save_clinical_document_draft(
  :'exam_doc',
  '{"items":[{"exam_name":"Hemograma","urgent":"yes"}]}'::jsonb
);
SELECT pg_temp.d2d0_expect_error(
  'exam_invalid_item_shape_denied',
  format('SELECT public.issue_clinical_document(%L::uuid)', :'exam_doc'),
  'clinical_document_exam_item_invalid'
);

SELECT public.save_clinical_document_draft(
  :'exam_doc',
  '{"items":[{"exam_name":"Hemograma"}],"priority":"immediate"}'::jsonb
);
SELECT pg_temp.d2d0_expect_error(
  'exam_invalid_priority_denied',
  format('SELECT public.issue_clinical_document(%L::uuid)', :'exam_doc'),
  'clinical_document_exam_priority_invalid'
);

SELECT public.save_clinical_document_draft(
  :'exam_doc',
  '{"items":[{"exam_name":"Hemograma completo","code":"HC","category":"laboratory","instructions":"Jejum conforme orientação do laboratório","urgent":false},{"exam_name":"TSH","category":"laboratory"}],"clinical_indication":"Investigação clínica","impression":"Hipótese em avaliação","priority":"routine","observations":"Correlacionar clinicamente."}'::jsonb
);
SELECT public.issue_clinical_document(:'exam_doc');

INSERT INTO d2d0_results VALUES
  ('exam_issue_freezes_snapshot', (
    SELECT status = 'issued'
       AND document_type = 'exam_order'
       AND payload_snapshot->'items'->0->>'exam_name' = 'Hemograma completo'
       AND context_snapshot IS NOT NULL
       AND template_definition_snapshot IS NOT NULL
       AND btrim(coalesce(rendered_snapshot,'')) <> ''
       AND position('Documento: Pedido de exames' in rendered_snapshot) > 0
       AND position('Documento: exam_order' in rendered_snapshot) = 0
       AND issued_at IS NOT NULL
    FROM public.clinical_documents WHERE id = :'exam_doc'
  )),
  ('exam_events_append_lifecycle', (
    SELECT count(*) = 2
    FROM public.clinical_document_events
    WHERE document_id = :'exam_doc'
      AND event_type IN ('created','issued')
  ));
COMMIT;

-- Medical identity without the document capability must stay denied.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000002',true);
INSERT INTO d2d0_results VALUES
  ('physician_without_documents_capability_denied', NOT public.current_user_can_issue_clinical_document('exam_order')),
  ('exam_template_hidden_without_capability', (
    SELECT count(*) = 0 FROM public.clinical_document_templates WHERE document_type = 'exam_order'
  ));
COMMIT;

-- Inactive medical profile is denied even if its profession/registration look valid.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000007',true);
INSERT INTO d2d0_results VALUES
  ('inactive_physician_exam_order_denied', NOT public.current_user_can_issue_clinical_document('exam_order'));
COMMIT;

-- A non-medical professional with clinical.documents remains eligible for
-- therapeutic guidance but does not gain exam_order through profession,
-- specialty or the coarse documents capability alone.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000003',true);
INSERT INTO d2d0_results VALUES
  ('physio_exam_order_denied', NOT public.current_user_can_issue_clinical_document('exam_order')),
  ('physio_guidance_still_allowed', public.current_user_can_issue_clinical_document('therapeutic_guidance')),
  ('exam_template_hidden_from_ineligible_actor', (
    SELECT count(*) = 0 FROM public.clinical_document_templates WHERE document_type = 'exam_order'
  ));
SELECT pg_temp.d2d0_expect_error(
  'physio_exam_draft_denied',
  $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000002','12100000-0000-4000-8000-000000000006','{}'::jsonb)$$,
  'clinical_document_eligibility_required'
);
COMMIT;

-- A valid doctor in another tenant cannot use Clinic A's encounter.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000008',true);
INSERT INTO d2d0_results VALUES
  ('tenant_b_physician_eligible_in_own_context', public.current_user_can_issue_clinical_document('exam_order'));
SELECT pg_temp.d2d0_expect_error(
  'cross_tenant_exam_draft_denied',
  $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000006','{}'::jsonb)$$,
  'clinical_document_own_active_encounter_required'
);
COMMIT;

-- Management role alone is not clinical authorship.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000005',true);
INSERT INTO d2d0_results VALUES
  ('owner_exam_order_no_bypass', NOT public.current_user_can_issue_clinical_document('exam_order'));
COMMIT;

-- Immutable issued document and closed type contract remain intact.
SELECT pg_temp.d2d0_expect_error(
  'issued_exam_snapshot_immutable',
  format('UPDATE public.clinical_documents SET payload_snapshot=%L::jsonb WHERE id=%L::uuid', '{}'::text, :'exam_doc'),
  'clinical_document_issued_immutable'
);
SELECT pg_temp.d2d0_expect_error(
  'unknown_document_type_constraint_closed',
  $$INSERT INTO public.clinical_document_templates(owner_type,document_type,name,status) VALUES('platform','unknown_document','Invalido','active')$$,
  NULL
);

-- Cancellation uses the inherited D2-A audited lifecycle and preserves snapshots.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
SELECT public.cancel_clinical_document(:'exam_doc', 'Cancelamento de teste D2-D0');
INSERT INTO d2d0_results VALUES
  ('exam_cancel_audited_and_snapshot_preserved', (
    SELECT status = 'canceled'
       AND cancel_reason = 'Cancelamento de teste D2-D0'
       AND payload_snapshot->'items'->0->>'exam_name' = 'Hemograma completo'
       AND canceled_at IS NOT NULL
       AND canceled_by = 'd2100000-0000-4000-8000-000000000001'::uuid
    FROM public.clinical_documents WHERE id = :'exam_doc'
  )),
  ('exam_cancel_event_appended', (
    SELECT count(*) = 3
    FROM public.clinical_document_events
    WHERE document_id = :'exam_doc'
      AND event_type IN ('created','issued','canceled')
  ));
COMMIT;

-- Internal helpers must preserve the established error semantics for malformed
-- medication/guidance payloads while adding the new exam type.
SELECT pg_temp.d2d0_expect_error(
  'medication_non_array_items_regression_guard',
  $$SELECT public.assert_clinical_document_payload_ready('medication_prescription','{"items":{}}'::jsonb)$$,
  'clinical_document_medication_items_required'
);
SELECT pg_temp.d2d0_expect_error(
  'guidance_non_array_items_regression_guard',
  $$SELECT public.assert_clinical_document_payload_ready('therapeutic_guidance','{"items":{}}'::jsonb)$$,
  'clinical_document_guidance_items_required'
);

-- Internal renderer understands exam_order, uses a human patient-facing label,
-- and still rejects unknown types.
INSERT INTO d2d0_results VALUES (
  'exam_plain_text_renderer_supported',
  (
    SELECT position('PEDIDO DE EXAMES' in rendered) > 0
       AND position('Documento: Pedido de exames' in rendered) > 0
       AND position('Documento: exam_order' in rendered) = 0
    FROM (
      SELECT public.render_clinical_document_snapshot(
        'exam_order',
        'Pedido de exames',
        '{"items":[{"exam_name":"Hemograma"}]}'::jsonb,
        '{"patient":{"name":"Paciente"},"issuer":{"name":"Médico"}}'::jsonb
      ) AS rendered
    ) r
  )
);
SELECT pg_temp.d2d0_expect_error(
  'renderer_unknown_type_denied',
  $$SELECT public.render_clinical_document_snapshot('unknown','X','{}'::jsonb,'{}'::jsonb)$$,
  'clinical_document_render_contract_invalid'
);

DO $$
DECLARE failures text;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY name) INTO failures
  FROM d2d0_results WHERE NOT passed;
  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'D2-D0 failed cases: %', failures;
  END IF;
END $$;

TABLE d2d0_results;
