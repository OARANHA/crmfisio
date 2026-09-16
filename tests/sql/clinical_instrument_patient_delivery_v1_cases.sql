\echo 'PATIENT DELIVERY V1 — behavior matrix'

-- 1) Registry is explicit and versioned: PHQ-9/GAD-7 are V1 seeds only.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.clinical_instrument_patient_self_contracts WHERE active) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.clinical_instrument_patient_self_contracts WHERE instrument_key='phq9' AND engine_rule_version='nexus-2026-09-03' AND active)
     OR NOT EXISTS (SELECT 1 FROM public.clinical_instrument_patient_self_contracts WHERE instrument_key='gad7' AND engine_rule_version='nexus-2026-09-03' AND active)
     OR EXISTS (SELECT 1 FROM public.clinical_instrument_patient_self_contracts WHERE instrument_key='phq15') THEN
    RAISE EXCEPTION 'patient_delivery_registry_seed_drift';
  END IF;
END $$;

-- A Nexus engine contract can exist without being remotely exposed.
INSERT INTO public.clinical_instrument_catalog(
  instrument_key,engine_source,engine_module_key,engine_tool_key,
  engine_rule_key,engine_rule_version,active
) VALUES (
  'nexus_only_scale','nexus','scales','nexus_only_scale',
  'nexus.nexus_only_scale','nexus-only-2026-09-10',true
) ON CONFLICT (instrument_key) DO UPDATE SET active=true;
INSERT INTO public.clinic_clinical_instrument_settings(clinic_id,instrument_key,enabled,configured_by)
VALUES ('00000000-0000-0000-0000-000000000001','nexus_only_scale',true,'00000000-0000-0000-0000-000000000104')
ON CONFLICT (clinic_id,instrument_key) DO UPDATE SET enabled=true;
-- 2) Multiprofessional neutral authority does not depend on effective Nexus authority.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000103","role":"authenticated"}',false);
SET ROLE authenticated;
DO $$
BEGIN
  IF public.can_send_clinical_instrument_to_patient(
       '00000000-0000-0000-0000-000000000502','phq9') IS NOT TRUE THEN
    RAISE EXCEPTION 'patient_delivery_authorized_professional_denied';
  END IF;
  IF public.has_professional_capability('nexus.scales') IS TRUE THEN
    RAISE EXCEPTION 'patient_delivery_test_actor_unexpected_nexus_authority';
  END IF;
  IF public.can_send_clinical_instrument_to_patient(
       '00000000-0000-0000-0000-000000000502','nexus_only_scale') IS TRUE THEN
    RAISE EXCEPTION 'patient_delivery_registry_bypass';
  END IF;
END $$;
RESET ROLE;

-- 3) Own active Encounter is required; another professional and scheduled Encounter deny.
DO $$
DECLARE pair record;
BEGIN
  FOR pair IN SELECT * FROM (VALUES
    ('00000000-0000-0000-0000-000000000103'::uuid,'00000000-0000-0000-0000-000000000501'::uuid),
    ('00000000-0000-0000-0000-000000000101'::uuid,'00000000-0000-0000-0000-000000000508'::uuid)
  ) AS x(actor_id,appointment_id)
  LOOP
    PERFORM set_config('request.jwt.claim.sub',pair.actor_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',pair.actor_id::text,'role','authenticated')::text,true);
    IF public.can_send_clinical_instrument_to_patient(pair.appointment_id,'phq9') IS TRUE THEN
      RAISE EXCEPTION 'patient_delivery_invalid_encounter_allowed: %',pair.appointment_id;
    END IF;
  END LOOP;
END $$;
-- 4) Service-only enqueue derives patient/version and is idempotent.
SET ROLE service_role;
DO $$
DECLARE first jsonb; replay jsonb;
BEGIN
  first := public.enqueue_clinical_instrument_patient_delivery(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000502',
    'phq9','20000000-0000-4000-8000-000000000001',48,
    'https://app.medicspro.test'
  );
  replay := public.enqueue_clinical_instrument_patient_delivery(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000502',
    'phq9','20000000-0000-4000-8000-000000000001',48,
    'https://app.medicspro.test'
  );
  IF first->>'replayed' <> 'false' OR replay->>'replayed' <> 'true'
     OR first->>'inviteId' IS DISTINCT FROM replay->>'inviteId'
     OR first->>'waLogId' IS DISTINCT FROM replay->>'waLogId'
     OR first->>'ruleVersion' <> 'nexus-2026-09-03' THEN
    RAISE EXCEPTION 'patient_delivery_idempotency_failed: % / %',first,replay;
  END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.nexus_self_assessment_invites WHERE authority_source='clinical_instrument' AND request_id='20000000-0000-4000-8000-000000000001') <> 1
     OR (SELECT count(*) FROM public.wa_logs WHERE template='clinical_instrument_patient_self') <> 1 THEN
    RAISE EXCEPTION 'patient_delivery_duplicate_transport';
  END IF;
