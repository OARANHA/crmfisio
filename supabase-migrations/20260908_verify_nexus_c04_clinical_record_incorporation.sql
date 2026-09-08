\pset pager off
-- Production-safe C-04 verifier. Read-only: validates the explicit incorporation
-- contract and fingerprints the effective C-01/C-06/C-02/C-03 prerequisites.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE expected record; actual record;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('public.current_clinic_id()', '678fac3c2bb8698a44f8a9d9b282f53d'),
    ('public.current_app_role()', '7b2e6e62d9fb349ba6aa48c0744c34a7'),
    ('public.current_nexus_medical_identity_valid()', '59f4b68dda8c2c166ba803ad62f2b509'),
    ('public.current_nexus_entitlement_allowed()', 'fb31e7618a47bd017ad21ec60b12b084'),
    ('public.has_professional_capability(text)', '501cf03c6f0a99ca970f3f491c64083b'),
    ('public.can_access_patient_clinical_record(uuid)', '6a9314528b66df705c5ff36c3619831d'),
    ('public.list_patient_clinical_snapshot()', '2dfeb251865ec09623324341564b10f9'),
    ('public.resolve_nexus_result_required_capability(text,text,text,text)', '3c780dc05d82c9d1b4e087f563892e40'),
    ('public.validate_nexus_result_context()', 'ea4032a698b42b5c495c0d192bca9bd0')
  ) AS v(signature, body_md5) LOOP
    SELECT p.* INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature);
    IF NOT FOUND OR md5(actual.prosrc) <> expected.body_md5
       OR NOT actual.prosecdef
       OR NOT coalesce(actual.proconfig @> ARRAY['search_path=public, pg_temp'],false) THEN
      RAISE EXCEPTION 'nexus_c04_prerequisite_helper_drift: %',expected.signature;
    END IF;
  END LOOP;
END $$;

-- C-01 restrictive read guards remain present and C-02 registry remains exact.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nexus_clinical_results' AND policyname='nexus_results_read_guard' AND permissive='RESTRICTIVE')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nexus_red_flags' AND policyname='nexus_red_flags_read_guard' AND permissive='RESTRICTIVE')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nexus_self_assessment_invites' AND policyname='nexus_self_assessment_read_guard' AND permissive='RESTRICTIVE') THEN
    RAISE EXCEPTION 'nexus_c04_c01_guard_drift';
  END IF;
  IF to_regclass('public.nexus_result_contracts') IS NULL
     OR (SELECT count(*) FROM public.nexus_result_contracts) <> 3
     OR NOT EXISTS (SELECT 1 FROM public.nexus_result_contracts WHERE module_key='eem' AND tool_key='eem' AND rule_key='nexus.eem' AND rule_version='nexus-eem-2026-09-03' AND required_capability='nexus.eem')
     OR NOT EXISTS (SELECT 1 FROM public.nexus_result_contracts WHERE module_key='scales' AND tool_key='phq9' AND rule_key='nexus.phq9' AND rule_version='nexus-2026-09-03' AND required_capability='nexus.scales')
     OR NOT EXISTS (SELECT 1 FROM public.nexus_result_contracts WHERE module_key='scales' AND tool_key='gad7' AND rule_key='nexus.gad7' AND rule_version='nexus-2026-09-03' AND required_capability='nexus.scales') THEN
    RAISE EXCEPTION 'nexus_c04_c02_registry_drift';
  END IF;
END $$;

-- C-03 lifecycle and canonical terminal guard are mandatory prerequisites.
DO $$
DECLARE fn text; guard_pos integer; review_pos integer; sign_pos integer; updated_pos integer;
BEGIN
  IF to_regclass('public.nexus_result_clinical_lifecycle') IS NULL THEN
    RAISE EXCEPTION 'nexus_c04_c03_lifecycle_missing';
  END IF;
  SELECT prosrc INTO fn FROM pg_proc
  WHERE oid='public.validate_nexus_result_clinical_lifecycle()'::regprocedure;
  guard_pos := position('IF TG_OP = ''UPDATE'' AND OLD.signed_at IS NOT NULL THEN' IN fn);
  review_pos := position('IF NEW.reviewed_at IS NOT NULL AND NEW.reviewed_at < NEW.processed_at THEN' IN fn);
  sign_pos := position('IF NEW.signed_at IS NOT NULL AND NEW.signed_at < NEW.reviewed_at THEN' IN fn);
  updated_pos := position('NEW.updated_at := now()' IN fn);
  IF fn IS NULL OR guard_pos=0 OR position('NEW IS DISTINCT FROM OLD' IN fn)>0
     OR review_pos=0 OR sign_pos=0 OR updated_pos=0
     OR guard_pos>review_pos OR guard_pos>sign_pos OR guard_pos>updated_pos THEN
    RAISE EXCEPTION 'nexus_c04_c03_guard_drift';
  END IF;
END $$;

DO $$
DECLARE
  p record;
  fn text;
  v_columns integer;
  v_unique integer;
