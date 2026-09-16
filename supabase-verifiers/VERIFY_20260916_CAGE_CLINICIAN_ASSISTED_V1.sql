-- MedicsPro — CAGE Clinician-Assisted V1 installed-contract verifier.
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

\echo 'VERIFY CAGE clinician-assisted V1'

DO $$
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'cage_v1_verifier_not_read_only';
  END IF;
  IF current_setting('server_version_num')::integer < 160000 THEN
    RAISE EXCEPTION 'cage_v1_postgresql_16_required';
  END IF;
  IF to_regclass('public.nexus_result_contracts') IS NULL
     OR to_regclass('public.clinical_instrument_catalog') IS NULL
     OR to_regclass('public.clinic_clinical_instrument_settings') IS NULL THEN
    RAISE EXCEPTION 'cage_v1_prerequisite_missing';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.nexus_result_contracts
    WHERE module_key='scales' AND tool_key='cage'
      AND rule_key='nexus.cage'
      AND rule_version='nexus-cage-2026-09-16'
      AND required_capability='nexus.scales'
  ) THEN RAISE EXCEPTION 'cage_v1_nexus_contract_missing'; END IF;

  IF public.resolve_nexus_result_required_capability(
       'scales','cage','nexus.cage','nexus-cage-2026-09-16'
     ) IS DISTINCT FROM 'nexus.scales' THEN
    RAISE EXCEPTION 'cage_v1_resolver_drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_instrument_catalog
    WHERE instrument_key='cage'
      AND engine_source='nexus'
      AND engine_module_key='scales'
      AND engine_tool_key='cage'
      AND engine_rule_key='nexus.cage'
      AND engine_rule_version='nexus-cage-2026-09-16'
      AND active IS TRUE
  ) THEN RAISE EXCEPTION 'cage_v1_neutral_catalog_missing'; END IF;
END;
$$;

DO $$
DECLARE v_src text; v_default text;
BEGIN
  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='clinic_clinical_instrument_settings'
    AND column_name='enabled';
  IF v_default IS NULL OR lower(v_default) NOT IN ('false', 'false::boolean') THEN
    RAISE EXCEPTION 'cage_v1_setting_default_not_deny';
  END IF;

  SELECT pg_get_functiondef('public.clinical_instrument_base_authorized(uuid,text)'::regprocedure)
    INTO v_src;
  IF position('clinic_clinical_instrument_settings' in v_src)=0
     OR position('s.enabled IS TRUE' in v_src)=0
     OR position('clinical.instrument.apply' in v_src)=0
     OR position('''nexus.scales''' in v_src)>0 THEN
    RAISE EXCEPTION 'cage_v1_neutral_authorization_drift';
  END IF;

  SELECT pg_get_functiondef('public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure)
    INTO v_src;
  IF position('can_apply_clinical_instrument_in_encounter' in v_src)=0
     OR position('clinical_instrument_catalog' in v_src)=0
     OR position('''nexus.scales''' in v_src)>0
     OR position('professional_type' in v_src)>0
     OR position('current_app_role' in v_src)>0 THEN
    RAISE EXCEPTION 'cage_v1_writer_authorization_drift';
  END IF;
END;
$$;

DO $$
DECLARE v_has_patient_self boolean := false;
BEGIN
  IF to_regclass('public.clinical_instrument_patient_self_contracts') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.clinical_instrument_patient_self_contracts WHERE instrument_key=$1)'
      INTO v_has_patient_self USING 'cage';
  END IF;
  IF v_has_patient_self THEN
    RAISE EXCEPTION 'cage_v1_patient_self_surface_widened';
  END IF;
END;
$$;

\echo 'CAGE CLINICIAN ASSISTED V1 VERIFY PASSED'
ROLLBACK;
