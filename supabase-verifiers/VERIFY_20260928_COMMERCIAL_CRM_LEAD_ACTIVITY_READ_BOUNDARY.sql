\set ON_ERROR_STOP on

SELECT '1) MED-CRM-009 reader keeps the released signature and ACL' AS check;
DO $$
DECLARE
  v_fn regprocedure := to_regprocedure('public.list_current_clinic_crm_lead_activities(uuid)');
  v_result text;
BEGIN
  IF v_fn IS NULL THEN
    RAISE EXCEPTION 'crm_lead_activity_reader_missing';
  END IF;

  SELECT lower(pg_get_function_result(v_fn)) INTO v_result;
  IF v_result <> 'table(id uuid, activity_type text, actor_id uuid, actor_kind text, metadata jsonb, created_at timestamp with time zone)' THEN
    RAISE EXCEPTION 'crm_lead_activity_reader_return_shape_changed:%', v_result;
  END IF;

  IF has_function_privilege('anon', v_fn, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'crm_lead_activity_reader_acl_invalid';
  END IF;
END $$;

SELECT '2) MED-CRM-009 reader remains STABLE SECURITY DEFINER with pinned search_path' AS check;
DO $$
DECLARE
  v_fn regprocedure := 'public.list_current_clinic_crm_lead_activities(uuid)'::regprocedure;
  v_def text := lower(pg_get_functiondef(v_fn));
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    WHERE p.oid = v_fn
      AND p.prosecdef
      AND p.provolatile = 's'
  ) THEN
    RAISE EXCEPTION 'crm_lead_activity_reader_security_or_volatility_regressed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
    WHERE p.oid = v_fn
      AND cfg LIKE 'search_path=%public%pg_temp%'
  ) THEN
    RAISE EXCEPTION 'crm_lead_activity_reader_search_path_not_pinned';
  END IF;

  IF v_def NOT LIKE '%crm_current_reader_clinic_id%'
     OR v_def NOT LIKE '%l.clinic_id = v_clinic%'
     OR v_def NOT LIKE '%a.clinic_id = v_clinic%'
     OR v_def NOT LIKE '%l.deleted_at is null%' THEN
    RAISE EXCEPTION 'crm_lead_activity_reader_tenant_boundary_regressed';
  END IF;
END $$;

SELECT '3) MED-CRM-009 projection suppresses actor identity and allowlists metadata' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef(
    'public.list_current_clinic_crm_lead_activities(uuid)'::regprocedure
  ));
BEGIN
  IF v_def NOT LIKE '%null::uuid%actor_id%'
     OR v_def NOT LIKE '%a.actor_kind%'
     OR v_def NOT LIKE '%stage_changed%'
     OR v_def NOT LIKE '%from_stage_id%'
     OR v_def NOT LIKE '%to_stage_id%'
     OR v_def NOT LIKE '%contact_identity_resolved%'
     OR v_def NOT LIKE '%resolution_mode%'
     OR v_def NOT LIKE '%create_if_clear%'
     OR v_def NOT LIKE '%explicit_reuse%'
     OR v_def NOT LIKE '%explicit_distinct%'
     OR v_def NOT LIKE '%else ''{}''::jsonb%' THEN
    RAISE EXCEPTION 'crm_lead_activity_projection_allowlist_missing';
  END IF;

  IF v_def LIKE '%candidate_ids%'
     OR v_def LIKE '%match_reasons%'
     OR v_def LIKE '%distinct_reason%'
     OR v_def LIKE '%requested_contact_id%'
     OR v_def LIKE '%resolved_contact_id%'
     OR v_def LIKE '%lost_reason_code%'
     OR v_def LIKE '%lost_reason_detail%' THEN
    RAISE EXCEPTION 'crm_lead_activity_projection_internal_metadata_leak';
  END IF;
END $$;

SELECT '4) MED-CRM-009 introduces no Patient or write authority' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef(
    'public.list_current_clinic_crm_lead_activities(uuid)'::regprocedure
  ));
BEGIN
  IF v_def LIKE '%patients%'
     OR v_def LIKE '%patient_id%'
     OR v_def LIKE '%clinical%'
     OR v_def LIKE '%insert into%'
     OR v_def LIKE '%update public.%'
     OR v_def LIKE '%delete from%' THEN
    RAISE EXCEPTION 'crm_lead_activity_reader_foreign_or_write_authority_detected';
  END IF;
END $$;

SELECT '5) raw authenticated Commercial CRM DML remains closed' AS check;
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.crm_lead_activities', 'INSERT')
     OR has_table_privilege('authenticated', 'public.crm_lead_activities', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.crm_lead_activities', 'DELETE')
     OR has_table_privilege('authenticated', 'public.crm_leads', 'UPDATE') THEN
    RAISE EXCEPTION 'crm_raw_browser_dml_regressed';
  END IF;
END $$;

SELECT 'COMMERCIAL CRM LEAD ACTIVITY READ BOUNDARY VERIFY PASSED' AS result;
