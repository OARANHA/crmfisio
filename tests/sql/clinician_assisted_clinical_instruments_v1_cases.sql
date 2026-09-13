-- Clinician-Assisted Administration V1 — disposable PostgreSQL 16 cases.

CREATE OR REPLACE FUNCTION public.test_cai_phq9_result()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'engineSource','nexus','engineModuleKey','scales','engineToolKey','phq9',
    'engineRuleKey','nexus.phq9','engineRuleVersion','nexus-2026-09-03',
    'outputSnapshot',jsonb_build_object('answersArray',jsonb_build_array(1,1,1,1,1,1,1,1,1),'clinicianAssisted',true,'guidanceMode','clinician-review'),
    'totalScore',9,'maxScore',27,'classification','Faixa leve de sintomas depressivos',
    'severity','low','interpretation','Resultado de rastreio para revisão clínica.',
    'soapText','PHQ-9: 9/27 pts','evidenceSnapshot','[]'::jsonb
  )
$$;
CREATE OR REPLACE FUNCTION public.test_cai_phq9_safety()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_array(jsonb_build_object(
    'flagCode','phq9.item9.positive','severity','critical','title','PHQ-9 item 9 positivo',
    'message','Resposta positiva no item 9.','requiredAction','Realizar avaliação clínica de segurança e risco.'
  ))
$$;
GRANT EXECUTE ON FUNCTION public.test_cai_phq9_result(), public.test_cai_phq9_safety() TO service_role;