END $$;
-- 5) Raw neutral responses stay outside the direct Nexus browser surface.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',false);
SET ROLE authenticated;
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.nexus_self_assessment_invites
  WHERE authority_source='clinical_instrument';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'patient_delivery_neutral_raw_row_visible';
  END IF;
END $$;
RESET ROLE;

-- Historical Nexus rows remain readable only through the unchanged Nexus C-01 guard.
INSERT INTO public.nexus_self_assessment_invites(
  clinic_id,patient_id,professional_id,appointment_id,scale_key,rule_version,
  token_hash,expires_at,status,response_snapshot,submitted_at
) VALUES (
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501',
  'phq9','nexus-2026-09-03',repeat('a',64),now()+interval '48 hours','submitted',
  '{"scaleKey":"phq9","ruleVersion":"nexus-2026-09-03","answers":{"q1":0}}'::jsonb,now()
);
SET ROLE authenticated;
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.nexus_self_assessment_invites
  WHERE authority_source='nexus' AND token_hash=repeat('a',64);
  IF v_count <> 1 THEN RAISE EXCEPTION 'patient_delivery_legacy_nexus_read_regressed'; END IF;
END $$;
RESET ROLE;
-- 6) The existing public token transport resolves/submits the neutral invitation.
SELECT substring(mensagem from 'autoavaliacao/([0-9a-f]+)') AS delivery_token
FROM public.wa_logs
WHERE template='clinical_instrument_patient_self'
ORDER BY created_at DESC LIMIT 1 \gset
\if :{?delivery_token}
\else
  \quit 1
\endif
SET ROLE anon;
SELECT invite_id::text AS resolved_invite
FROM public.resolve_nexus_self_assessment(:'delivery_token') \gset
SELECT public.submit_nexus_self_assessment(
  :'delivery_token',
  '{"scaleKey":"phq9","ruleVersion":"nexus-2026-09-03","answers":{"q1":1,"q2":1,"q3":1,"q4":1,"q5":1,"q6":1,"q7":1,"q8":1,"q9":1},"selectedOptions":[]}'::jsonb
) AS submitted_ok \gset
RESET ROLE;
\if :submitted_ok
\else
  \quit 1
\endif

SELECT EXISTS (
  SELECT 1 FROM public.nexus_self_assessment_invites
  WHERE id=:'resolved_invite'::uuid
    AND authority_source='clinical_instrument'
    AND status='submitted'
    AND submitted_at IS NOT NULL
    AND response_snapshot->>'scaleKey'='phq9'
) AS patient_delivery_public_submit_ok \gset
\if :patient_delivery_public_submit_ok
\else
  \quit 1
\endif
-- 7) Legacy and neutral workers claim only their own authority rows.
SET ROLE service_role;
CREATE TEMP TABLE patient_delivery_legacy_claim AS
SELECT * FROM public.claim_nexus_self_assessment_invites('phq9','nexus-2026-09-03',20);
CREATE TEMP TABLE patient_delivery_neutral_claim AS
SELECT * FROM public.claim_clinical_instrument_patient_invites('phq9',20);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM patient_delivery_legacy_claim) <> 1
     OR EXISTS (
       SELECT 1 FROM patient_delivery_legacy_claim c
       JOIN public.nexus_self_assessment_invites i ON i.id=c.invite_id
       WHERE i.authority_source <> 'nexus'
     ) THEN RAISE EXCEPTION 'patient_delivery_legacy_claim_crossed_authority'; END IF;
  IF (SELECT count(*) FROM patient_delivery_neutral_claim) <> 1
     OR EXISTS (
       SELECT 1 FROM patient_delivery_neutral_claim c
       JOIN public.nexus_self_assessment_invites i ON i.id=c.invite_id
       WHERE i.authority_source <> 'clinical_instrument'
     ) THEN RAISE EXCEPTION 'patient_delivery_neutral_claim_crossed_authority'; END IF;
