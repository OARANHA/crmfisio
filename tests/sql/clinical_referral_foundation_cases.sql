-- D2-E0 — Referral / Encaminhamento Canonical Foundation behavior matrix.
-- Reuses established D2-A identities/appointments; no authorization helper is redefined.

DROP TABLE IF EXISTS d2e0_results;
CREATE TEMP TABLE d2e0_results(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON d2e0_results TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.d2e0_expect_error(
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
  INSERT INTO d2e0_results VALUES (p_name, ok);
END $$;

-- A physician remains eligible for all previously applicable document types and
-- gains referral through the common multiprofessional clinical boundary.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
INSERT INTO d2e0_results VALUES
  ('physician_referral_eligible', public.current_user_can_issue_clinical_document('referral')),
  ('physician_exam_order_preserved', public.current_user_can_issue_clinical_document('exam_order')),
  ('physician_prescription_preserved', public.current_user_can_issue_clinical_document('medication_prescription')),
  ('physician_guidance_preserved', public.current_user_can_issue_clinical_document('therapeutic_guidance')),
  ('unknown_type_fail_closed', NOT public.current_user_can_issue_clinical_document('unknown_document'));
COMMIT;

-- A non-medical clinical professional with clinical.documents can author a
-- referral, but still cannot prescribe medication or order exams through D2-D0.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000003',true);

INSERT INTO d2e0_results VALUES
  ('physio_referral_eligible', public.current_user_can_issue_clinical_document('referral')),
  ('physio_referral_template_visible', (
    SELECT count(*) = 1
    FROM public.clinical_document_templates
    WHERE document_type = 'referral'
      AND id = '12000000-0000-4000-8000-000000000007'::uuid
  )),
  ('physio_guidance_still_allowed', public.current_user_can_issue_clinical_document('therapeutic_guidance')),
  ('physio_exam_order_still_denied', NOT public.current_user_can_issue_clinical_document('exam_order')),
  ('physio_prescription_still_denied', NOT public.current_user_can_issue_clinical_document('medication_prescription'));

SELECT pg_temp.d2e0_expect_error(
  'professional_id_only_not_referral_owner',
  $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000007','12100000-0000-4000-8000-000000000007','{}'::jsonb)$$,
  'clinical_document_own_active_encounter_required'
);

SELECT pg_temp.d2e0_expect_error(
  'terminal_encounter_referral_draft_denied',
  $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000003','12100000-0000-4000-8000-000000000007','{}'::jsonb)$$,
  'clinical_document_own_active_encounter_required'
);

SELECT (public.create_clinical_document_draft(
  'd2300000-0000-4000-8000-000000000002',
  '12100000-0000-4000-8000-000000000007',
  '{}'::jsonb
)).id AS referral_doc \gset

INSERT INTO d2e0_results VALUES
  ('incomplete_referral_draft_allowed', (
    SELECT status = 'draft' AND document_type = 'referral' AND payload = '{}'::jsonb
    FROM public.clinical_documents WHERE id = :'referral_doc'
  ));

SELECT pg_temp.d2e0_expect_error(
  'referral_missing_recipient_denied',
  format('SELECT public.issue_clinical_document(%L::uuid)', :'referral_doc'),
  'clinical_document_referral_recipient_required'
);

SELECT public.save_clinical_document_draft(
  :'referral_doc',
  '{"recipient":{"specialty":"Cardiologia"}}'::jsonb
);
SELECT pg_temp.d2e0_expect_error(
  'referral_missing_reason_denied',
  format('SELECT public.issue_clinical_document(%L::uuid)', :'referral_doc'),
  'clinical_document_referral_reason_required'
);

SELECT public.save_clinical_document_draft(
  :'referral_doc',
  '{"recipient":{"specialty":"Cardiologia","unexpected":"x"},"reason":"Avaliação especializada"}'::jsonb
);
SELECT pg_temp.d2e0_expect_error(
  'referral_unknown_recipient_field_denied',
  format('SELECT public.issue_clinical_document(%L::uuid)', :'referral_doc'),
  'clinical_document_referral_recipient_invalid'
);

SELECT public.save_clinical_document_draft(
  :'referral_doc',
  '{"recipient":{"specialty":"Cardiologia"},"reason":"Avaliação especializada","priority":"immediate"}'::jsonb
);
SELECT pg_temp.d2e0_expect_error(
  'referral_invalid_priority_denied',
  format('SELECT public.issue_clinical_document(%L::uuid)', :'referral_doc'),
  'clinical_document_referral_priority_invalid'
);

SELECT public.save_clinical_document_draft(
  :'referral_doc',
  '{"recipient":{"professional_type":"medico","specialty":"Cardiologia","service":"Avaliação cardiológica","facility":"Serviço de referência","contact":"Contato conforme rede assistencial"},"reason":"Avaliação de sintomas cardiovasculares persistentes","clinical_summary":"Paciente em acompanhamento, com achados que justificam avaliação especializada.","requested_action":"Avaliação e conduta conforme julgamento do especialista.","priority":"high","observations":"Compartilhar retorno assistencial quando disponível."}'::jsonb
);
SELECT public.issue_clinical_document(:'referral_doc');

INSERT INTO d2e0_results VALUES
  ('referral_issue_freezes_snapshot', (
    SELECT status = 'issued'
       AND document_type = 'referral'
       AND payload_snapshot->'recipient'->>'specialty' = 'Cardiologia'
       AND payload_snapshot->>'reason' = 'Avaliação de sintomas cardiovasculares persistentes'
       AND context_snapshot IS NOT NULL
       AND template_definition_snapshot IS NOT NULL
       AND btrim(coalesce(rendered_snapshot,'')) <> ''
       AND position('Documento: Encaminhamento clínico' in rendered_snapshot) > 0
       AND position('Documento: referral' in rendered_snapshot) = 0
       AND issued_at IS NOT NULL
    FROM public.clinical_documents WHERE id = :'referral_doc'
  )),
  ('referral_events_append_lifecycle', (
    SELECT count(*) = 2
    FROM public.clinical_document_events
    WHERE document_id = :'referral_doc'
      AND event_type IN ('created','issued')
  ));
COMMIT;

-- Capability remains a required authorization layer.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000002',true);
INSERT INTO d2e0_results VALUES
  ('professional_without_documents_capability_denied', NOT public.current_user_can_issue_clinical_document('referral')),
  ('referral_template_hidden_without_capability', (
    SELECT count(*) = 0 FROM public.clinical_document_templates WHERE document_type = 'referral'
  ));
COMMIT;

-- Inactive professional is denied.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000007',true);
INSERT INTO d2e0_results VALUES
  ('inactive_professional_referral_denied', NOT public.current_user_can_issue_clinical_document('referral'));
COMMIT;

-- Management role by itself never becomes clinical authorship.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000005',true);
INSERT INTO d2e0_results VALUES
  ('owner_referral_no_bypass', NOT public.current_user_can_issue_clinical_document('referral'));
COMMIT;

-- Cross-tenant Encounter ownership remains fail-closed.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000008',true);
INSERT INTO d2e0_results VALUES
  ('tenant_b_professional_referral_eligible_in_own_context', public.current_user_can_issue_clinical_document('referral'));
SELECT pg_temp.d2e0_expect_error(
  'cross_tenant_referral_draft_denied',
  $$SELECT public.create_clinical_document_draft('d2300000-0000-4000-8000-000000000001','12100000-0000-4000-8000-000000000007','{}'::jsonb)$$,
  'clinical_document_own_active_encounter_required'
);
COMMIT;

SELECT pg_temp.d2e0_expect_error(
  'issued_referral_snapshot_immutable',
  format('UPDATE public.clinical_documents SET payload_snapshot=%L::jsonb WHERE id=%L::uuid', '{}'::text, :'referral_doc'),
  'clinical_document_issued_immutable'
);
SELECT pg_temp.d2e0_expect_error(
  'unknown_document_type_constraint_closed',
  $$INSERT INTO public.clinical_document_templates(owner_type,document_type,name,status) VALUES('platform','unknown_document','Invalido','active')$$,
  NULL
);

-- Cancellation inherits the D2-A audited lifecycle and preserves frozen content.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000003',true);
SELECT public.cancel_clinical_document(:'referral_doc', 'Cancelamento de teste D2-E0');
INSERT INTO d2e0_results VALUES
  ('referral_cancel_audited_and_snapshot_preserved', (
    SELECT status = 'canceled'
       AND cancel_reason = 'Cancelamento de teste D2-E0'
       AND payload_snapshot->'recipient'->>'specialty' = 'Cardiologia'
       AND canceled_at IS NOT NULL
       AND canceled_by = 'd2100000-0000-4000-8000-000000000003'::uuid
    FROM public.clinical_documents WHERE id = :'referral_doc'
  )),
  ('referral_cancel_event_appended', (
    SELECT count(*) = 3
    FROM public.clinical_document_events
    WHERE document_id = :'referral_doc'
      AND event_type IN ('created','issued','canceled')
  ));
COMMIT;

-- Prior typed payload contracts remain intact.
SELECT pg_temp.d2e0_expect_error(
  'medication_non_array_items_regression_guard',
  $$SELECT public.assert_clinical_document_payload_ready('medication_prescription','{"items":{}}'::jsonb)$$,
  'clinical_document_medication_items_required'
);
SELECT pg_temp.d2e0_expect_error(
  'guidance_non_array_items_regression_guard',
  $$SELECT public.assert_clinical_document_payload_ready('therapeutic_guidance','{"items":{}}'::jsonb)$$,
  'clinical_document_guidance_items_required'
);
SELECT pg_temp.d2e0_expect_error(
  'exam_non_array_items_regression_guard',
  $$SELECT public.assert_clinical_document_payload_ready('exam_order','{"items":{}}'::jsonb)$$,
  'clinical_document_exam_items_required'
);

INSERT INTO d2e0_results VALUES (
  'referral_plain_text_renderer_supported',
  (
    SELECT position('ENCAMINHAMENTO CLÍNICO' in rendered) > 0
       AND position('Documento: Encaminhamento clínico' in rendered) > 0
       AND position('Documento: referral' in rendered) = 0
    FROM (
      SELECT public.render_clinical_document_snapshot(
        'referral',
        'Encaminhamento clínico',
        '{"recipient":{"specialty":"Cardiologia"},"reason":"Avaliação especializada"}'::jsonb,
        '{"patient":{"name":"Paciente"},"issuer":{"name":"Profissional"}}'::jsonb
      ) AS rendered
    ) r
  )
);
SELECT pg_temp.d2e0_expect_error(
  'renderer_unknown_type_denied',
  $$SELECT public.render_clinical_document_snapshot('unknown','X','{}'::jsonb,'{}'::jsonb)$$,
  'clinical_document_render_contract_invalid'
);

DO $$
DECLARE failures text;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY name) INTO failures
  FROM d2e0_results WHERE NOT passed;
  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'D2-E0 failed cases: %', failures;
  END IF;
END $$;

TABLE d2e0_results;
