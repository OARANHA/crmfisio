\set ON_ERROR_STOP on

SELECT '1) MED-CRM-008 canonical command exists' AS check;
DO $$
BEGIN
  IF to_regprocedure(
    'public.update_current_clinic_crm_lead_details(uuid,timestamptz,text,bigint,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'crm_lead_details_function_missing';
  END IF;
END $$;

SELECT '2) command is authenticated-only SECURITY DEFINER with pinned search_path' AS check;
DO $$
DECLARE
  v_fn regprocedure :=
    'public.update_current_clinic_crm_lead_details(uuid,timestamptz,text,bigint,text)'::regprocedure;
  v_oid oid := v_fn::oid;
BEGIN
  IF has_function_privilege('anon', v_fn, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'crm_lead_details_acl_invalid';
  END IF;

  IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_oid) THEN
    RAISE EXCEPTION 'crm_lead_details_not_security_definer';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
    WHERE p.oid = v_oid
      AND cfg LIKE 'search_path=%public%pg_temp%'
  ) THEN
    RAISE EXCEPTION 'crm_lead_details_search_path_not_pinned';
  END IF;
END $$;

SELECT '3) tenant, row-lock, retry, lifecycle and stale ordering are server-side' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef(
    'public.update_current_clinic_crm_lead_details(uuid,timestamptz,text,bigint,text)'::regprocedure
  ));
  v_lead_lock integer;
  v_retry integer;
  v_contact_guard integer;
  v_pipeline_guard integer;
  v_stage_guard integer;
  v_stale integer;
  v_update integer;
BEGIN
  IF v_def NOT LIKE '%crm_current_mutator_clinic_id%'
     OR v_def NOT LIKE '%from public.crm_leads l%'
     OR v_def NOT LIKE '%l.clinic_id = v_clinic%'
     OR v_def NOT LIKE '%l.deleted_at is null%'
     OR v_def NOT LIKE '%for update%'
     OR v_def NOT LIKE '%crm_lead_not_found%' THEN
    RAISE EXCEPTION 'crm_lead_details_tenant_or_lead_lock_missing';
  END IF;

  IF v_def NOT LIKE '%from public.contacts c%'
     OR v_def NOT LIKE '%c.deleted_at is null%'
     OR v_def NOT LIKE '%c.anonymized_at is null%'
     OR v_def NOT LIKE '%from public.crm_pipelines p%'
     OR v_def NOT LIKE '%p.archived_at is null%'
     OR v_def NOT LIKE '%from public.crm_stages s%'
     OR v_def NOT LIKE '%s.archived_at is null%'
     OR v_def NOT LIKE '%for share%' THEN
    RAISE EXCEPTION 'crm_lead_details_lifecycle_lock_missing';
  END IF;

  v_lead_lock := position('from public.crm_leads l' in v_def);
  v_retry := position('if v_lead.title is not distinct from v_title' in v_def);
  v_contact_guard := position('from public.contacts c' in v_def);
  v_pipeline_guard := position('from public.crm_pipelines p' in v_def);
  v_stage_guard := position('from public.crm_stages s' in v_def);
  v_stale := position('if v_lead.updated_at is distinct from p_expected_updated_at' in v_def);
  v_update := position('update public.crm_leads' in v_def);

  IF v_lead_lock = 0 OR v_retry = 0 OR v_contact_guard = 0
     OR v_pipeline_guard = 0 OR v_stage_guard = 0 OR v_stale = 0 OR v_update = 0
     OR NOT (
       v_lead_lock < v_retry
       AND v_retry < v_contact_guard
       AND v_contact_guard < v_pipeline_guard
       AND v_pipeline_guard < v_stage_guard
       AND v_stage_guard < v_stale
       AND v_stale < v_update
     ) THEN
    RAISE EXCEPTION 'crm_lead_details_guard_order_invalid';
  END IF;
END $$;

SELECT '4) mutation surface is title/value/source only and Patient-free' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef(
    'public.update_current_clinic_crm_lead_details(uuid,timestamptz,text,bigint,text)'::regprocedure
  ));
BEGIN
  IF v_def NOT LIKE '%set title = v_title%'
     OR v_def NOT LIKE '%value_cents = p_value_cents%'
     OR v_def NOT LIKE '%source = v_source%' THEN
    RAISE EXCEPTION 'crm_lead_details_update_fields_missing';
  END IF;

  IF v_def LIKE '%set stage_id%'
     OR v_def LIKE '%set pipeline_id%'
     OR v_def LIKE '%set contact_id%'
     OR v_def LIKE '%set owner_id%'
     OR v_def LIKE '%set closed_at%'
     OR v_def LIKE '%set lost_reason_code%'
     OR v_def LIKE '%set lost_reason_detail%'
     OR v_def LIKE '%update public.contacts%'
     OR v_def LIKE '%update public.patients%'
     OR v_def LIKE '%insert into public.patients%'
     OR v_def LIKE '%patient_journey%'
     OR v_def LIKE '%appointments%'
     OR v_def LIKE '%financial%' THEN
    RAISE EXCEPTION 'crm_lead_details_foreign_or_lifecycle_mutation_detected';
  END IF;
END $$;

SELECT '5) bounded activity and technical audit are emitted only by the command path' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef(
    'public.update_current_clinic_crm_lead_details(uuid,timestamptz,text,bigint,text)'::regprocedure
  ));
BEGIN
  IF v_def NOT LIKE '%lead_details_updated%'
     OR v_def NOT LIKE '%crm_lead_details_updated%'
     OR v_def NOT LIKE '%changed_fields%'
     OR v_def NOT LIKE '%crm_lead_activities%'
     OR v_def NOT LIKE '%audit_log%' THEN
    RAISE EXCEPTION 'crm_lead_details_evidence_contract_missing';
  END IF;
END $$;

SELECT '6) canonical projection already exposes lead_updated_at for optimistic concurrency' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef(
    'public.list_current_clinic_crm_leads()'::regprocedure
  ));
BEGIN
  IF v_def NOT LIKE '%l.updated_at%' THEN
    RAISE EXCEPTION 'crm_lead_updated_at_projection_missing';
  END IF;
END $$;

SELECT '7) raw authenticated UPDATE on crm_leads remains closed' AS check;
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.crm_leads', 'UPDATE') THEN
    RAISE EXCEPTION 'crm_lead_raw_update_grant_regressed';
  END IF;
END $$;

SELECT 'COMMERCIAL CRM LEAD DETAILS VERIFY PASSED' AS result;
