-- MedicsPro — Clinician-Assisted Administration V1 installed-contract verifier.
BEGIN;
SET TRANSACTION READ ONLY;

\echo 'VERIFY clinician-assisted instruments V1'

DO $$
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'cai_v1_verifier_not_read_only';
  END IF;
  IF current_setting('server_version_num')::integer < 160000 THEN
    RAISE EXCEPTION 'cai_v1_postgresql_16_required';
  END IF;
  IF to_regclass('public.clinical_instrument_administrations') IS NULL THEN
    RAISE EXCEPTION 'cai_v1_table_missing';
  END IF;
  IF to_regprocedure('public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'cai_v1_writer_missing';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid='public.clinical_instrument_administrations'::regclass
      AND relrowsecurity IS TRUE
  ) THEN RAISE EXCEPTION 'cai_v1_rls_disabled'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='clinical_instrument_administrations'
  ) THEN RAISE EXCEPTION 'cai_v1_browser_policy_present'; END IF;

  IF has_table_privilege('authenticated','public.clinical_instrument_administrations','SELECT')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','INSERT')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','UPDATE')
     OR has_table_privilege('authenticated','public.clinical_instrument_administrations','DELETE')
     OR has_table_privilege('anon','public.clinical_instrument_administrations','SELECT')
     OR has_table_privilege('service_role','public.clinical_instrument_administrations','INSERT')
     OR has_table_privilege('service_role','public.clinical_instrument_administrations','UPDATE')
     OR has_table_privilege('service_role','public.clinical_instrument_administrations','DELETE')
     OR NOT has_table_privilege('service_role','public.clinical_instrument_administrations','SELECT') THEN
    RAISE EXCEPTION 'cai_v1_table_acl_drift';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.clinical_instrument_administrations'::regclass
      AND conname='clinical_instrument_administrations_request_unique'
      AND contype='u'
  ) THEN RAISE EXCEPTION 'cai_v1_idempotency_constraint_missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.clinical_instrument_administrations'::regclass
      AND conname='clinical_instrument_administrations_provenance_check'
      AND pg_get_constraintdef(oid) LIKE '%clinician_assisted%'
  ) THEN RAISE EXCEPTION 'cai_v1_provenance_constraint_missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.clinical_instrument_administrations'::regclass
      AND contype='f'
      AND pg_get_constraintdef(oid) LIKE '%FOREIGN KEY (instrument_key)%clinical_instrument_catalog%'
  ) THEN RAISE EXCEPTION 'cai_v1_neutral_catalog_fk_missing'; END IF;

  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinical_instrument_administrations'
      AND (
        (column_name='clinic_id' AND data_type='uuid' AND is_nullable='NO') OR
        (column_name='patient_id' AND data_type='uuid' AND is_nullable='NO') OR
        (column_name='appointment_id' AND data_type='uuid' AND is_nullable='NO') OR
        (column_name='professional_id' AND data_type='uuid' AND is_nullable='NO') OR
        (column_name='instrument_key' AND data_type='text' AND is_nullable='NO') OR
        (column_name='provenance' AND data_type='text' AND is_nullable='NO') OR
        (column_name='request_id' AND data_type='uuid' AND is_nullable='NO') OR
        (column_name='answers_snapshot' AND data_type='jsonb' AND is_nullable='NO') OR
        (column_name='output_snapshot' AND data_type='jsonb' AND is_nullable='NO') OR
        (column_name='safety_signals' AND data_type='jsonb' AND is_nullable='NO') OR
        (column_name='completed_at' AND data_type='timestamp with time zone' AND is_nullable='NO')
      )
  ) <> 11 THEN RAISE EXCEPTION 'cai_v1_core_column_shape_drift'; END IF;
END;
$$;

DO $$
DECLARE p record; v_src text;
BEGIN
  SELECT * INTO p FROM pg_proc
  WHERE oid='public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb)'::regprocedure;
  IF NOT FOUND OR NOT p.prosecdef
     OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, auth, pg_temp'],false)
     OR has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anon',p.oid,'EXECUTE')
     OR NOT has_function_privilege('service_role',p.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'cai_v1_writer_acl_or_shape_drift';
  END IF;

  v_src := pg_get_functiondef(p.oid);
  IF position('can_apply_clinical_instrument_in_encounter' in v_src)=0
     OR position('current_clinic_id()' in v_src)=0
     OR position('clinical_instrument_catalog' in v_src)=0
     OR position('a.professional_id = p_actor_user_id' in v_src)=0
     OR position('a.status = ''em_atendimento''' in v_src)=0
     OR position('v_catalog.engine_rule_version' in v_src)=0
     OR position('''clinician_assisted''' in v_src)=0
     OR position('nexus_clinical_results' in v_src)>0
     OR position('''nexus.scales''' in v_src)>0
     OR position('current_app_role' in v_src)>0
     OR position('professional_type' in v_src)>0
     OR position('especialidade' in lower(v_src))>0
     OR position('fisio_id' in v_src)>0 THEN
    RAISE EXCEPTION 'cai_v1_writer_source_drift';
  END IF;
END;
$$;

DO $$
DECLARE t record;
BEGIN
  SELECT * INTO t FROM pg_trigger
  WHERE tgrelid='public.clinical_instrument_administrations'::regclass
    AND tgname='trg_clinical_instrument_administration_immutable'
    AND NOT tgisinternal;
  IF NOT FOUND OR t.tgenabled <> 'O'
     OR t.tgfoid <> 'public.guard_clinical_instrument_administration_immutable()'::regprocedure
     OR (t.tgtype & 1) = 0
     OR (t.tgtype & 2) = 0
     OR (t.tgtype & 8) = 0
     OR (t.tgtype & 16) = 0 THEN
    RAISE EXCEPTION 'cai_v1_immutability_trigger_drift';
  END IF;
END;
$$;

\echo 'CLINICIAN ASSISTED INSTRUMENT V1 VERIFY PASSED'
ROLLBACK;
