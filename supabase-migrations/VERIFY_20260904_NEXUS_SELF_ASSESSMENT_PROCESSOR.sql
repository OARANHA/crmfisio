-- Execute após 20260904_nexus_self_assessment_processor.sql
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nexus_self_assessment_invites'
      AND column_name = 'processing_started_at'
  ) THEN
    RAISE EXCEPTION 'PROCESSOR_VERIFY_FAIL: processing_started_at ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nexus_self_assessment_invites'
      AND column_name = 'processing_attempts'
  ) THEN
    RAISE EXCEPTION 'PROCESSOR_VERIFY_FAIL: processing_attempts ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nexus_self_assessment_invites'
      AND column_name = 'last_processing_error'
  ) THEN
    RAISE EXCEPTION 'PROCESSOR_VERIFY_FAIL: last_processing_error ausente';
  END IF;
END $$;

DO $$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'claim_nexus_self_assessment_invites',
    'release_nexus_self_assessment_claim',
    'complete_nexus_self_assessment_processing'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_name
        AND p.prosecdef IS TRUE
    ) THEN
      RAISE EXCEPTION 'PROCESSOR_VERIFY_FAIL: função % ausente ou sem SECURITY DEFINER', v_name;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.claim_nexus_self_assessment_invites(text,text,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_nexus_self_assessment_invites(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PROCESSOR_VERIFY_FAIL: claim exposto a anon/authenticated';
  END IF;

  IF has_function_privilege('anon', 'public.release_nexus_self_assessment_claim(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.release_nexus_self_assessment_claim(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PROCESSOR_VERIFY_FAIL: release exposto a anon/authenticated';
  END IF;

  IF has_function_privilege('anon', 'public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PROCESSOR_VERIFY_FAIL: complete exposto a anon/authenticated';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.claim_nexus_self_assessment_invites(text,text,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.release_nexus_self_assessment_claim(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PROCESSOR_VERIFY_FAIL: service_role sem grants obrigatórios';
  END IF;
END $$;

SELECT
  'NEXUS_SELF_ASSESSMENT_PROCESSOR_OK' AS verification,
  now() AS verified_at;
