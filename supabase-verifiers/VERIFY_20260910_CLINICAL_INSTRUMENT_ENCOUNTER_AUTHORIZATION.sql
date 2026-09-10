-- MedicsPro #399 — read-only installed-contract verifier.
-- Behavioral authorization is exercised separately in the disposable PostgreSQL 16 harness.

BEGIN;
SET TRANSACTION READ ONLY;

\echo 'VERIFY #399 — clinical instrument base + Apply in Encounter authorization'

DO $$
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'ci399_verifier_not_read_only';
  END IF;
  IF current_setting('server_version_num')::integer < 160000 THEN
    RAISE EXCEPTION 'ci399_postgresql_16_required';
  END IF;
END;
$$;

-- 1) Catalog and tenant configuration shape.
DO $$
DECLARE
  v_default text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.capability_catalog
    WHERE capability_key='clinical.instrument.apply'
      AND domain='clinical'
      AND clinical IS TRUE
      AND active IS TRUE
  ) THEN
    RAISE EXCEPTION 'ci399_capability_catalog_missing';
  END IF;

  IF to_regclass('public.clinic_clinical_instrument_settings') IS NULL THEN
    RAISE EXCEPTION 'ci399_settings_table_missing';
  END IF;

  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='clinic_clinical_instrument_settings'
      AND (
        (column_name='clinic_id' AND data_type='uuid' AND is_nullable='NO')
        OR (column_name='instrument_key' AND data_type='text' AND is_nullable='NO')
        OR (column_name='enabled' AND data_type='boolean' AND is_nullable='NO')
        OR (column_name='configured_by' AND data_type='uuid' AND is_nullable='YES')
        OR (column_name='created_at' AND data_type='timestamp with time zone' AND is_nullable='NO')
        OR (column_name='updated_at' AND data_type='timestamp with time zone' AND is_nullable='NO')
      )
  ) <> 6 THEN
    RAISE EXCEPTION 'ci399_settings_column_shape_drift';
  END IF;

  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='clinic_clinical_instrument_settings'
    AND column_name='enabled';
  IF lower(coalesce(v_default,'')) NOT IN ('false','false::boolean') THEN
    RAISE EXCEPTION 'ci399_enabled_default_must_be_false: %',v_default;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid='public.clinic_clinical_instrument_settings'::regclass
      AND c.contype='p'
      AND pg_get_constraintdef(c.oid) LIKE 'PRIMARY KEY (clinic_id, instrument_key)%'
  ) THEN
    RAISE EXCEPTION 'ci399_settings_primary_key_missing';
  END IF;
END;
$$;

-- 2) Configuration RLS/ACL: browser reads tenant-scoped settings but writes only via RPC.
DO $$
DECLARE
  v_qual text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid='public.clinic_clinical_instrument_settings'::regclass
      AND relrowsecurity IS TRUE
  ) THEN
    RAISE EXCEPTION 'ci399_settings_rls_disabled';
  END IF;

  SELECT regexp_replace(
           replace(coalesce(qual,''),'public.',''),
           '[[:space:]()]','','g'
         )
    INTO v_qual
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='clinic_clinical_instrument_settings'
    AND policyname='clinic_clinical_instrument_settings_read'
    AND cmd='SELECT'
    AND roles=ARRAY['authenticated']::name[];

  IF v_qual IS NULL
     OR position('clinic_id=current_clinic_id' in v_qual)=0
     OR position('current_app_role' in v_qual)=0 THEN
    RAISE EXCEPTION 'ci399_settings_read_policy_drift: %',v_qual;
  END IF;

  IF NOT has_table_privilege('authenticated','public.clinic_clinical_instrument_settings','SELECT')
     OR has_table_privilege('authenticated','public.clinic_clinical_instrument_settings','INSERT')
     OR has_table_privilege('authenticated','public.clinic_clinical_instrument_settings','UPDATE')
     OR has_table_privilege('authenticated','public.clinic_clinical_instrument_settings','DELETE')
     OR has_table_privilege('anon','public.clinic_clinical_instrument_settings','SELECT')
     OR has_table_privilege('anon','public.clinic_clinical_instrument_settings','INSERT')
     OR has_table_privilege('anon','public.clinic_clinical_instrument_settings','UPDATE')
     OR has_table_privilege('anon','public.clinic_clinical_instrument_settings','DELETE') THEN
    RAISE EXCEPTION 'ci399_settings_acl_drift';
  END IF;
END;
$$;

-- 3) Setting validation and the only browser configuration writer.
DO $$
DECLARE
  p record;
  v_src text;
