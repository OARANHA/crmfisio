-- Production-safe read-only verifier: Encounter Record Correction/Addendum V1.
BEGIN;
SET TRANSACTION READ ONLY;

DO $$
DECLARE
  missing text;
BEGIN
  IF to_regclass('public.clinical_encounter_record_addenda') IS NULL THEN
    RAISE EXCEPTION 'clinical_encounter_record_addenda table missing';
  END IF;

  SELECT string_agg(v.name, ', ' ORDER BY v.name) INTO missing
  FROM (VALUES
    ('id'),('clinic_id'),('encounter_record_id'),('appointment_id'),('patient_id'),
    ('evolution_id'),('original_professional_id'),('author_id'),('request_id'),
    ('kind'),('reason'),('content'),('created_at')
  ) AS v(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name='clinical_encounter_record_addenda'
      AND c.column_name=v.name
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'addendum columns missing: %', missing;
  END IF;
END $$;

DO $$
DECLARE
  rls boolean;
  policy_qual text;
BEGIN
  SELECT relrowsecurity INTO rls
  FROM pg_class
  WHERE oid='public.clinical_encounter_record_addenda'::regclass;
  IF rls IS NOT TRUE THEN
    RAISE EXCEPTION 'addendum RLS not enabled';
  END IF;

  SELECT qual INTO policy_qual
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='clinical_encounter_record_addenda'
    AND policyname='clinical_encounter_record_addenda_select_clinical'
    AND cmd='SELECT';
  IF policy_qual IS NULL
     OR policy_qual NOT ILIKE '%current_clinic_id()%'
     OR policy_qual NOT ILIKE '%can_access_patient_clinical_record(patient_id)%' THEN
    RAISE EXCEPTION 'addendum clinical read policy invalid';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT has_table_privilege('authenticated','public.clinical_encounter_record_addenda','SELECT')
     OR has_table_privilege('authenticated','public.clinical_encounter_record_addenda','INSERT')
     OR has_table_privilege('authenticated','public.clinical_encounter_record_addenda','UPDATE')
     OR has_table_privilege('authenticated','public.clinical_encounter_record_addenda','DELETE') THEN
    RAISE EXCEPTION 'authenticated addendum grants invalid';
  END IF;
  IF has_table_privilege('anon','public.clinical_encounter_record_addenda','SELECT')
     OR has_table_privilege('anon','public.clinical_encounter_record_addenda','INSERT')
     OR has_table_privilege('anon','public.clinical_encounter_record_addenda','UPDATE')
     OR has_table_privilege('anon','public.clinical_encounter_record_addenda','DELETE') THEN
    RAISE EXCEPTION 'anon addendum grants invalid';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.clinical_encounter_record_addenda'::regclass
      AND conname='clinical_encounter_record_addenda_request_unique'
      AND contype='u'
  ) THEN
    RAISE EXCEPTION 'addendum request uniqueness missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.clinical_encounter_record_addenda'::regclass
      AND conname='clinical_encounter_record_addenda_author_v1'
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%author_id%original_professional_id%'
  ) THEN
    RAISE EXCEPTION 'addendum author constraint missing';
  END IF;
END $$;

DO $$
DECLARE
  fn text;
BEGIN
  IF to_regprocedure('public.create_clinical_encounter_record_addendum(uuid,uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'create_clinical_encounter_record_addendum RPC missing';
  END IF;
  SELECT pg_get_functiondef('public.create_clinical_encounter_record_addendum(uuid,uuid,text,text,text)'::regprocedure)
  INTO fn;
  IF fn NOT ILIKE '%SECURITY DEFINER%'
     OR fn NOT ILIKE '%current_user_has_valid_clinical_identity()%'
     OR fn NOT ILIKE '%clinical.attend%'
     OR fn NOT ILIKE '%clinical.evolution.write%'
     OR fn NOT ILIKE '%original_author_required%'
     OR fn NOT ILIKE '%status IS DISTINCT FROM ''finalized''%'
     OR fn NOT ILIKE '%status IS DISTINCT FROM ''finalizado''%'
     OR fn NOT ILIKE '%pg_advisory_xact_lock%'
     OR fn NOT ILIKE '%idempotency_conflict%'
     OR fn NOT ILIKE '%INSERT INTO public.clinical_encounter_record_addenda%' THEN
    RAISE EXCEPTION 'addendum RPC boundary incomplete';
  END IF;
  IF NOT has_function_privilege('authenticated',
       'public.create_clinical_encounter_record_addendum(uuid,uuid,text,text,text)','EXECUTE')
     OR has_function_privilege('anon',
       'public.create_clinical_encounter_record_addendum(uuid,uuid,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'addendum RPC grants invalid';
  END IF;
END $$;

DO $$
DECLARE
  fn text;
BEGIN
  SELECT pg_get_functiondef('public.guard_finalized_encounter_evolution_immutable()'::regprocedure)
  INTO fn;
  IF fn NOT ILIKE '%clinical_encounter_records%'
     OR fn NOT ILIKE '%evolution_id = OLD.id%'
     OR fn NOT ILIKE '%status = ''finalized''%'
     OR fn NOT ILIKE '%clinical_encounter_evolution_finalized_immutable%' THEN
    RAISE EXCEPTION 'finalized Evolution freeze guard invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.physiotherapy_evolutions'::regclass
      AND t.tgname='trg_01_finalized_encounter_evolution_immutable'
      AND NOT t.tgisinternal
      AND (t.tgtype & 2)=2
      AND (t.tgtype & 8)=8
      AND (t.tgtype & 16)=16
  ) THEN
    RAISE EXCEPTION 'finalized Evolution freeze trigger invalid';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.clinical_encounter_record_addenda'::regclass
      AND t.tgname='trg_validate_clinical_encounter_record_addendum_provenance'
      AND NOT t.tgisinternal
      AND (t.tgtype & 2)=2
      AND (t.tgtype & 4)=4
  ) THEN
    RAISE EXCEPTION 'addendum provenance trigger invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.clinical_encounter_record_addenda'::regclass
      AND t.tgname='trg_guard_clinical_encounter_record_addendum_immutable'
      AND NOT t.tgisinternal
      AND (t.tgtype & 2)=2
      AND (t.tgtype & 8)=8
      AND (t.tgtype & 16)=16
  ) THEN
    RAISE EXCEPTION 'addendum immutability trigger invalid';
  END IF;
END $$;

DO $$
DECLARE
  config text[];
BEGIN
  SELECT proconfig INTO config
  FROM pg_proc
  WHERE oid='public.create_clinical_encounter_record_addendum(uuid,uuid,text,text,text)'::regprocedure;
  IF config IS NULL OR NOT ('search_path=public, pg_temp' = ANY(config)) THEN
    RAISE EXCEPTION 'addendum RPC fixed search_path missing';
  END IF;
END $$;

\echo 'VERIFY ENCOUNTER RECORD ADDENDUM V1 PRODUCTION OK'
ROLLBACK;
