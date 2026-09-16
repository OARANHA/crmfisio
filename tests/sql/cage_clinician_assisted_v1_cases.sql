-- CAGE Clinician-Assisted V1 — disposable PostgreSQL 16 cases.

CREATE OR REPLACE FUNCTION public.test_cai_cage_result()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'engineSource','nexus','engineModuleKey','scales','engineToolKey','cage',
    'engineRuleKey','nexus.cage','engineRuleVersion','nexus-cage-2026-09-16',
    'outputSnapshot',jsonb_build_object(
      'answersArray',jsonb_build_array(1,1,0,0),
      'clinicianAssisted',true,'guidanceMode','clinician-review'
    ),
    'totalScore',2,'maxScore',4,
    'classification','Rastreio positivo pelo corte CAGE ≥ 2','severity','moderate',
    'interpretation','Resultado CAGE para revisão clínica; não estabelece diagnóstico.',
    'soapText','CAGE: 2/4 respostas afirmativas','evidenceSnapshot','[]'::jsonb
  )
$$;
GRANT EXECUTE ON FUNCTION public.test_cai_cage_result() TO service_role;

-- Catalog presence alone must remain deny-by-default.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','cage'
  ) THEN RAISE EXCEPTION 'CAGE default-deny escaped'; END IF;
END $$;
RESET ROLE;

-- Only the canonical owner/admin setting path enables the clinic.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','cage',true
  );
  IF v <> 'OK' THEN RAISE EXCEPTION 'CAGE owner enable failed: %',v; END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$ BEGIN
  IF NOT public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','cage'
  ) THEN RAISE EXCEPTION 'CAGE authorized active encounter denied'; END IF;
END $$;
RESET ROLE;

-- Persist one canonical CAGE snapshot through the unchanged service-only writer.
SET ROLE service_role;
DO $$ DECLARE v jsonb; BEGIN
  v := public.record_clinician_assisted_clinical_instrument(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','cage',
    '16000000-0000-4000-8000-000000000001',
    '{"q1":1,"q2":1,"q3":0,"q4":0}'::jsonb,
    public.test_cai_cage_result(),'[]'::jsonb
  );
  IF v->>'replayed' <> 'false' OR v->>'instrumentKey' <> 'cage'
     OR v->>'engineRuleVersion' <> 'nexus-cage-2026-09-16' THEN
    RAISE EXCEPTION 'CAGE persist response drift: %',v;
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_instrument_administrations
    WHERE request_id='16000000-0000-4000-8000-000000000001'
      AND instrument_key='cage'
      AND engine_rule_key='nexus.cage'
      AND engine_rule_version='nexus-cage-2026-09-16'
      AND total_score=2 AND max_score=4
      AND jsonb_array_length(safety_signals)=0
      AND answers_snapshot->>'q1'='1'
      AND answers_snapshot->>'q4'='0'
  ) THEN RAISE EXCEPTION 'CAGE persisted snapshot missing'; END IF;
END $$;

-- Browser/Edge cannot forge the version frozen in the neutral catalog.
SET ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.record_clinician_assisted_clinical_instrument(
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000501','cage',
      '16000000-0000-4000-8000-000000000002',
      '{"q1":1,"q2":1,"q3":0,"q4":0}'::jsonb,
      public.test_cai_cage_result() || '{"engineRuleVersion":"forged"}'::jsonb,
      '[]'::jsonb
    );
    RAISE EXCEPTION 'CAGE forged engine contract escaped';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_administration_engine_contract_mismatch%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- Disabling the clinic setting revokes future Apply Now authorization.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','cage',false
  );
  IF v <> 'OK' THEN RAISE EXCEPTION 'CAGE owner disable failed: %',v; END IF;
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','cage'
  ) THEN RAISE EXCEPTION 'CAGE disabled setting still authorized'; END IF;
END $$;
RESET ROLE;

\echo 'CAGE_CLINICIAN_ASSISTED_V1_BEHAVIOR_OK'