END $$;

-- Processing is intentionally allowed after the valid invitation's Encounter ended.
UPDATE public.appointments
SET status='finalizado'
WHERE id='00000000-0000-0000-0000-000000000502';

CREATE TEMP TABLE patient_delivery_nexus_before AS
SELECT count(*)::integer AS n FROM public.nexus_clinical_results;
-- 8) Neutral completion writes one immutable patient_self administration, not Nexus result.
SET ROLE service_role;
DO $$
DECLARE v_invite uuid; v_first uuid; v_replay uuid; v_result jsonb;
BEGIN
  SELECT invite_id INTO v_invite FROM patient_delivery_neutral_claim LIMIT 1;
  v_result := jsonb_build_object(
    'engineSource','nexus','moduleKey','scales','toolKey','phq9',
    'ruleKey','nexus.phq9','ruleVersion','nexus-2026-09-03','requiredCapability','nexus.scales',
    'inputSnapshot',jsonb_build_object('source','patient-self-assessment','inviteId',v_invite,
      'answers','{"q1":1,"q2":1,"q3":1,"q4":1,"q5":1,"q6":1,"q7":1,"q8":1,"q9":1}'::jsonb),
    'outputSnapshot',jsonb_build_object('recommendations',jsonb_build_array('Revisão clínica'),'answersArray',jsonb_build_array(1,1,1,1,1,1,1,1,1),'selfAssessment',true),
    'totalScore',9,'maxScore',27,'classification','Faixa leve de sintomas depressivos',
    'severity','low','interpretation','Resultado de teste clínico neutro.',
    'soapText','PHQ-9: 9/27','evidenceSnapshot','[]'::jsonb
  );
  v_first := public.complete_clinical_instrument_patient_self_processing(
    v_invite,v_result,
    '[{"flagCode":"phq9.item9.positive","severity":"critical","title":"PHQ-9 item 9 positivo","message":"Sinal de teste"}]'::jsonb
  );
  v_replay := public.complete_clinical_instrument_patient_self_processing(
    v_invite,v_result,
    '[{"flagCode":"phq9.item9.positive","severity":"critical","title":"PHQ-9 item 9 positivo","message":"Sinal de teste"}]'::jsonb
  );
  IF v_first IS NULL OR v_replay IS DISTINCT FROM v_first THEN
    RAISE EXCEPTION 'patient_delivery_processing_idempotency_failed';
  END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.clinical_instrument_administrations
      WHERE provenance='patient_self' AND appointment_id='00000000-0000-0000-0000-000000000502') <> 1 THEN
    RAISE EXCEPTION 'patient_delivery_patient_self_persistence_missing';
  END IF;
  IF (SELECT count(*) FROM public.nexus_clinical_results) <> (SELECT n FROM patient_delivery_nexus_before) THEN
    RAISE EXCEPTION 'patient_delivery_neutral_created_nexus_result';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.nexus_self_assessment_invites
    WHERE authority_source='clinical_instrument'
      AND processed_administration_id IS NOT NULL
      AND processed_result_id IS NULL
      AND status='processed'
  ) THEN RAISE EXCEPTION 'patient_delivery_invite_completion_missing'; END IF;
END $$;

