\pset pager off
-- Production-safe C-02 verifier. Read-only: verifies trusted contract registry,
-- helper fingerprints, write policies/triggers and the unchanged C-01/C-06 baseline.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  expected record;
  actual record;
BEGIN
  FOR expected IN
    SELECT *
    FROM (VALUES
      ('public.current_clinic_id()', '678fac3c2bb8698a44f8a9d9b282f53d'),
      ('public.current_app_role()', '7b2e6e62d9fb349ba6aa48c0744c34a7'),
      ('public.current_nexus_medical_identity_valid()', '59f4b68dda8c2c166ba803ad62f2b509'),
      ('public.current_nexus_entitlement_allowed()', 'fb31e7618a47bd017ad21ec60b12b084'),
      ('public.has_professional_capability(text)', '501cf03c6f0a99ca970f3f491c64083b'),
      ('public.can_access_patient_clinical_record(uuid)', '6a9314528b66df705c5ff36c3619831d'),
      ('public.list_patient_clinical_snapshot()', '2dfeb251865ec09623324341564b10f9'),
      ('public.resolve_nexus_result_required_capability(text,text,text,text)', '3c780dc05d82c9d1b4e087f563892e40'),
      ('public.validate_nexus_result_context()', 'd61defde034772ae91a87ed47cb16c03')
    ) AS v(signature, body_md5)
  LOOP
    SELECT p.* INTO actual
    FROM pg_proc p
    WHERE p.oid=to_regprocedure(expected.signature);

    IF NOT FOUND OR md5(actual.prosrc) <> expected.body_md5 THEN
      RAISE EXCEPTION 'nexus_c02_helper_drift: %', expected.signature;
    END IF;

    IF expected.signature <> 'public.validate_nexus_result_context()' AND (
      NOT actual.prosecdef
      OR actual.provolatile <> 's'
      OR NOT coalesce(actual.proconfig @> ARRAY['search_path=public, pg_temp'], false)
    ) THEN
      RAISE EXCEPTION 'nexus_c02_helper_contract_drift: %', expected.signature;
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_context text;
BEGIN
  SELECT prosrc INTO v_context
  FROM pg_proc
  WHERE oid='public.validate_nexus_result_context()'::regprocedure;

  IF position('resolve_nexus_result_required_capability' IN v_context)=0
     OR position('has_professional_capability(v_required_capability)' IN v_context)=0
     OR position('has_professional_capability(NEW.required_capability)' IN v_context)>0
     OR position('a.professional_id = NEW.professional_id' IN v_context)=0
     OR position('nexus_result_contract_unknown' IN v_context)=0
     OR position('nexus_result_required_capability_mismatch' IN v_context)=0
     OR position('nexus_result_contract_immutable' IN v_context)=0 THEN
    RAISE EXCEPTION 'nexus_c02_trusted_context_not_effective';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.nexus_result_contracts') IS NULL THEN
    RAISE EXCEPTION 'nexus_c02_contract_registry_missing';
  END IF;

  IF (SELECT count(*) FROM public.nexus_result_contracts) <> 3
     OR NOT EXISTS (SELECT 1 FROM public.nexus_result_contracts WHERE module_key='eem' AND tool_key='eem' AND rule_key='nexus.eem' AND rule_version='nexus-eem-2026-09-03' AND required_capability='nexus.eem')
     OR NOT EXISTS (SELECT 1 FROM public.nexus_result_contracts WHERE module_key='scales' AND tool_key='phq9' AND rule_key='nexus.phq9' AND rule_version='nexus-2026-09-03' AND required_capability='nexus.scales')
     OR NOT EXISTS (SELECT 1 FROM public.nexus_result_contracts WHERE module_key='scales' AND tool_key='gad7' AND rule_key='nexus.gad7' AND rule_version='nexus-2026-09-03' AND required_capability='nexus.scales') THEN
    RAISE EXCEPTION 'nexus_c02_contract_registry_drift';
  END IF;

  IF has_table_privilege('authenticated','public.nexus_result_contracts','SELECT')
     OR has_table_privilege('authenticated','public.nexus_result_contracts','INSERT')
     OR has_table_privilege('authenticated','public.nexus_result_contracts','UPDATE')
     OR has_table_privilege('authenticated','public.nexus_result_contracts','DELETE')
     OR has_table_privilege('anon','public.nexus_result_contracts','SELECT')
     OR NOT has_table_privilege('service_role','public.nexus_result_contracts','SELECT') THEN
    RAISE EXCEPTION 'nexus_c02_contract_registry_acl_drift';
  END IF;

  IF public.resolve_nexus_result_required_capability('eem','eem','nexus.eem','nexus-eem-2026-09-03') <> 'nexus.eem'
     OR public.resolve_nexus_result_required_capability('scales','phq9','nexus.phq9','nexus-2026-09-03') <> 'nexus.scales'
     OR public.resolve_nexus_result_required_capability('scales','gad7','nexus.gad7','nexus-2026-09-03') <> 'nexus.scales'
     OR public.resolve_nexus_result_required_capability('eem','unknown','nexus.eem','nexus-eem-2026-09-03') IS NOT NULL
     OR public.resolve_nexus_result_required_capability('eem','eem','nexus.eem','wrong-version') IS NOT NULL THEN
    RAISE EXCEPTION 'nexus_c02_resolver_contract_drift';
  END IF;
