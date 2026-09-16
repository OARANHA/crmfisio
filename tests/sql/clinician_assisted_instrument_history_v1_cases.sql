-- Neutral Clinician-Assisted Instrument History V1 — disposable PostgreSQL 16 cases.
\echo 'Clinician-Assisted Instrument History V1 behavior cases'

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.clinical_instrument_administrations','SELECT')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','INSERT')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','UPDATE')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','DELETE') THEN
    RAISE EXCEPTION 'history V1 reopened direct ledger access';
  END IF;
  IF NOT has_function_privilege(
       'authenticated',
       'public.list_patient_clinician_assisted_instrument_history(uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'history V1 authenticated RPC grant missing';
  END IF;
END $$;
\echo '1) browser reads only through the neutral RPC — PASS'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',false);
DO $$
DECLARE
  v_count integer;
  v_json jsonb;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.list_patient_clinician_assisted_instrument_history(
    '00000000-0000-0000-0000-000000000301'
  );
  IF v_count <> 2 THEN RAISE EXCEPTION 'expected 2 history rows, got %', v_count; END IF;

  SELECT to_jsonb(h) INTO v_json
  FROM public.list_patient_clinician_assisted_instrument_history(
    '00000000-0000-0000-0000-000000000301'
  ) h
  ORDER BY h.completed_at DESC LIMIT 1;
  IF v_json ? 'patient_id' OR v_json ? 'clinic_id'
     OR v_json ? 'answers_snapshot' OR v_json ? 'output_snapshot'
     OR v_json ? 'evidence_snapshot' OR v_json ? 'soap_text'
     OR v_json ? 'safety_signals' THEN
    RAISE EXCEPTION 'neutral history projection leaked raw ledger payload: %', v_json;
  END IF;

  IF NOT (v_json ? 'instrument_key')
     OR NOT (v_json ? 'engine_rule_version')
     OR NOT (v_json ? 'total_score')
     OR NOT (v_json ? 'classification')
     OR NOT (v_json ? 'has_safety_signal')
     OR NOT (v_json ? 'has_critical_safety_signal') THEN
    RAISE EXCEPTION 'neutral history projection incomplete: %', v_json;
  END IF;
END $$;
RESET ROLE;
\echo '2) chart reader sees neutral longitudinal summaries without raw snapshots — PASS'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}',false);
DO $$
DECLARE
  v_count integer;
BEGIN
  IF public.current_user_has_clinical_capability('clinical.timeline.read') IS NOT TRUE THEN
    RAISE EXCEPTION 'fixture professional 102 should have timeline read';
  END IF;
  IF public.current_user_has_clinical_capability('clinical.instrument.apply') IS TRUE THEN
    RAISE EXCEPTION 'fixture professional 102 unexpectedly has instrument apply';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.list_patient_clinician_assisted_instrument_history(
    '00000000-0000-0000-0000-000000000301'
  );
  IF v_count <> 2 THEN RAISE EXCEPTION 'timeline-only reader expected 2 rows, got %', v_count; END IF;
END $$;
RESET ROLE;
\echo '3) timeline read is independent from instrument apply — PASS'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000104',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000104","role":"authenticated"}',false);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.list_patient_clinician_assisted_instrument_history(
    '00000000-0000-0000-0000-000000000301'
  );
  IF v_count <> 2 THEN RAISE EXCEPTION 'owner chart reader expected 2 rows, got %', v_count; END IF;
END $$;
RESET ROLE;
\echo '4) canonical manager chart-read behavior is preserved — PASS'

CREATE OR REPLACE FUNCTION public.test_instrument_history_denied(p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_actor::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',p_actor::text,'role','authenticated')::text, true);
  BEGIN
    PERFORM * FROM public.list_patient_clinician_assisted_instrument_history(
      '00000000-0000-0000-0000-000000000301'
    );
    RAISE EXCEPTION 'unauthorized actor escaped history boundary: %', p_actor;
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_history_not_authorized%' THEN RAISE; END IF;
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.test_instrument_history_denied(uuid) TO authenticated;

SET ROLE authenticated;
SELECT public.test_instrument_history_denied('00000000-0000-0000-0000-000000000107');
SELECT public.test_instrument_history_denied('00000000-0000-0000-0000-000000000108');
SELECT public.test_instrument_history_denied('00000000-0000-0000-0000-000000000201');
RESET ROLE;
\echo '5) reception, finance and cross-tenant actors are denied — PASS'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_patient_clinician_assisted_instrument_history(
      '00000000-0000-0000-0000-000000000401'
    );
    RAISE EXCEPTION 'cross-tenant patient escaped history boundary';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_history_not_authorized%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
\echo '6) same actor cannot read a patient from another tenant — PASS'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_patient_clinician_assisted_instrument_history(NULL);
    RAISE EXCEPTION 'NULL patient escaped validation';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'clinical_instrument_history_patient_required%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
\echo '7) null patient id fails explicitly — PASS'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',false);
DO $$
DECLARE
  v_any boolean;
  v_critical boolean;
BEGIN
  SELECT bool_or(has_safety_signal), bool_or(has_critical_safety_signal)
  INTO v_any, v_critical
  FROM public.list_patient_clinician_assisted_instrument_history(
    '00000000-0000-0000-0000-000000000301'
  );
  IF v_any IS NOT TRUE OR v_critical IS NOT TRUE THEN
    RAISE EXCEPTION 'safety summary flags were not preserved';
  END IF;
END $$;
RESET ROLE;
\echo '8) safety context is projected only as neutral boolean flags — PASS'

DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(
    'public.list_patient_clinician_assisted_instrument_history(uuid)'::regprocedure
  ) INTO v_src;
  IF position('nexus.access' IN v_src) > 0
     OR position('clinical.instrument.apply' IN v_src) > 0
     OR position('answers_snapshot' IN v_src) > 0
     OR position('output_snapshot' IN v_src) > 0
     OR position('evidence_snapshot' IN v_src) > 0
     OR position('soap_text' IN v_src) > 0 THEN
    RAISE EXCEPTION 'history RPC drifted into engine/apply/raw-ledger authority';
  END IF;
END $$;
\echo '9) history is neutral from Nexus/apply/raw-ledger authority — PASS'

\echo 'CLINICIAN_ASSISTED_INSTRUMENT_HISTORY_V1_BEHAVIOR_OK'
