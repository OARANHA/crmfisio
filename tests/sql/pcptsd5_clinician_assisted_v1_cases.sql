-- PC-PTSD-5 Clinician-Assisted V1 — disposable PostgreSQL cases.

CREATE OR REPLACE FUNCTION public.test_cai_pcptsd5_negative_gate_result()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'engineSource','nexus','engineModuleKey','scales','engineToolKey','pcptsd5',
    'engineRuleKey','nexus.pcptsd5','engineRuleVersion','nexus-pcptsd5-ptbr-ops-2026-09-16',
    'outputSnapshot',jsonb_build_object(
      'answersArray',jsonb_build_array(0),
      'clinicianAssisted',true,'guidanceMode','clinician-review'
    ),
    'totalScore',0,'maxScore',5,
    'classification','Trauma gate não confirmado; rastreio encerrado','severity','low',
    'interpretation','Gate negativo; tradução PT-BR operacional, sem validação brasileira reclamada.',
    'soapText','PC-PTSD-5: trauma gate negativo; rastreio encerrado com escore 0/5',
    'evidenceSnapshot','[]'::jsonb
  )
$$;
GRANT EXECUTE ON FUNCTION public.test_cai_pcptsd5_negative_gate_result() TO service_role;

CREATE OR REPLACE FUNCTION public.test_cai_pcptsd5_positive_result()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'engineSource','nexus','engineModuleKey','scales','engineToolKey','pcptsd5',
    'engineRuleKey','nexus.pcptsd5','engineRuleVersion','nexus-pcptsd5-ptbr-ops-2026-09-16',
    'outputSnapshot',jsonb_build_object(
      'answersArray',jsonb_build_array(1,1,1,1,1,0),
      'clinicianAssisted',true,'guidanceMode','clinician-review'
    ),
    'totalScore',4,'maxScore',5,
    'classification','Rastreio positivo pelo cutoff operacional PC-PTSD-5 ≥ 4','severity','moderate',
    'interpretation','Resultado PC-PTSD-5 para revisão clínica; não estabelece diagnóstico.',
    'soapText','PC-PTSD-5: 4/5; trauma gate sim','evidenceSnapshot','[]'::jsonb
  )
$$;
GRANT EXECUTE ON FUNCTION public.test_cai_pcptsd5_positive_result() TO service_role;

-- Catalog presence alone remains deny-by-default.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','pcptsd5'
  ) THEN RAISE EXCEPTION 'PCPTSD5 default-deny escaped'; END IF;
END $$;
RESET ROLE;

-- Only the canonical owner/admin setting path enables the clinic.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','pcptsd5',true
  );
  IF v <> 'OK' THEN RAISE EXCEPTION 'PCPTSD5 owner enable failed: %',v; END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$ BEGIN
  IF NOT public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','pcptsd5'
  ) THEN RAISE EXCEPTION 'PCPTSD5 authorized active encounter denied'; END IF;
END $$;
RESET ROLE;

-- Gate-negative persistence stores only q0; hidden symptom answers must not appear.
SET ROLE service_role;
DO $$ DECLARE v jsonb; BEGIN
  v := public.record_clinician_assisted_clinical_instrument(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','pcptsd5',
    '18000000-0000-4000-8000-000000000001',
    '{"q0":0}'::jsonb,
    public.test_cai_pcptsd5_negative_gate_result(),'[]'::jsonb
  );
  IF v->>'replayed' <> 'false' OR v->>'instrumentKey' <> 'pcptsd5'
     OR v->>'engineRuleVersion' <> 'nexus-pcptsd5-ptbr-ops-2026-09-16' THEN
    RAISE EXCEPTION 'PCPTSD5 negative-gate persist response drift: %',v;
  END IF;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_instrument_administrations
    WHERE request_id='18000000-0000-4000-8000-000000000001'
      AND instrument_key='pcptsd5'
      AND engine_rule_key='nexus.pcptsd5'
      AND engine_rule_version='nexus-pcptsd5-ptbr-ops-2026-09-16'
      AND total_score=0 AND max_score=5
      AND jsonb_array_length(safety_signals)=0
      AND answers_snapshot = '{"q0":0}'::jsonb
  ) THEN RAISE EXCEPTION 'PCPTSD5 gate-negative snapshot missing or widened'; END IF;
END $$;

-- Positive gate persists q0 plus exactly five symptoms and supports replay.
SET ROLE service_role;
DO $$ DECLARE v jsonb; BEGIN
  v := public.record_clinician_assisted_clinical_instrument(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','pcptsd5',
    '18000000-0000-4000-8000-000000000002',
    '{"q0":1,"q1":1,"q2":1,"q3":1,"q4":1,"q5":0}'::jsonb,
    public.test_cai_pcptsd5_positive_result(),'[]'::jsonb
  );
  IF v->>'replayed' <> 'false' THEN RAISE EXCEPTION 'PCPTSD5 initial positive persist drift: %',v; END IF;

  v := public.record_clinician_assisted_clinical_instrument(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','pcptsd5',
    '18000000-0000-4000-8000-000000000002',
    '{"q0":1,"q1":1,"q2":1,"q3":1,"q4":1,"q5":0}'::jsonb,
    public.test_cai_pcptsd5_positive_result(),'[]'::jsonb
  );
  IF v->>'replayed' <> 'true' THEN RAISE EXCEPTION 'PCPTSD5 idempotent replay failed: %',v; END IF;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_instrument_administrations
    WHERE request_id='18000000-0000-4000-8000-000000000002'
      AND instrument_key='pcptsd5'
      AND total_score=4 AND max_score=5
      AND answers_snapshot = '{"q0":1,"q1":1,"q2":1,"q3":1,"q4":1,"q5":0}'::jsonb
  ) THEN RAISE EXCEPTION 'PCPTSD5 positive snapshot missing'; END IF;
  IF (SELECT count(*) FROM public.clinical_instrument_administrations
      WHERE request_id='18000000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'PCPTSD5 replay created duplicate row';
  END IF;
END $$;

-- Forged engine version remains blocked by the unchanged writer contract.
SET ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.record_clinician_assisted_clinical_instrument(
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000501','pcptsd5',
      '18000000-0000-4000-8000-000000000003',
      '{"q0":1,"q1":1,"q2":1,"q3":1,"q4":1,"q5":0}'::jsonb,
      public.test_cai_pcptsd5_positive_result() || '{"engineRuleVersion":"forged"}'::jsonb,
      '[]'::jsonb
    );
    RAISE EXCEPTION 'PCPTSD5 forged engine contract escaped';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_administration_engine_contract_mismatch%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- Disabling the clinic setting revokes future Apply Now authorization.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','pcptsd5',false
  );
  IF v <> 'OK' THEN RAISE EXCEPTION 'PCPTSD5 owner disable failed: %',v; END IF;
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','pcptsd5'
  ) THEN RAISE EXCEPTION 'PCPTSD5 disabled setting still authorized'; END IF;
END $$;
RESET ROLE;

\echo 'PCPTSD5_CLINICIAN_ASSISTED_V1_BEHAVIOR_OK'
