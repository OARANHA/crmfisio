-- PHQ-15 Clinician-Assisted V1 — disposable PostgreSQL 16 cases.

CREATE OR REPLACE FUNCTION public.test_cai_phq15_result()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'engineSource','nexus','engineModuleKey','scales','engineToolKey','phq15',
    'engineRuleKey','nexus.phq15','engineRuleVersion','nexus-phq15-2026-09-13',
    'outputSnapshot',jsonb_build_object(
      'answersArray',jsonb_build_array(1,1,1,1,1,1,1,1,1,1,1,1,1,1,1),
      'clinicianAssisted',true,'guidanceMode','clinician-review'
    ),
    'totalScore',15,'maxScore',30,
    'classification','Faixa alta de sintomas somáticos','severity','high',
    'interpretation','Resultado PHQ-15 para revisão clínica.',
    'soapText','PHQ-15: 15/30 pts','evidenceSnapshot','[]'::jsonb
  )
$$;
GRANT EXECUTE ON FUNCTION public.test_cai_phq15_result() TO service_role;

-- Missing clinic setting remains deny-by-default after catalog installation.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','phq15'
  ) THEN RAISE EXCEPTION 'PHQ15 default-deny escaped'; END IF;
END $$;
RESET ROLE;
-- Owner/admin configuration remains the only clinic-level enablement path.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','phq15',true
  );
  IF v <> 'OK' THEN RAISE EXCEPTION 'PHQ15 owner enable failed: %',v; END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$ BEGIN
  IF NOT public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','phq15'
  ) THEN RAISE EXCEPTION 'PHQ15 authorized active encounter denied'; END IF;
END $$;
RESET ROLE;

-- Persist one canonical PHQ-15 snapshot through the unchanged service-only writer.
SET ROLE service_role;
DO $$ DECLARE v jsonb; BEGIN
  v := public.record_clinician_assisted_clinical_instrument(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','phq15',
    '15000000-0000-4000-8000-000000000001',
    '{"q1":1,"q2":1,"q3":1,"q4":1,"q5":1,"q6":1,"q7":1,"q8":1,"q9":1,"q10":1,"q11":1,"q12":1,"q13":1,"q14":1,"q15":1}'::jsonb,
    public.test_cai_phq15_result(),'[]'::jsonb
  );
  IF v->>'replayed' <> 'false' OR v->>'instrumentKey' <> 'phq15'
     OR v->>'engineRuleVersion' <> 'nexus-phq15-2026-09-13' THEN
    RAISE EXCEPTION 'PHQ15 persist response drift: %',v;
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_instrument_administrations
    WHERE request_id='15000000-0000-4000-8000-000000000001'
      AND instrument_key='phq15'
      AND engine_rule_key='nexus.phq15'
      AND engine_rule_version='nexus-phq15-2026-09-13'
      AND total_score=15 AND max_score=30
      AND jsonb_array_length(safety_signals)=0
      AND answers_snapshot->>'q15'='1'
  ) THEN RAISE EXCEPTION 'PHQ15 persisted snapshot missing'; END IF;
END $$;

-- Browser/Edge cannot forge the engine version bound by the neutral catalog.
SET ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.record_clinician_assisted_clinical_instrument(
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000501','phq15',
      '15000000-0000-4000-8000-000000000002',
      '{"q1":0}'::jsonb,
      public.test_cai_phq15_result() || '{"engineRuleVersion":"forged"}'::jsonb,
      '[]'::jsonb
    );
    RAISE EXCEPTION 'PHQ15 forged engine contract escaped';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_administration_engine_contract_mismatch%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- Disabling the clinic setting revokes future Apply Now authorization.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','phq15',false
  );
  IF v <> 'OK' THEN RAISE EXCEPTION 'PHQ15 owner disable failed: %',v; END IF;
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','phq15'
  ) THEN RAISE EXCEPTION 'PHQ15 disabled setting still authorized'; END IF;
END $$;
RESET ROLE;

\echo 'PHQ15_CLINICIAN_ASSISTED_V1_BEHAVIOR_OK'
