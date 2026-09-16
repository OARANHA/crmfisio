-- PCL-5 Clinician-Assisted V1 — disposable PostgreSQL cases.

CREATE OR REPLACE FUNCTION public.test_cai_pcl5_result()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'engineSource','nexus','engineModuleKey','scales','engineToolKey','pcl5',
    'engineRuleKey','nexus.pcl5','engineRuleVersion','nexus-pcl5-br-2026-09-16',
    'outputSnapshot',jsonb_build_object(
      'answersArray',jsonb_build_array(2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0,0),
      'clinicianAssisted',true,'guidanceMode','clinician-review'
    ),
    'totalScore',36,'maxScore',80,
    'classification','Rastreio positivo pelo corte brasileiro PCL-5 ≥ 36','severity','moderate',
    'interpretation','Resultado PCL-5 para revisão clínica; não estabelece diagnóstico.',
    'soapText','PCL-5: 36/80 pts','evidenceSnapshot','[]'::jsonb
  )
$$;
GRANT EXECUTE ON FUNCTION public.test_cai_pcl5_result() TO service_role;

SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501','pcl5')
  THEN RAISE EXCEPTION 'PCL5 default-deny escaped'; END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set('00000000-0000-0000-0000-000000000104','pcl5',true);
  IF v <> 'OK' THEN RAISE EXCEPTION 'PCL5 owner enable failed: %',v; END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$ BEGIN
  IF NOT public.test_ci399_can('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501','pcl5')
  THEN RAISE EXCEPTION 'PCL5 authorized active encounter denied'; END IF;
END $$;
RESET ROLE;

SET ROLE service_role;
DO $$ DECLARE v jsonb; BEGIN
  v := public.record_clinician_assisted_clinical_instrument(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','pcl5',
    '17000000-0000-4000-8000-000000000001',
    '{"q1":2,"q2":2,"q3":2,"q4":2,"q5":2,"q6":2,"q7":2,"q8":2,"q9":2,"q10":2,"q11":2,"q12":2,"q13":2,"q14":2,"q15":2,"q16":2,"q17":2,"q18":2,"q19":0,"q20":0}'::jsonb, public.test_cai_pcl5_result(),'[]'::jsonb
  );
  IF v->>'replayed' <> 'false' OR v->>'instrumentKey' <> 'pcl5'
     OR v->>'engineRuleVersion' <> 'nexus-pcl5-br-2026-09-16' THEN
    RAISE EXCEPTION 'PCL5 persist response drift: %',v;
  END IF;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clinical_instrument_administrations
    WHERE request_id='17000000-0000-4000-8000-000000000001'
      AND instrument_key='pcl5' AND engine_rule_key='nexus.pcl5'
      AND engine_rule_version='nexus-pcl5-br-2026-09-16'
      AND total_score=36 AND max_score=80 AND jsonb_array_length(safety_signals)=0
      AND answers_snapshot->>'q1'='2' AND answers_snapshot->>'q20'='0'
  ) THEN RAISE EXCEPTION 'PCL5 persisted snapshot missing'; END IF;
END $$;

SET ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.record_clinician_assisted_clinical_instrument(
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000501','pcl5',
      '17000000-0000-4000-8000-000000000002',
      '{"q1":2,"q2":2,"q3":2,"q4":2,"q5":2,"q6":2,"q7":2,"q8":2,"q9":2,"q10":2,"q11":2,"q12":2,"q13":2,"q14":2,"q15":2,"q16":2,"q17":2,"q18":2,"q19":0,"q20":0}'::jsonb,
      public.test_cai_pcl5_result() || '{"engineRuleVersion":"forged"}'::jsonb, '[]'::jsonb
    );
    RAISE EXCEPTION 'PCL5 forged engine contract escaped';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_administration_engine_contract_mismatch%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set('00000000-0000-0000-0000-000000000104','pcl5',false);
  IF v <> 'OK' THEN RAISE EXCEPTION 'PCL5 owner disable failed: %',v; END IF;
  IF public.test_ci399_can('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501','pcl5')
  THEN RAISE EXCEPTION 'PCL5 disabled setting still authorized'; END IF;
END $$;
RESET ROLE;

\echo 'PCL5_CLINICIAN_ASSISTED_V1_BEHAVIOR_OK'