-- 9) Cross-writer attempts fail closed in both directions.
DO $$
DECLARE v_neutral uuid; v_nexus uuid; v_result uuid;
BEGIN
  SELECT id INTO v_neutral FROM public.nexus_self_assessment_invites WHERE authority_source='clinical_instrument' LIMIT 1;
  SELECT id INTO v_nexus FROM public.nexus_self_assessment_invites WHERE authority_source='nexus' AND token_hash=repeat('a',64) LIMIT 1;
  SELECT id INTO v_result FROM public.nexus_clinical_results LIMIT 1;
  BEGIN
    UPDATE public.nexus_self_assessment_invites SET processed_result_id=v_result WHERE id=v_neutral;
    RAISE EXCEPTION 'patient_delivery_neutral_nexus_result_escape';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.complete_clinical_instrument_patient_self_processing(v_nexus,'{}'::jsonb,'[]'::jsonb);
    RAISE EXCEPTION 'patient_delivery_nexus_invite_neutral_writer_escape';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_patient_processing_invite_invalid%' THEN RAISE; END IF;
  END;
END $$;
-- Cross-authority negative control with a Nexus-authorized clinician: historical
-- Nexus release/completion must still leave a neutral invite untouched.
INSERT INTO public.nexus_self_assessment_invites(
  clinic_id,patient_id,professional_id,appointment_id,scale_key,rule_version,
  token_hash,expires_at,status,response_snapshot,submitted_at,processing_started_at,
  authority_source,request_id
) VALUES (
  '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501',
  'phq9','nexus-2026-09-03',repeat('b',64),now()+interval '48 hours','submitted',
  '{"scaleKey":"phq9","ruleVersion":"nexus-2026-09-03","answers":{"q1":0,"q2":0,"q3":0,"q4":0,"q5":0,"q6":0,"q7":0,"q8":0,"q9":0}}'::jsonb,
  now(),now(),'clinical_instrument','20000000-0000-4000-8000-000000000099'
);

SET ROLE service_role;
SELECT public.release_nexus_self_assessment_claim(
  (SELECT id FROM public.nexus_self_assessment_invites WHERE token_hash=repeat('b',64)),
  'must not release neutral claim'
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.nexus_self_assessment_invites
    WHERE token_hash=repeat('b',64)
      AND authority_source='clinical_instrument'
      AND processing_started_at IS NOT NULL
      AND last_processing_error IS NULL
  ) THEN
    RAISE EXCEPTION 'patient_delivery_legacy_release_crossed_authority';
  END IF;
END $$;

CREATE TEMP TABLE patient_delivery_cross_writer_before AS
SELECT count(*)::integer AS n FROM public.nexus_clinical_results;

SET ROLE service_role;
DO $$
DECLARE v_invite uuid; v_result jsonb;
BEGIN
  SELECT id INTO v_invite FROM public.nexus_self_assessment_invites WHERE token_hash=repeat('b',64);
  v_result := jsonb_build_object(
    'engineSource','nexus','moduleKey','scales','toolKey','phq9',
    'ruleKey','nexus.phq9','ruleVersion','nexus-2026-09-03','requiredCapability','nexus.scales',
    'inputSnapshot',jsonb_build_object('answers','{}'::jsonb),
    'outputSnapshot','{}'::jsonb,
    'totalScore',0,'maxScore',27,'classification','Sem sintomas','severity','none',
    'interpretation','Controle negativo','soapText','Controle negativo','evidenceSnapshot','[]'::jsonb
  );
  BEGIN
    PERFORM public.complete_nexus_self_assessment_processing(v_invite,v_result,'[]'::jsonb);
    RAISE EXCEPTION 'patient_delivery_neutral_invite_nexus_writer_escape';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.nexus_clinical_results) <> (SELECT n FROM patient_delivery_cross_writer_before) THEN
    RAISE EXCEPTION 'patient_delivery_cross_writer_left_nexus_result';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.nexus_self_assessment_invites
    WHERE token_hash=repeat('b',64) AND processed_result_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'patient_delivery_cross_writer_linked_nexus_result';
  END IF;
END $$;

-- 10) Narrow status remains readable by the original professional after Encounter end.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000103","role":"authenticated"}',false);
SET ROLE authenticated;
DO $$
DECLARE v_count integer; v_processed boolean;
BEGIN
  SELECT count(*), bool_and(processed) INTO v_count, v_processed
  FROM public.list_clinical_instrument_patient_deliveries('00000000-0000-0000-0000-000000000502');
  IF v_count <> 1 OR v_processed IS NOT TRUE THEN
    RAISE EXCEPTION 'patient_delivery_status_projection_failed';
  END IF;