END;
$$;

DO $$
DECLARE
  tdef text;
  immutability record;
BEGIN
  SELECT pg_get_triggerdef(t.oid) INTO tdef
  FROM pg_trigger t
  WHERE t.tgrelid='public.nexus_clinical_results'::regclass
    AND t.tgname='trg_nexus_result_context'
    AND NOT t.tgisinternal;

  IF tdef IS NULL
     OR position('module_key' IN tdef)=0
     OR position('tool_key' IN tdef)=0
     OR position('rule_key' IN tdef)=0
     OR position('rule_version' IN tdef)=0
     OR position('required_capability' IN tdef)=0 THEN
    RAISE EXCEPTION 'nexus_c02_context_trigger_drift';
  END IF;

  SELECT p.* INTO immutability
  FROM pg_proc p
  WHERE p.oid='public.guard_nexus_result_immutability()'::regprocedure;

  IF NOT FOUND OR md5(immutability.prosrc) <> 'a161bc1755b2290f07cbec5ee4c5a644' THEN
    RAISE EXCEPTION 'nexus_c02_finalized_immutability_drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.nexus_clinical_results'::regclass
      AND t.tgname='trg_nexus_result_immutable'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'nexus_c02_finalized_trigger_missing';
  END IF;
END;
$$;

DO $$
DECLARE
  p record;
  normalized text;
BEGIN
  FOR p IN
    SELECT * FROM pg_policies
    WHERE schemaname='public'
      AND tablename='nexus_clinical_results'
      AND policyname IN ('nexus_results_insert_author','nexus_results_update_author')
  LOOP
    normalized := coalesce(p.qual,'') || ' ' || coalesce(p.with_check,'');
    IF position('resolve_nexus_result_required_capability' IN normalized)=0
       OR position('has_professional_capability' IN normalized)=0
       OR normalized ~ 'has_professional_capability\s*\(\s*required_capability\s*\)' THEN
      RAISE EXCEPTION 'nexus_c02_write_policy_client_capability_authority: %', p.policyname;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='nexus_clinical_results'
        AND policyname IN ('nexus_results_insert_author','nexus_results_update_author')) <> 2 THEN
    RAISE EXCEPTION 'nexus_c02_write_policy_missing';
  END IF;
END;
$$;

-- C-01 read policies/guards remain expression-equivalent and restrictive.
DO $$
DECLARE
  expected record;
  actual record;
  expr text;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('nexus_clinical_results','nexus_results_read_care_relationship','nexus_results_read_guard',false),
      ('nexus_red_flags','nexus_red_flags_read_care_relationship','nexus_red_flags_read_guard',false),
      ('nexus_self_assessment_invites','nexus_self_assessment_care_read','nexus_self_assessment_read_guard',true)
    ) AS v(table_name,allow_name,guard_name,scales)
  LOOP
    expr := 'clinic_id=current_clinic_idANDcan_access_patient_clinical_recordpatient_idANDhas_professional_capability''nexus.access''';
    IF expected.scales THEN expr := expr || 'ANDhas_professional_capability''nexus.scales'''; END IF;

    FOR actual IN SELECT * FROM pg_policies
      WHERE schemaname='public' AND tablename=expected.table_name
        AND policyname IN (expected.allow_name,expected.guard_name)
    LOOP
      IF actual.cmd <> 'SELECT'
         OR actual.with_check IS NOT NULL
         OR actual.permissive <> CASE WHEN actual.policyname=expected.guard_name THEN 'RESTRICTIVE' ELSE 'PERMISSIVE' END
         OR actual.roles <> CASE WHEN actual.policyname=expected.guard_name THEN ARRAY['public']::name[] ELSE ARRAY['authenticated']::name[] END
         OR regexp_replace(replace(replace(actual.qual,'public.',''),'::text',''),'[[:space:]()]','','g') IS DISTINCT FROM expr THEN
        RAISE EXCEPTION 'nexus_c02_c01_policy_drift: %', actual.policyname;
      END IF;
    END LOOP;

    IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=expected.table_name AND policyname IN (expected.allow_name,expected.guard_name)) <> 2 THEN
      RAISE EXCEPTION 'nexus_c02_c01_policy_missing: %', expected.table_name;
    END IF;
  END LOOP;
END;
$$;

SELECT module_key, tool_key, rule_key, rule_version, required_capability
FROM public.nexus_result_contracts
ORDER BY module_key, tool_key;

SELECT 'NEXUS_C02_VERIFIED' AS result;
COMMIT;