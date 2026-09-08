\pset pager off
-- Production-safe C-03 verifier. Read-only: lifecycle schema/contracts, historical
-- immutability, C-02/C-06 helper fingerprints and C-01 read guards.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

-- C-06 + C-02 effective helper fingerprints remain unchanged.
DO $$
DECLARE
  expected record;
  actual record;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('public.current_clinic_id()', '678fac3c2bb8698a44f8a9d9b282f53d'),
      ('public.current_app_role()', '7b2e6e62d9fb349ba6aa48c0744c34a7'),
      ('public.current_nexus_medical_identity_valid()', '59f4b68dda8c2c166ba803ad62f2b509'),
      ('public.current_nexus_entitlement_allowed()', 'fb31e7618a47bd017ad21ec60b12b084'),
      ('public.has_professional_capability(text)', '501cf03c6f0a99ca970f3f491c64083b'),
      ('public.can_access_patient_clinical_record(uuid)', '6a9314528b66df705c5ff36c3619831d'),
      ('public.list_patient_clinical_snapshot()', '2dfeb251865ec09623324341564b10f9'),
      ('public.resolve_nexus_result_required_capability(text,text,text,text)', '3c780dc05d82c9d1b4e087f563892e40'),
      ('public.validate_nexus_result_context()', 'ea4032a698b42b5c495c0d192bca9bd0')
    ) AS v(signature, body_md5)
  LOOP
    SELECT p.* INTO actual
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(expected.signature);
    IF NOT FOUND OR md5(actual.prosrc) <> expected.body_md5 THEN
      RAISE EXCEPTION 'nexus_c03_prerequisite_helper_drift: %', expected.signature;
    END IF;
  END LOOP;
END;
$$;

-- C-02 trusted registry remains exact.
DO $$
BEGIN
  IF to_regclass('public.nexus_result_contracts') IS NULL
     OR (SELECT count(*) FROM public.nexus_result_contracts) <> 3
     OR NOT EXISTS (SELECT 1 FROM public.nexus_result_contracts WHERE module_key='eem' AND tool_key='eem' AND rule_key='nexus.eem' AND rule_version='nexus-eem-2026-09-03' AND required_capability='nexus.eem')
     OR NOT EXISTS (SELECT 1 FROM public.nexus_result_contracts WHERE module_key='scales' AND tool_key='phq9' AND rule_key='nexus.phq9' AND rule_version='nexus-2026-09-03' AND required_capability='nexus.scales')
     OR NOT EXISTS (SELECT 1 FROM public.nexus_result_contracts WHERE module_key='scales' AND tool_key='gad7' AND rule_key='nexus.gad7' AND rule_version='nexus-2026-09-03' AND required_capability='nexus.scales') THEN
    RAISE EXCEPTION 'nexus_c03_c02_registry_drift';
  END IF;
END;
$$;

-- The historical result row and its finalized immutability contract are not
-- changed by C-03.
DO $$
DECLARE v_guard record;
BEGIN
  SELECT p.* INTO v_guard
  FROM pg_proc p
  WHERE p.oid = 'public.guard_nexus_result_immutability()'::regprocedure;
  IF NOT FOUND OR md5(v_guard.prosrc) <> 'a161bc1755b2290f07cbec5ee4c5a644' THEN
    RAISE EXCEPTION 'nexus_c03_finalized_guard_drift';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.nexus_clinical_results'::regclass
      AND t.tgname='trg_nexus_result_immutable'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'nexus_c03_finalized_trigger_missing_or_disabled';
  END IF;
END;
$$;

-- Lifecycle schema is additive and orthogonal to the legacy result status.
DO $$
DECLARE
  v_columns integer;
  v_timestamp_order text;
  v_sign_requires_review text;
  v_review_after_processing text;