END $$;
RESET ROLE;

-- Give the disposable actor chart-read authority only for the history projection proof.
DELETE FROM public.professional_capabilities
WHERE clinic_id='00000000-0000-0000-0000-000000000001'
  AND professional_id='00000000-0000-0000-0000-000000000103'
  AND capability_key='clinical.timeline.read';
INSERT INTO public.professional_capabilities(clinic_id,professional_id,capability_key,granted)
VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000103','clinical.timeline.read',true);

-- 11) Longitudinal history returns both administration modes without raw answers.
SET ROLE authenticated;
DO $$
DECLARE v_assisted integer; v_self integer;
BEGIN
  SELECT count(*) FILTER (WHERE provenance='clinician_assisted'),
         count(*) FILTER (WHERE provenance='patient_self')
    INTO v_assisted,v_self
  FROM public.list_patient_clinical_instrument_history('00000000-0000-0000-0000-000000000301');
  IF v_assisted < 1 OR v_self <> 1 THEN
    RAISE EXCEPTION 'patient_delivery_combined_history_failed: assisted %, self %',v_assisted,v_self;
  END IF;
END $$;
RESET ROLE;
-- 12) Delivery transport requirements fail closed and leave no partial rows.
UPDATE public.appointments SET status='em_atendimento'
WHERE id='00000000-0000-0000-0000-000000000502';
UPDATE public.patients SET opt_in_whats=false
WHERE id='00000000-0000-0000-0000-000000000301';
CREATE TEMP TABLE patient_delivery_residue_snapshot AS
SELECT
  (SELECT count(*) FROM public.nexus_self_assessment_invites) AS invite_count,
  (SELECT count(*) FROM public.wa_logs) AS wa_log_count;

SET ROLE service_role;
DO $$
BEGIN
  BEGIN
    PERFORM public.enqueue_clinical_instrument_patient_delivery(
      '00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000502',
      'phq9','20000000-0000-4000-8000-000000000002',48,'https://app.medicspro.test');
    RAISE EXCEPTION 'patient_delivery_optin_bypass';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_patient_delivery_whatsapp_opt_in_required%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

DO $$
DECLARE before_invites integer; before_logs integer;
BEGIN
  SELECT invite_count, wa_log_count INTO before_invites, before_logs
  FROM patient_delivery_residue_snapshot;
  IF (SELECT count(*) FROM public.nexus_self_assessment_invites) <> before_invites
     OR (SELECT count(*) FROM public.wa_logs) <> before_logs THEN
    RAISE EXCEPTION 'patient_delivery_failed_enqueue_left_residue';
  END IF;
END $$;
DROP TABLE patient_delivery_residue_snapshot;
UPDATE public.patients SET opt_in_whats=true
WHERE id='00000000-0000-0000-0000-000000000301';

-- 13) Browser cannot execute service writers or read the patient-self registry directly.
DO $$
BEGIN
  IF has_function_privilege('authenticated','public.enqueue_clinical_instrument_patient_delivery(uuid,uuid,text,uuid,integer,text)'::regprocedure,'EXECUTE')
     OR has_function_privilege('authenticated','public.complete_clinical_instrument_patient_self_processing(uuid,jsonb,jsonb)'::regprocedure,'EXECUTE')
     OR has_table_privilege('authenticated','public.clinical_instrument_patient_self_contracts','SELECT') THEN
    RAISE EXCEPTION 'patient_delivery_browser_privilege_drift';
  END IF;
  IF NOT has_function_privilege('authenticated','public.can_send_clinical_instrument_to_patient(uuid,text)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('authenticated','public.list_available_clinical_instrument_patient_delivery(uuid)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('authenticated','public.list_clinical_instrument_patient_deliveries(uuid)'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'patient_delivery_browser_projection_missing';
  END IF;
END $$;

\echo 'CLINICAL_INSTRUMENT_PATIENT_DELIVERY_V1_BEHAVIOR_OK'
