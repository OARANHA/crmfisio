-- VERIFY — Neutral Clinician-Assisted Instrument History V1
-- Production-safe: metadata only, no fixtures and no mutating RPC calls.

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';

DO $$
DECLARE
  v_proc regprocedure := to_regprocedure('public.list_patient_clinician_assisted_instrument_history(uuid)');
  v_src text;
  v_result text;
  v_security boolean;
  v_volatility "char";
  v_config text[];
BEGIN
  IF v_proc IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_history_rpc_missing';
  END IF;

  SELECT pg_get_functiondef(v_proc), pg_get_function_result(v_proc), p.prosecdef, p.provolatile, p.proconfig
  INTO v_src, v_result, v_security, v_volatility, v_config
  FROM pg_proc p
  WHERE p.oid = v_proc;

  IF v_security IS NOT TRUE OR v_volatility <> 's' THEN
    RAISE EXCEPTION 'clinical_instrument_history_rpc_execution_contract_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(v_config, ARRAY[]::text[])) cfg
    WHERE replace(cfg, ' ', '') = 'search_path=public,pg_temp'
  ) THEN
    RAISE EXCEPTION 'clinical_instrument_history_search_path_invalid';
  END IF;
  IF position('can_access_patient_clinical_record' IN v_src) = 0
     OR position('current_clinic_id' IN v_src) = 0
     OR position('clinical_instrument_administrations' IN v_src) = 0
     OR position('clinician_assisted' IN v_src) = 0 THEN
    RAISE EXCEPTION 'clinical_instrument_history_read_boundary_drift';
  END IF;

  IF position('answers_snapshot' IN v_src) > 0
     OR position('output_snapshot' IN v_src) > 0
     OR position('evidence_snapshot' IN v_src) > 0
     OR position('soap_text' IN v_src) > 0
     OR position('nexus_clinical_results' IN v_src) > 0
     OR position('nexus.access' IN v_src) > 0
     OR position('clinical.instrument.apply' IN v_src) > 0 THEN
    RAISE EXCEPTION 'clinical_instrument_history_projection_leak';
  END IF;

  IF position('id uuid' IN v_result) = 0
     OR position('appointment_id uuid' IN v_result) = 0
     OR position('professional_id uuid' IN v_result) = 0
     OR position('instrument_key text' IN v_result) = 0
     OR position('engine_rule_version text' IN v_result) = 0
     OR position('has_safety_signal boolean' IN v_result) = 0
     OR position('has_critical_safety_signal boolean' IN v_result) = 0
     OR position('completed_at timestamp with time zone' IN v_result) = 0 THEN
    RAISE EXCEPTION 'clinical_instrument_history_projection_shape_invalid: %', v_result;
  END IF;

  IF position('patient_id' IN v_result) > 0
     OR position('clinic_id' IN v_result) > 0
     OR position('answers_snapshot' IN v_result) > 0
     OR position('output_snapshot' IN v_result) > 0 THEN
    RAISE EXCEPTION 'clinical_instrument_history_projection_shape_leak';
  END IF;
END;
$$;
DO $$
BEGIN
  IF NOT has_function_privilege(
       'authenticated',
       'public.list_patient_clinician_assisted_instrument_history(uuid)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'service_role',
       'public.list_patient_clinician_assisted_instrument_history(uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public.list_patient_clinician_assisted_instrument_history(uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'clinical_instrument_history_rpc_acl_invalid';
  END IF;

  IF has_table_privilege('authenticated','public.clinical_instrument_administrations','SELECT')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','INSERT')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','UPDATE')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','DELETE')
     OR NOT has_table_privilege('service_role','public.clinical_instrument_administrations','SELECT') THEN
    RAISE EXCEPTION 'clinical_instrument_history_ledger_acl_regressed';
  END IF;
END;
$$;

SELECT 'VERIFY CLINICIAN-ASSISTED INSTRUMENT HISTORY V1 PRODUCTION OK' AS result;
ROLLBACK;
