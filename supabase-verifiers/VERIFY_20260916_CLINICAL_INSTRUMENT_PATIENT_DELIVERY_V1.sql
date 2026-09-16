-- VERIFY — Clinical Instrument Patient Delivery V1
-- Production-safe: metadata/catalog reads only; no fixture or clinical mutation.

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';

DO $$
BEGIN
  IF to_regclass('public.clinical_instrument_patient_self_contracts') IS NULL
     OR to_regclass('public.nexus_self_assessment_invites') IS NULL
     OR to_regclass('public.clinical_instrument_administrations') IS NULL THEN
    RAISE EXCEPTION 'patient_delivery_v1_table_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.oid='public.clinical_instrument_patient_self_contracts'::regclass
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'patient_delivery_v1_registry_rls_missing';
  END IF;

  IF has_table_privilege('authenticated','public.clinical_instrument_patient_self_contracts','SELECT')
     OR has_table_privilege('anon','public.clinical_instrument_patient_self_contracts','SELECT')
     OR NOT has_table_privilege('service_role','public.clinical_instrument_patient_self_contracts','SELECT') THEN
    RAISE EXCEPTION 'patient_delivery_v1_registry_acl_invalid';
  END IF;
END;
$$;
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO v_def
  FROM pg_constraint c
  WHERE c.conrelid='public.wa_logs'::regclass
    AND c.conname='wa_logs_template_check'
    AND c.contype='c';

  IF v_def IS NULL
     OR position('clinical_instrument_patient_self' IN v_def)=0
     OR position('nexus_autoavaliacao' IN v_def)=0
     OR position('confirmacao' IN v_def)=0 THEN
    RAISE EXCEPTION 'patient_delivery_v1_wa_template_constraint_invalid';
  END IF;
END;
$$;
DO $$
DECLARE
  v_key text;
BEGIN
  FOREACH v_key IN ARRAY ARRAY['phq9','gad7'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.clinical_instrument_patient_self_contracts d
      JOIN public.clinical_instrument_catalog c
        ON c.instrument_key=d.instrument_key
       AND c.engine_source=d.engine_source
       AND c.engine_module_key=d.engine_module_key
       AND c.engine_tool_key=d.engine_tool_key
       AND c.engine_rule_key=d.engine_rule_key
       AND c.engine_rule_version=d.engine_rule_version
      WHERE d.instrument_key=v_key
        AND d.active IS TRUE
        AND c.active IS TRUE
    ) THEN
      RAISE EXCEPTION 'patient_delivery_v1_seed_contract_missing: %', v_key;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='nexus_self_assessment_invites'
      AND policyname='nexus_self_assessment_authority_read_guard'
      AND permissive='RESTRICTIVE'
      AND qual ILIKE '%authority_source%nexus%'
  ) THEN
    RAISE EXCEPTION 'patient_delivery_v1_raw_invite_guard_missing';
  END IF;
END;
$$;
DO $$
DECLARE
  v_name text;
  v_sig regprocedure;
  v_src text;
  v_security boolean;
  v_volatility "char";
  v_config text[];
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'public.can_send_clinical_instrument_to_patient(uuid,text)',
    'public.list_available_clinical_instrument_patient_delivery(uuid)',
    'public.list_clinical_instrument_patient_deliveries(uuid)',
    'public.enqueue_clinical_instrument_patient_delivery(uuid,uuid,text,uuid,integer,text)',
    'public.claim_clinical_instrument_patient_invites(text,integer)',
    'public.complete_clinical_instrument_patient_self_processing(uuid,jsonb,jsonb)',
    'public.list_patient_clinical_instrument_history(uuid)'
  ] LOOP
    v_sig := to_regprocedure(v_name);
    IF v_sig IS NULL THEN
      RAISE EXCEPTION 'patient_delivery_v1_function_missing: %', v_name;
    END IF;
    SELECT pg_get_functiondef(p.oid), p.prosecdef, p.provolatile, p.proconfig
      INTO v_src, v_security, v_volatility, v_config
    FROM pg_proc p WHERE p.oid=v_sig;
    IF v_security IS NOT TRUE THEN
      RAISE EXCEPTION 'patient_delivery_v1_security_definer_missing: %', v_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(v_config,ARRAY[]::text[])) cfg
      WHERE replace(cfg,' ','') LIKE 'search_path=public%'
    ) THEN
      RAISE EXCEPTION 'patient_delivery_v1_search_path_invalid: %', v_name;
    END IF;
  END LOOP;
