\set ON_ERROR_STOP on

SELECT '1) MED-CRM-006 functions exist' AS check;
DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    to_regprocedure('public.crm_normalize_contact_phone(text)'),
    to_regprocedure('public.crm_contact_phone_candidate_variants(text)'),
    to_regprocedure('public.crm_normalize_contact_email(text)'),
    to_regprocedure('public.crm_contact_identity_lock_key(uuid,text,text)'),
    to_regprocedure('public.crm_lock_contact_identity_signals(uuid,text,text)'),
    to_regprocedure('public.crm_contact_identity_candidates_for_clinic(uuid,text,text)'),
    to_regprocedure('public.list_current_clinic_crm_contact_identity_candidates(text,text)'),
    to_regprocedure('public.crm_create_contact_internal(uuid,uuid,text,text,text,text,text)'),
    to_regprocedure('public.crm_create_lead_internal(uuid,uuid,uuid,text,uuid,uuid,uuid,bigint,text)'),
    to_regprocedure('public.create_current_clinic_crm_resolved_prospect(uuid,uuid,text,text,text,text,text,text,uuid,uuid,uuid,bigint,text)')
  ]
  LOOP
    IF v_fn IS NULL THEN
      RAISE EXCEPTION 'crm_identity_function_missing';
    END IF;
  END LOOP;
END $$;

SELECT '2) internal helpers are not browser executable' AS check;
DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.crm_normalize_contact_phone(text)'::regprocedure,
    'public.crm_contact_phone_candidate_variants(text)'::regprocedure,
    'public.crm_normalize_contact_email(text)'::regprocedure,
    'public.crm_contact_identity_lock_key(uuid,text,text)'::regprocedure,
    'public.crm_lock_contact_identity_signals(uuid,text,text)'::regprocedure,
    'public.crm_contact_identity_candidates_for_clinic(uuid,text,text)'::regprocedure,
    'public.crm_create_contact_internal(uuid,uuid,text,text,text,text,text)'::regprocedure,
    'public.crm_create_lead_internal(uuid,uuid,uuid,text,uuid,uuid,uuid,bigint,text)'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'crm_identity_internal_helper_exposed:%', v_fn;
    END IF;
  END LOOP;
END $$;

SELECT '3) preview and final command are authenticated-only' AS check;
DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.list_current_clinic_crm_contact_identity_candidates(text,text)'::regprocedure,
    'public.create_current_clinic_crm_resolved_prospect(uuid,uuid,text,text,text,text,text,text,uuid,uuid,uuid,bigint,text)'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'crm_identity_public_acl_invalid:%', v_fn;
    END IF;
  END LOOP;
END $$;

SELECT '4) security-definer boundaries pin search_path' AS check;
DO $$
DECLARE
  v_oid oid;
BEGIN
  FOR v_oid IN
    SELECT p.oid
    FROM pg_proc p
    WHERE p.oid IN (
      'public.crm_contact_identity_candidates_for_clinic(uuid,text,text)'::regprocedure::oid,
      'public.list_current_clinic_crm_contact_identity_candidates(text,text)'::regprocedure::oid,
      'public.crm_create_contact_internal(uuid,uuid,text,text,text,text,text)'::regprocedure::oid,
      'public.crm_create_lead_internal(uuid,uuid,uuid,text,uuid,uuid,uuid,bigint,text)'::regprocedure::oid,
      'public.create_current_clinic_crm_contact(uuid,text,text,text)'::regprocedure::oid,
      'public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)'::regprocedure::oid,
      'public.create_current_clinic_crm_resolved_prospect(uuid,uuid,text,text,text,text,text,text,uuid,uuid,uuid,bigint,text)'::regprocedure::oid
    )
  LOOP
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_oid) THEN
      RAISE EXCEPTION 'crm_identity_boundary_not_security_definer:%', v_oid::regprocedure;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p, unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
      WHERE p.oid = v_oid
        AND cfg LIKE 'search_path=%public%pg_temp%'
    ) THEN
      RAISE EXCEPTION 'crm_identity_search_path_not_pinned:%', v_oid::regprocedure;
    END IF;
  END LOOP;
END $$;

SELECT '5) candidate preview reuses writer boundary and excludes Patient authority' AS check;
DO $$
DECLARE
  v_public text := lower(pg_get_functiondef(
    'public.list_current_clinic_crm_contact_identity_candidates(text,text)'::regprocedure
  ));
  v_internal text := lower(pg_get_functiondef(
    'public.crm_contact_identity_candidates_for_clinic(uuid,text,text)'::regprocedure
  ));
BEGIN
  IF v_public NOT LIKE '%crm_current_mutator_clinic_id%' THEN
    RAISE EXCEPTION 'crm_identity_preview_not_writer_scoped';
  END IF;

  IF v_public LIKE '%patient%'
     OR v_internal LIKE '%patients%'
     OR v_internal LIKE '%patient_id%'
     OR v_internal LIKE '%clinical%' THEN
    RAISE EXCEPTION 'crm_identity_preview_patient_boundary_leak';
  END IF;

  IF v_internal NOT LIKE '%deleted_at is null%'
     OR v_internal NOT LIKE '%anonymized_at is null%'
     OR v_internal NOT LIKE '%match_reasons%' THEN
    RAISE EXCEPTION 'crm_identity_candidate_lifecycle_contract_missing';
  END IF;
END $$;

SELECT '6) lock primitive is transaction scoped and deterministically ordered' AS check;
DO $$
DECLARE
  v_key text := lower(pg_get_functiondef(
    'public.crm_contact_identity_lock_key(uuid,text,text)'::regprocedure
  ));
  v_lock text := lower(pg_get_functiondef(
    'public.crm_lock_contact_identity_signals(uuid,text,text)'::regprocedure
  ));
