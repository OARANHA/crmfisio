\set ON_ERROR_STOP on

SELECT '1) archived-pipeline guard migration kept the canonical transition function' AS check;
DO $$
BEGIN
  IF to_regprocedure('public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'crm_stage_transition_function_missing';
  END IF;
END $$;

SELECT '2) state-changing transition requires active current pipeline under a row lock' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef('public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)'::regprocedure));
  v_guard integer;
  v_update integer;
BEGIN
  IF v_def NOT LIKE '%from public.crm_pipelines p%'
     OR v_def NOT LIKE '%p.id = v_lead.pipeline_id%'
     OR v_def NOT LIKE '%p.clinic_id = v_clinic%'
     OR v_def NOT LIKE '%p.archived_at is null%'
     OR v_def NOT LIKE '%for share%'
     OR v_def NOT LIKE '%crm_current_pipeline_archived%' THEN
    RAISE EXCEPTION 'crm_archived_pipeline_transition_guard_missing';
  END IF;

  v_guard := position('from public.crm_pipelines p' in v_def);
  v_update := position('update public.crm_leads' in v_def);

  IF v_guard = 0 OR v_update = 0 OR v_guard >= v_update THEN
    RAISE EXCEPTION 'crm_archived_pipeline_guard_not_before_mutation';
  END IF;
END $$;

SELECT '3) exact same-stage idempotency remains before the archive mutation guard' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef('public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)'::regprocedure));
  v_idempotency integer;
  v_guard integer;
BEGIN
  v_idempotency := position('if v_lead.stage_id = v_target.id then' in v_def);
  v_guard := position('from public.crm_pipelines p' in v_def);

  IF v_idempotency = 0 OR v_guard = 0 OR v_idempotency >= v_guard THEN
    RAISE EXCEPTION 'crm_transition_idempotency_order_changed';
  END IF;
END $$;

SELECT '4) canonical tenant/stage/audit/Patient boundaries remain present' AS check;
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef('public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)'::regprocedure));
BEGIN
  IF v_def NOT LIKE '%crm_current_mutator_clinic_id%'
     OR v_def NOT LIKE '%for update%'
     OR v_def NOT LIKE '%s.pipeline_id = v_lead.pipeline_id%'
     OR v_def NOT LIKE '%s.archived_at is null%'
     OR v_def NOT LIKE '%crm_lost_lead_reason_required%'
     OR v_def NOT LIKE '%crm_lead_activities%'
     OR v_def NOT LIKE '%crm_lead_stage_changed%'
     OR v_def NOT LIKE '%audit_log%' THEN
    RAISE EXCEPTION 'crm_transition_existing_boundary_regressed';
  END IF;

  IF v_def LIKE '%update public.patients%'
     OR v_def LIKE '%patient_journey%'
     OR v_def LIKE '%appointments%'
     OR v_def LIKE '%financial%' THEN
    RAISE EXCEPTION 'crm_transition_foreign_domain_leak';
  END IF;
END $$;

SELECT '5) browser ACL remains authenticated RPC only' AS check;
DO $$
DECLARE
  v_fn regprocedure := 'public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)'::regprocedure;
BEGIN
  IF has_function_privilege('anon', v_fn, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'crm_transition_acl_regressed';
  END IF;
END $$;

SELECT 'COMMERCIAL CRM ARCHIVED PIPELINE TRANSITION GUARD VERIFY PASSED' AS result;