END;
$$;
DO $$
DECLARE
  v_send text := pg_get_functiondef('public.can_send_clinical_instrument_to_patient(uuid,text)'::regprocedure);
  v_enqueue text := pg_get_functiondef('public.enqueue_clinical_instrument_patient_delivery(uuid,uuid,text,uuid,integer,text)'::regprocedure);
  v_legacy_claim text := pg_get_functiondef('public.claim_nexus_self_assessment_invites(text,text,integer)'::regprocedure);
  v_neutral_claim text := pg_get_functiondef('public.claim_clinical_instrument_patient_invites(text,integer)'::regprocedure);
  v_complete text := pg_get_functiondef('public.complete_clinical_instrument_patient_self_processing(uuid,jsonb,jsonb)'::regprocedure);
  v_history text := pg_get_functiondef('public.list_patient_clinical_instrument_history(uuid)'::regprocedure);
  v_status text := pg_get_functiondef('public.list_clinical_instrument_patient_deliveries(uuid)'::regprocedure);
BEGIN
  IF position('clinical_instrument_base_authorized' IN v_send)=0
     OR position('clinical_instrument_patient_self_contracts' IN v_send)=0
     OR position('professional_id = v_uid' IN v_send)=0
     OR position('em_atendimento' IN v_send)=0
     OR position('nexus.scales' IN v_send)>0
     OR position('nexus.access' IN v_send)>0 THEN
    RAISE EXCEPTION 'patient_delivery_v1_send_boundary_drift';
  END IF;

  IF position('can_send_clinical_instrument_to_patient' IN v_enqueue)=0
     OR position('wa_logs' IN v_enqueue)=0
     OR position('authority_source' IN v_enqueue)=0
     OR position('clinical_instrument' IN v_enqueue)=0 THEN
    RAISE EXCEPTION 'patient_delivery_v1_enqueue_contract_drift';
  END IF;

  IF position('authority_source = ''nexus''' IN v_legacy_claim)=0
     OR position('authority_source = ''clinical_instrument''' IN v_neutral_claim)=0 THEN
    RAISE EXCEPTION 'patient_delivery_v1_worker_authority_split_missing';
  END IF;
END;
$$;
DO $$
DECLARE
  v_complete text := pg_get_functiondef('public.complete_clinical_instrument_patient_self_processing(uuid,jsonb,jsonb)'::regprocedure);
  v_history text := pg_get_functiondef('public.list_patient_clinical_instrument_history(uuid)'::regprocedure);
  v_status text := pg_get_functiondef('public.list_clinical_instrument_patient_deliveries(uuid)'::regprocedure);
BEGIN
  IF position('clinical_instrument_administrations' IN v_complete)=0
     OR position('patient_self' IN v_complete)=0
     OR position('processed_administration_id' IN v_complete)=0
     OR position('nexus_clinical_results' IN v_complete)>0
     OR position('can_send_clinical_instrument_to_patient' IN v_complete)>0 THEN
    RAISE EXCEPTION 'patient_delivery_v1_completion_contract_drift';
  END IF;

  IF position('can_access_patient_clinical_record' IN v_history)=0
     OR position('patient_self' IN v_history)=0
     OR position('clinician_assisted' IN v_history)=0
     OR position('answers_snapshot' IN v_history)>0
     OR position('output_snapshot' IN v_history)>0
     OR position('evidence_snapshot' IN v_history)>0
     OR position('soap_text' IN v_history)>0 THEN
    RAISE EXCEPTION 'patient_delivery_v1_history_projection_drift';
  END IF;

  IF position('professional_id = v_uid' IN v_status)=0
     OR position('authority_source = ''clinical_instrument''' IN v_status)=0
     OR position('token_hash' IN v_status)>0
     OR position('response_snapshot' IN v_status)>0
     OR position('mensagem' IN v_status)>0 THEN
    RAISE EXCEPTION 'patient_delivery_v1_status_projection_drift';
  END IF;
END;
$$;
DO $$
BEGIN
  IF NOT has_function_privilege('authenticated','public.can_send_clinical_instrument_to_patient(uuid,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.list_available_clinical_instrument_patient_delivery(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.list_clinical_instrument_patient_deliveries(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.list_patient_clinical_instrument_history(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.can_send_clinical_instrument_to_patient(uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.enqueue_clinical_instrument_patient_delivery(uuid,uuid,text,uuid,integer,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.claim_clinical_instrument_patient_invites(text,integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.complete_clinical_instrument_patient_self_processing(uuid,jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'patient_delivery_v1_function_acl_invalid';
  END IF;

  IF NOT has_function_privilege('service_role','public.enqueue_clinical_instrument_patient_delivery(uuid,uuid,text,uuid,integer,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.claim_clinical_instrument_patient_invites(text,integer)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.complete_clinical_instrument_patient_self_processing(uuid,jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'patient_delivery_v1_service_acl_missing';
  END IF;
END;
$$;

SELECT 'VERIFY CLINICAL INSTRUMENT PATIENT DELIVERY V1 PRODUCTION OK' AS result;
ROLLBACK;