BEGIN
  IF to_regclass('public.clinical_record_nexus_incorporations') IS NULL THEN
    RAISE EXCEPTION 'nexus_c04_incorporation_table_missing';
  END IF;

  SELECT count(*) INTO v_columns FROM information_schema.columns
  WHERE table_schema='public' AND table_name='clinical_record_nexus_incorporations'
    AND column_name IN (
      'id','clinic_id','patient_id','professional_id','nexus_result_id','appointment_id',
      'module_key','tool_key','rule_key','rule_version','required_capability',
      'clinical_summary','soap_text','total_score','max_score','classification','severity',
      'red_flags_snapshot','source_finalized_at','source_reviewed_at','source_signed_at',
      'incorporated_at','created_at'
    );
  IF v_columns <> 23 THEN RAISE EXCEPTION 'nexus_c04_incorporation_schema_drift'; END IF;

  SELECT count(*) INTO v_unique
  FROM pg_constraint c
  WHERE c.conrelid='public.clinical_record_nexus_incorporations'::regclass
    AND c.contype='u'
    AND pg_get_constraintdef(c.oid) LIKE '%(nexus_result_id)%';
  IF v_unique <> 1 THEN RAISE EXCEPTION 'nexus_c04_result_uniqueness_missing'; END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.clinical_record_nexus_incorporations'::regclass) THEN
    RAISE EXCEPTION 'nexus_c04_rls_disabled';
  END IF;
  IF has_table_privilege('authenticated','public.clinical_record_nexus_incorporations','INSERT')
     OR has_table_privilege('authenticated','public.clinical_record_nexus_incorporations','UPDATE')
     OR has_table_privilege('authenticated','public.clinical_record_nexus_incorporations','DELETE')
     OR has_table_privilege('anon','public.clinical_record_nexus_incorporations','SELECT')
     OR NOT has_table_privilege('authenticated','public.clinical_record_nexus_incorporations','SELECT') THEN
    RAISE EXCEPTION 'nexus_c04_incorporation_acl_drift';
  END IF;

  SELECT * INTO p FROM pg_policies
  WHERE schemaname='public' AND tablename='clinical_record_nexus_incorporations'
    AND policyname='clinical_record_nexus_read_care_relationship';
  IF NOT FOUND OR p.cmd<>'SELECT' OR p.roles<>ARRAY['authenticated']::name[]
     OR position('current_clinic_id' IN p.qual)=0
     OR position('can_access_patient_clinical_record' IN p.qual)=0
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='clinical_record_nexus_incorporations')<>1 THEN
    RAISE EXCEPTION 'nexus_c04_read_policy_drift';
  END IF;

  SELECT * INTO p FROM pg_proc
  WHERE oid='public.incorporate_nexus_result_into_clinical_record(uuid)'::regprocedure;
  IF NOT FOUND OR NOT p.prosecdef
     OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, pg_temp'],false)
     OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'nexus_c04_rpc_contract_drift';
  END IF;
  fn := p.prosrc;
  IF position('v_result.professional_id IS DISTINCT FROM v_uid' IN fn)=0
     OR position('p.ativo IS TRUE' IN fn)=0
     OR position('lifecycle_status' IN fn)=0
     OR position('can_access_patient_clinical_record' IN fn)=0
     OR position('has_professional_capability(''nexus.access'')' IN fn)=0
     OR position('has_professional_capability(v_result.required_capability)' IN fn)=0
     OR position('v_lifecycle.processed_at IS NULL' IN fn)=0
     OR position('v_lifecycle.reviewed_at IS NULL' IN fn)=0
     OR position('v_lifecycle.reviewed_by IS DISTINCT FROM v_uid' IN fn)=0
     OR position('v_lifecycle.signed_at IS NULL' IN fn)=0
     OR position('v_lifecycle.signed_by IS DISTINCT FROM v_uid' IN fn)=0
     OR position('ON CONFLICT (nexus_result_id) DO NOTHING' IN fn)=0
     OR position('input_snapshot' IN fn)>0
     OR position('output_snapshot' IN fn)>0 THEN
    RAISE EXCEPTION 'nexus_c04_rpc_authorization_or_snapshot_drift';
  END IF;

  SELECT * INTO p FROM pg_proc
  WHERE oid='public.guard_clinical_record_nexus_incorporation_immutable()'::regprocedure;
  IF NOT FOUND OR position('nexus_c04_incorporation_immutable' IN p.prosrc)=0
     OR position('nexus_c04_incorporation_delete_forbidden' IN p.prosrc)=0
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger t
       WHERE t.tgrelid='public.clinical_record_nexus_incorporations'::regclass
         AND t.tgname='trg_clinical_record_nexus_immutable'
         AND t.tgenabled<>'D' AND NOT t.tgisinternal
     ) THEN
    RAISE EXCEPTION 'nexus_c04_immutability_guard_drift';
  END IF;
END $$;

-- Every incorporated row must remain traceable to the same immutable signed C-03
-- source; this verifier never creates or backfills rows.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clinical_record_nexus_incorporations i
    LEFT JOIN public.nexus_clinical_results r ON r.id=i.nexus_result_id
    LEFT JOIN public.nexus_result_clinical_lifecycle l ON l.result_id=i.nexus_result_id
    WHERE r.id IS NULL
       OR r.clinic_id IS DISTINCT FROM i.clinic_id
       OR r.patient_id IS DISTINCT FROM i.patient_id
       OR r.professional_id IS DISTINCT FROM i.professional_id
       OR r.module_key IS DISTINCT FROM i.module_key
       OR r.tool_key IS DISTINCT FROM i.tool_key
       OR r.rule_key IS DISTINCT FROM i.rule_key
       OR r.rule_version IS DISTINCT FROM i.rule_version
       OR r.required_capability IS DISTINCT FROM i.required_capability
       OR r.status<>'finalized' OR r.finalized_at IS NULL
       OR l.processed_at IS NULL OR l.reviewed_at IS NULL OR l.signed_at IS NULL
       OR l.reviewed_by IS DISTINCT FROM i.professional_id
       OR l.signed_by IS DISTINCT FROM i.professional_id
       OR i.source_finalized_at IS DISTINCT FROM r.finalized_at
       OR i.source_reviewed_at IS DISTINCT FROM l.reviewed_at
       OR i.source_signed_at IS DISTINCT FROM l.signed_at
  ) THEN RAISE EXCEPTION 'nexus_c04_persisted_provenance_drift'; END IF;
END $$;

SELECT 'NEXUS_C04_VERIFIED' AS result;
COMMIT;