BEGIN
  SELECT * INTO p FROM pg_proc
  WHERE oid='public.validate_clinic_clinical_instrument_setting()'::regprocedure;
  IF NOT FOUND OR NOT p.prosecdef
     OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, pg_temp'],false)
     OR has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'ci399_setting_validator_contract_drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.clinic_clinical_instrument_settings'::regclass
      AND t.tgname='trg_validate_clinic_clinical_instrument_setting'
      AND NOT t.tgisinternal
      AND t.tgenabled='O'
      AND t.tgfoid='public.validate_clinic_clinical_instrument_setting()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'ci399_setting_validator_trigger_missing';
  END IF;

  SELECT * INTO p FROM pg_proc
  WHERE oid='public.set_clinic_clinical_instrument_enabled(text,boolean)'::regprocedure;
  IF NOT FOUND OR NOT p.prosecdef
     OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, pg_temp'],false)
     OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'ci399_setting_rpc_acl_drift';
  END IF;
  v_src := pg_get_functiondef(p.oid);
  IF position('current_clinic_id()' in v_src)=0
     OR position('current_app_role()' in v_src)=0
     OR position('v_role NOT IN (''owner'', ''admin'')' in v_src)=0
     OR position('nexus_result_contracts' in v_src)=0
     OR position('module_key = ''scales''' in v_src)=0 THEN
    RAISE EXCEPTION 'ci399_setting_rpc_source_drift';
  END IF;
END;
$$;

-- 4) Base authorization is internal and neutral; it cannot be mistaken for a
-- browser-callable universal Instrument Delivery permission.
DO $$
DECLARE
  p record;
  v_src text;
BEGIN
  SELECT * INTO p FROM pg_proc
  WHERE oid='public.clinical_instrument_base_authorized(uuid,text)'::regprocedure;
  IF NOT FOUND OR NOT p.prosecdef OR p.provolatile <> 's'
     OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, pg_temp'],false)
     OR has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'ci399_base_helper_acl_or_shape_drift';
  END IF;

  v_src := pg_get_functiondef(p.oid);
  IF position('current_user_has_valid_clinical_identity() IS NOT TRUE' in v_src)=0
     OR position('current_user_has_clinical_capability(''clinical.instrument.apply'') IS NOT TRUE' in v_src)=0
     OR position('clinic_clinical_instrument_settings' in v_src)=0
     OR position('s.enabled IS TRUE' in v_src)=0
     OR position('p.clinic_id = v_clinic' in v_src)=0
     OR position('nexus_result_contracts' in v_src)=0
     OR position('has_professional_capability' in v_src)>0
     OR position('can_access_patient_clinical_record' in v_src)>0
     OR position('''nexus.scales''' in v_src)>0 THEN
    RAISE EXCEPTION 'ci399_base_helper_source_drift';
  END IF;
END;
$$;

-- 5) Contextual boundary is specifically Apply in active Encounter.
DO $$
DECLARE
  p record;
  v_src text;
BEGIN
  SELECT * INTO p FROM pg_proc
  WHERE oid='public.can_apply_clinical_instrument_in_encounter(uuid,text)'::regprocedure;
  IF NOT FOUND OR NOT p.prosecdef OR p.provolatile <> 's'
     OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, pg_temp'],false)
     OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'ci399_encounter_helper_acl_or_shape_drift';
  END IF;

  v_src := pg_get_functiondef(p.oid);
  IF position('a.professional_id = v_uid' in v_src)=0
     OR position('a.status = ''em_atendimento''' in v_src)=0
     OR position('clinical_instrument_base_authorized' in v_src)=0
     OR position('can_access_patient_clinical_record' in v_src)>0
     OR position('fisio_id' in v_src)>0
     OR position('owner' in lower(v_src))>0
     OR position('admin' in lower(v_src))>0
     OR position('agendado' in v_src)>0
     OR position('confirmado' in v_src)>0 THEN
    RAISE EXCEPTION 'ci399_encounter_helper_source_drift';
  END IF;
END;
$$;

-- 6) PHQ-9/GAD-7 identity/version/scoring provenance remains the existing trusted
-- Nexus contract. The neutral authorization layer does not create replacements.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.nexus_result_contracts
    WHERE module_key='scales' AND tool_key='phq9'
      AND rule_key='nexus.phq9' AND rule_version='nexus-2026-09-03'
      AND required_capability='nexus.scales'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.nexus_result_contracts
    WHERE module_key='scales' AND tool_key='gad7'
      AND rule_key='nexus.gad7' AND rule_version='nexus-2026-09-03'
      AND required_capability='nexus.scales'
  ) THEN
    RAISE EXCEPTION 'ci399_canonical_phq_gad_contract_missing';
  END IF;

  IF to_regclass('public.clinical_instrument_results') IS NOT NULL
     OR to_regclass('public.clinical_instrument_deliveries') IS NOT NULL THEN
    RAISE EXCEPTION 'ci399_unapproved_result_or_delivery_persistence_present';
  END IF;
END;
$$;

\echo 'VERIFY #399 OK — neutral clinical capability + tenant enablement + Apply in Encounter boundary'
ROLLBACK;