BEGIN
  IF v_key NOT LIKE '%sha256%'
     OR v_key NOT LIKE '%p_clinic_id%'
     OR v_key NOT LIKE '%p_kind%'
     OR v_key NOT LIKE '%p_value%' THEN
    RAISE EXCEPTION 'crm_identity_lock_key_contract_invalid';
  END IF;

  IF v_lock NOT LIKE '%pg_advisory_xact_lock%'
     OR v_lock NOT LIKE '%order by q.lock_key%'
     OR v_lock NOT LIKE '%crm_contact_phone_candidate_variants%' THEN
    RAISE EXCEPTION 'crm_identity_signal_lock_contract_invalid';
  END IF;
END $$;

SELECT '7) existing Contact writer is hardened and stores canonical normalized values' AS check;
DO $$
DECLARE
  v_public text := lower(pg_get_functiondef(
    'public.create_current_clinic_crm_contact(uuid,text,text,text)'::regprocedure
  ));
  v_core text := lower(pg_get_functiondef(
    'public.crm_create_contact_internal(uuid,uuid,text,text,text,text,text)'::regprocedure
  ));
BEGIN
  IF v_public NOT LIKE '%crm_lock_contact_identity_signals%'
     OR v_public NOT LIKE '%crm_contact_identity_candidates_for_clinic%'
     OR v_public NOT LIKE '%crm_contact_identity_resolution_required%'
     OR v_public NOT LIKE '%crm_create_contact_internal%' THEN
    RAISE EXCEPTION 'crm_contact_writer_identity_guard_missing';
  END IF;

  IF v_core NOT LIKE '%phone_normalized%'
     OR v_core NOT LIKE '%email_normalized%'
     OR v_core NOT LIKE '%crm_contact_created%'
     OR v_core NOT LIKE '%audit_log%' THEN
    RAISE EXCEPTION 'crm_contact_core_normalization_or_audit_missing';
  END IF;
END $$;

SELECT '8) Lead public contract composes shared core and serializes same Lead UUID' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef(
    'public.create_current_clinic_crm_lead(uuid,uuid,text,uuid,uuid,uuid,bigint,text)'::regprocedure
  ));
BEGIN
  IF v_def NOT LIKE '%crm_current_mutator_clinic_id%'
     OR v_def NOT LIKE '%lead_retry%'
     OR v_def NOT LIKE '%pg_advisory_xact_lock%'
     OR v_def NOT LIKE '%crm_create_lead_internal%' THEN
    RAISE EXCEPTION 'crm_lead_shared_core_or_retry_lock_missing';
  END IF;
END $$;

SELECT '9) final orchestration is narrow, explicit and Patient-free' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef(
    'public.create_current_clinic_crm_resolved_prospect(uuid,uuid,text,text,text,text,text,text,uuid,uuid,uuid,bigint,text)'::regprocedure
  ));
BEGIN
  IF v_def NOT LIKE '%create_if_clear%'
     OR v_def NOT LIKE '%explicit_reuse%'
     OR v_def NOT LIKE '%explicit_distinct%'
     OR v_def NOT LIKE '%crm_lock_contact_identity_signals%'
     OR v_def NOT LIKE '%crm_contact_identity_candidates_for_clinic%'
     OR v_def NOT LIKE '%crm_create_contact_internal%'
     OR v_def NOT LIKE '%crm_create_lead_internal%'
     OR v_def NOT LIKE '%contact_identity_resolved%'
     OR v_def NOT LIKE '%crm_contact_identity_resolved%' THEN
    RAISE EXCEPTION 'crm_identity_orchestration_contract_missing';
  END IF;

  IF v_def LIKE '%p_patient_id%'
     OR v_def LIKE '%from public.patients%'
     OR v_def LIKE '%join public.patients%'
     OR v_def LIKE '%insert into public.patients%'
     OR v_def LIKE '%update public.patients%'
     OR v_def LIKE '%patient_journey%' THEN
    RAISE EXCEPTION 'crm_identity_orchestration_patient_authority_leak';
  END IF;
END $$;

SELECT '10) identity resolution evidence is exactly-once constrained' AS check;
DO $$
BEGIN
  IF to_regclass('public.crm_lead_contact_identity_resolution_once') IS NULL THEN
    RAISE EXCEPTION 'crm_identity_resolution_once_index_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'crm_lead_contact_identity_resolution_once'
      AND indexdef ILIKE '%unique%'
      AND indexdef ILIKE '%activity_type = ''contact_identity_resolved''%'
  ) THEN
    RAISE EXCEPTION 'crm_identity_resolution_once_index_invalid';
  END IF;
END $$;

SELECT '11) phone/email remain non-unique identity signals' AS check;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='contacts'
      AND indexdef ILIKE '%UNIQUE%'
      AND (
        indexdef ILIKE '%phone_normalized%'
        OR indexdef ILIKE '%email_normalized%'
      )
  ) THEN
    RAISE EXCEPTION 'crm_identity_signal_unique_index_forbidden';
  END IF;
END $$;

SELECT '12) no parallel identity/CRM tables were introduced' AS check;
DO $$
BEGIN
  IF to_regclass('public.crm_contact_identity') IS NOT NULL
     OR to_regclass('public.crm_identity_resolution') IS NOT NULL
     OR to_regclass('public.crm_idempotency') IS NOT NULL THEN
    RAISE EXCEPTION 'crm_identity_parallel_table_detected';
  END IF;
END $$;

SELECT 'COMMERCIAL CRM CONTACT IDENTITY RESOLUTION VERIFY PASSED' AS result;