DO $$ BEGIN
  IF has_table_privilege('authenticated','public.clinical_instrument_administrations','SELECT')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','INSERT')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','UPDATE')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','DELETE')
     OR has_function_privilege('authenticated','public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure,'EXECUTE')
     OR has_function_privilege('anon','public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('service_role','public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'CAI ACL drift';
  END IF;
END $$;

-- Authorized physician + #399 capability + enabled PHQ-9 + own active Encounter.
SET ROLE service_role;
DO $$ DECLARE v jsonb; BEGIN
  v := public.record_clinician_assisted_clinical_instrument(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501','phq9',
    '10000000-0000-4000-8000-000000000001',
    '{"q1":1,"q2":1,"q3":1,"q4":1,"q5":1,"q6":1,"q7":1,"q8":1,"q9":1}'::jsonb,
    public.test_cai_phq9_result(),public.test_cai_phq9_safety());
  IF v->>'replayed' <> 'false' OR v->>'provenance' <> 'clinician_assisted'
     OR v->>'patientId' <> '00000000-0000-0000-0000-000000000301'
     OR v->>'engineRuleVersion' <> 'nexus-2026-09-03' THEN
    RAISE EXCEPTION 'CAI authorized result drift: %',v;
  END IF;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_instrument_administrations
    WHERE clinic_id='00000000-0000-0000-0000-000000000001'
      AND patient_id='00000000-0000-0000-0000-000000000301'
      AND appointment_id='00000000-0000-0000-0000-000000000501'
      AND professional_id='00000000-0000-0000-0000-000000000101'
      AND instrument_key='phq9' AND provenance='clinician_assisted'
      AND engine_rule_key='nexus.phq9' AND engine_rule_version='nexus-2026-09-03'
      AND total_score=9 AND max_score=27
      AND safety_signals @> '[{"flagCode":"phq9.item9.positive","severity":"critical"}]'::jsonb
  ) THEN RAISE EXCEPTION 'CAI persisted snapshot missing'; END IF;
END $$;

-- Exact retry is idempotent.
SET ROLE service_role;
DO $$ DECLARE v jsonb; v_id uuid; BEGIN
  SELECT id INTO v_id FROM public.clinical_instrument_administrations
   WHERE request_id='10000000-0000-4000-8000-000000000001';
  v := public.record_clinician_assisted_clinical_instrument(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501','phq9',
    '10000000-0000-4000-8000-000000000001',
    '{"q1":1,"q2":1,"q3":1,"q4":1,"q5":1,"q6":1,"q7":1,"q8":1,"q9":1}'::jsonb,
    public.test_cai_phq9_result(),public.test_cai_phq9_safety());
  IF v->>'replayed' <> 'true' OR (v->>'id')::uuid <> v_id THEN RAISE EXCEPTION 'CAI replay failed'; END IF;
END $$;
RESET ROLE;

-- Authorized physiotherapist also succeeds: no nexus.scales grant is involved.
SET ROLE service_role;
DO $$ DECLARE v jsonb; BEGIN
  v := public.record_clinician_assisted_clinical_instrument(
    '00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000502','phq9',
    '10000000-0000-4000-8000-000000000002',
    '{"q1":1,"q2":1,"q3":1,"q4":1,"q5":1,"q6":1,"q7":1,"q8":1,"q9":1}'::jsonb,
    public.test_cai_phq9_result(),public.test_cai_phq9_safety());
  IF v->>'provenance' <> 'clinician_assisted' THEN RAISE EXCEPTION 'CAI multiprofessional apply failed'; END IF;
END $$;
RESET ROLE;

-- Reusing a request id with different answers is a hard conflict.
SET ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.record_clinician_assisted_clinical_instrument(
      '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501','phq9',
      '10000000-0000-4000-8000-000000000001','{"q1":0}'::jsonb,
      public.test_cai_phq9_result(),public.test_cai_phq9_safety());
    RAISE EXCEPTION 'CAI idempotency conflict escaped';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_administration_idempotency_conflict%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- Missing neutral capability, cross-professional, cross-tenant and non-active all deny.
SET ROLE service_role;
DO $$
DECLARE pair record;
BEGIN
  FOR pair IN SELECT * FROM (VALUES
    ('00000000-0000-0000-0000-000000000102'::uuid,'00000000-0000-0000-0000-000000000510'::uuid,'10000000-0000-4000-8000-000000000003'::uuid),
    ('00000000-0000-0000-0000-000000000103'::uuid,'00000000-0000-0000-0000-000000000501'::uuid,'10000000-0000-4000-8000-000000000004'::uuid),
    ('00000000-0000-0000-0000-000000000201'::uuid,'00000000-0000-0000-0000-000000000501'::uuid,'10000000-0000-4000-8000-000000000005'::uuid),
    ('00000000-0000-0000-0000-000000000101'::uuid,'00000000-0000-0000-0000-000000000508'::uuid,'10000000-0000-4000-8000-000000000006'::uuid)
  ) AS x(actor_id,appointment_id,request_id)
  LOOP
    BEGIN
      PERFORM public.record_clinician_assisted_clinical_instrument(
        pair.actor_id,pair.appointment_id,'phq9',pair.request_id,'{"q1":1}'::jsonb,
        public.test_cai_phq9_result(),public.test_cai_phq9_safety());
      RAISE EXCEPTION 'CAI unauthorized scenario escaped: % / %',pair.actor_id,pair.appointment_id;
    EXCEPTION WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE 'clinical_instrument_administration_not_authorized%' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;
RESET ROLE;

-- Caller cannot forge the engine version bound by the neutral catalog.
SET ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.record_clinician_assisted_clinical_instrument(
      '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501','phq9',
      '10000000-0000-4000-8000-000000000007',
      '{"q1":1,"q2":1,"q3":1,"q4":1,"q5":1,"q6":1,"q7":1,"q8":1,"q9":1}'::jsonb,
      public.test_cai_phq9_result() || '{"engineRuleVersion":"forged"}'::jsonb,
      public.test_cai_phq9_safety());
    RAISE EXCEPTION 'CAI forged engine contract escaped';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_administration_engine_contract_mismatch%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- Terminal snapshot: even privileged direct UPDATE/DELETE are blocked.
DO $$ DECLARE v_id uuid; BEGIN
  SELECT id INTO v_id FROM public.clinical_instrument_administrations
   WHERE request_id='10000000-0000-4000-8000-000000000001';
  BEGIN
    UPDATE public.clinical_instrument_administrations SET classification='tampered' WHERE id=v_id;
    RAISE EXCEPTION 'CAI immutable update escaped';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_administration_immutable%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.clinical_instrument_administrations WHERE id=v_id;
    RAISE EXCEPTION 'CAI immutable delete escaped';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_administration_immutable%' THEN RAISE; END IF;
  END;
END $$;

\echo 'CLINICIAN_ASSISTED_INSTRUMENT_V1_BEHAVIOR_OK'