BEGIN
  IF to_regclass('public.nexus_result_clinical_lifecycle') IS NULL THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_table_missing';
  END IF;

  SELECT count(*) INTO v_columns
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='nexus_result_clinical_lifecycle'
    AND column_name IN (
      'result_id','clinic_id','processed_at','reviewed_at','reviewed_by',
      'signed_at','signed_by','created_at','updated_at'
    );
  IF v_columns <> 9 THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_schema_drift';
  END IF;

  IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid='public.nexus_result_clinical_lifecycle'::regclass
        AND conname IN (
          'nexus_result_lifecycle_nonempty',
          'nexus_result_lifecycle_review_pair',
          'nexus_result_lifecycle_sign_pair',
          'nexus_result_lifecycle_sign_requires_review',
          'nexus_result_lifecycle_review_after_processing',
          'nexus_result_lifecycle_timestamp_order'
        )) <> 6 THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_constraints_drift';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_timestamp_order
  FROM pg_constraint
  WHERE conrelid='public.nexus_result_clinical_lifecycle'::regclass
    AND conname='nexus_result_lifecycle_timestamp_order';
  SELECT pg_get_constraintdef(oid) INTO v_sign_requires_review
  FROM pg_constraint
  WHERE conrelid='public.nexus_result_clinical_lifecycle'::regclass
    AND conname='nexus_result_lifecycle_sign_requires_review';
  SELECT pg_get_constraintdef(oid) INTO v_review_after_processing
  FROM pg_constraint
  WHERE conrelid='public.nexus_result_clinical_lifecycle'::regclass
    AND conname='nexus_result_lifecycle_review_after_processing';

  IF v_timestamp_order IS NULL
     OR position('reviewed_at >= processed_at' IN v_timestamp_order)=0
     OR position('signed_at >= reviewed_at' IN v_timestamp_order)=0
     OR v_sign_requires_review IS NULL
     OR position('signed_at IS NULL' IN v_sign_requires_review)=0
     OR position('reviewed_at IS NOT NULL' IN v_sign_requires_review)=0
     OR v_review_after_processing IS NULL
     OR position('reviewed_at IS NULL' IN v_review_after_processing)=0
     OR position('processed_at IS NOT NULL' IN v_review_after_processing)=0 THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_monotonicity_drift';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.nexus_result_clinical_lifecycle'::regclass) THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_rls_disabled';
  END IF;

  IF has_table_privilege('authenticated','public.nexus_result_clinical_lifecycle','INSERT')
     OR has_table_privilege('authenticated','public.nexus_result_clinical_lifecycle','UPDATE')
     OR has_table_privilege('authenticated','public.nexus_result_clinical_lifecycle','DELETE')
     OR has_table_privilege('anon','public.nexus_result_clinical_lifecycle','SELECT')
     OR NOT has_table_privilege('authenticated','public.nexus_result_clinical_lifecycle','SELECT') THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_acl_drift';
  END IF;
END;
$$;

DO $$
DECLARE
  p record;
  fn text;
  v_terminal_guard_pos integer;
  v_review_timestamp_pos integer;
  v_sign_timestamp_pos integer;
  v_updated_at_pos integer;
BEGIN
  SELECT * INTO p FROM pg_policies
  WHERE schemaname='public'
    AND tablename='nexus_result_clinical_lifecycle'
    AND policyname='nexus_result_lifecycle_read_care_relationship';
  IF NOT FOUND OR p.cmd <> 'SELECT' OR p.roles <> ARRAY['authenticated']::name[]
     OR position('can_access_patient_clinical_record' IN p.qual)=0
     OR position('has_professional_capability' IN p.qual)=0 THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_read_policy_drift';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='nexus_result_clinical_lifecycle') <> 1 THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_unexpected_policy';
  END IF;

  SELECT * INTO p FROM pg_proc
  WHERE oid='public.validate_nexus_result_clinical_lifecycle()'::regprocedure;
  IF NOT FOUND OR NOT p.prosecdef
     OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, pg_temp'],false) THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_guard_contract_drift';
  END IF;
  fn := p.prosrc;

  v_terminal_guard_pos := position(
    'IF TG_OP = ''UPDATE'' AND OLD.signed_at IS NOT NULL THEN' IN fn
  );
  v_review_timestamp_pos := position(
    'IF NEW.reviewed_at IS NOT NULL AND NEW.reviewed_at < NEW.processed_at THEN' IN fn
  );
  v_sign_timestamp_pos := position(
    'IF NEW.signed_at IS NOT NULL AND NEW.signed_at < NEW.reviewed_at THEN' IN fn
  );
  v_updated_at_pos := position('NEW.updated_at := now()' IN fn);

  IF fn IS NULL
     OR position('nexus_clinical_review_author_mismatch' IN fn)=0
     OR position('nexus_clinical_sign_requires_review' IN fn)=0
     OR position('nexus_clinical_lifecycle_signed_immutable' IN fn)=0
     OR position('nexus_clinical_lifecycle_delete_forbidden' IN fn)=0
     OR v_terminal_guard_pos=0
     OR position('NEW IS DISTINCT FROM OLD' IN fn)>0 THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_guard_drift';
  END IF;

  IF v_review_timestamp_pos=0
     OR v_sign_timestamp_pos=0
     OR v_updated_at_pos=0
     OR v_terminal_guard_pos > v_review_timestamp_pos
     OR v_terminal_guard_pos > v_sign_timestamp_pos
     OR v_terminal_guard_pos > v_updated_at_pos THEN
    RAISE EXCEPTION 'nexus_c03_signed_immutability_precedence_drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.nexus_result_clinical_lifecycle'::regclass
      AND t.tgname='trg_nexus_result_clinical_lifecycle'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'nexus_c03_lifecycle_trigger_missing_or_disabled';
  END IF;
END;
$$;

-- Browser clinical actions exist, are definer functions, and anon cannot invoke.
DO $$
DECLARE
  signature text;
  p record;
  body text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.complete_nexus_result_processing(uuid)',
    'public.review_nexus_result(uuid)',
    'public.sign_nexus_result(uuid)'
  ] LOOP
    SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(signature);
    IF NOT FOUND OR NOT p.prosecdef
       OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, pg_temp'],false)
       OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
       OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'nexus_c03_action_contract_drift: %', signature;
    END IF;
  END LOOP;

  SELECT prosrc INTO body FROM pg_proc WHERE oid='public.review_nexus_result(uuid)'::regprocedure;
  IF position('professional_id <> auth.uid()' IN body)=0
     OR position('can_access_patient_clinical_record' IN body)=0
     OR position('has_professional_capability(v_result.required_capability)' IN body)=0
     OR position('status <> ''finalized''' IN body)=0 THEN
    RAISE EXCEPTION 'nexus_c03_review_boundary_drift';
  END IF;

  SELECT prosrc INTO body FROM pg_proc WHERE oid='public.sign_nexus_result(uuid)'::regprocedure;
  IF position('nexus_result_review_required_before_sign' IN body)=0
     OR position('professional_id <> auth.uid()' IN body)=0
     OR position('has_professional_capability(v_result.required_capability)' IN body)=0 THEN
    RAISE EXCEPTION 'nexus_c03_sign_boundary_drift';
  END IF;
END;
$$;

-- Specific writers preserve their authorization paths while recording distinct
-- C-03 lifecycle evidence.
DO $$
DECLARE body text;
BEGIN
  SELECT prosrc INTO body FROM pg_proc
  WHERE oid='public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)'::regprocedure;
  IF body IS NULL
     OR position('nexus_result_clinical_lifecycle' IN body)=0
     OR position('processed_at' IN body)=0
     OR position('reviewed_at' IN body)>0
     OR position('signed_at' IN body)>0
     OR position('clinic_not_active' IN body)=0 THEN
    RAISE EXCEPTION 'nexus_c03_self_assessment_writer_drift';
  END IF;

  SELECT prosrc INTO body FROM pg_proc
  WHERE oid='public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb)'::regprocedure;
  IF body IS NULL
     OR position('nexus_result_clinical_lifecycle' IN body)=0
     OR position('reviewed_at' IN body)=0
     OR position('reviewed_by' IN body)=0
     OR position('signed_at' IN body)=0
     OR position('signed_by' IN body)=0
     OR position('has_professional_capability(''nexus.eem'')' IN body)=0 THEN
    RAISE EXCEPTION 'nexus_c03_eem_writer_drift';
  END IF;
END;
$$;

-- C-01 result read guards remain exactly present/restrictive. Detailed helper and
-- expression verification remains authoritative in the C-01/C-06/C-02 verifiers.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nexus_clinical_results' AND policyname='nexus_results_read_guard' AND permissive='RESTRICTIVE')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nexus_red_flags' AND policyname='nexus_red_flags_read_guard' AND permissive='RESTRICTIVE')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nexus_self_assessment_invites' AND policyname='nexus_self_assessment_read_guard' AND permissive='RESTRICTIVE') THEN
    RAISE EXCEPTION 'nexus_c03_c01_guard_drift';
  END IF;
END;
$$;

SELECT 'NEXUS_C03_VERIFIED' AS result;
COMMIT;
