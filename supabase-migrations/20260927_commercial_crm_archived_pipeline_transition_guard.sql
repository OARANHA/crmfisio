-- MEDICSPRO — MED-CRM-004 Archived Pipeline Transition Guard
-- Follow-up hardening for the canonical Commercial CRM stage-transition command.
-- Contact != Lead != Patient. No new authority, table, role or entitlement is introduced.

BEGIN;

CREATE OR REPLACE FUNCTION public.transition_current_clinic_crm_lead_stage(
  p_lead_id uuid,
  p_to_stage_id uuid,
  p_lost_reason_code text DEFAULT NULL,
  p_lost_reason_detail text DEFAULT NULL
)
RETURNS TABLE (
  lead_id uuid,
  from_stage_id uuid,
  to_stage_id uuid,
  stage_kind text,
  closed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.crm_current_mutator_clinic_id();
  v_lead public.crm_leads%ROWTYPE;
  v_target public.crm_stages%ROWTYPE;
  v_reason_code text := nullif(btrim(coalesce(p_lost_reason_code, '')), '');
  v_reason_detail text := nullif(btrim(coalesce(p_lost_reason_detail, '')), '');
  v_from_stage uuid;
BEGIN
  IF p_lead_id IS NULL OR p_to_stage_id IS NULL THEN
    RAISE EXCEPTION 'crm_lead_and_target_stage_required' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_lead
  FROM public.crm_leads l
  WHERE l.id = p_lead_id
    AND l.clinic_id = v_clinic
    AND l.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_lead_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
    INTO v_target
  FROM public.crm_stages s
  WHERE s.id = p_to_stage_id
    AND s.clinic_id = v_clinic
    AND s.pipeline_id = v_lead.pipeline_id
    AND s.archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_target_stage_not_found_in_current_pipeline' USING ERRCODE = 'P0002';
  END IF;

  IF v_target.stage_kind = 'lost' THEN
    IF v_reason_code IS NULL AND v_reason_detail IS NULL THEN
      RAISE EXCEPTION 'crm_lost_lead_reason_required' USING ERRCODE = '23514';
    END IF;
  ELSIF v_reason_code IS NOT NULL OR v_reason_detail IS NOT NULL THEN
    RAISE EXCEPTION 'crm_non_lost_stage_reason_forbidden' USING ERRCODE = '23514';
  END IF;

  -- Preserve exact side-effect-free retries even if the pipeline was archived
  -- after the original command committed. This branch never mutates state.
  IF v_lead.stage_id = v_target.id THEN
    IF v_target.stage_kind = 'open'
       AND v_lead.closed_at IS NULL
       AND v_lead.lost_reason_code IS NULL
       AND v_lead.lost_reason_detail IS NULL THEN
      RETURN QUERY
      SELECT v_lead.id, v_lead.stage_id, v_target.id, v_target.stage_kind, v_lead.closed_at;
      RETURN;
    END IF;

    IF v_target.stage_kind = 'won'
       AND v_lead.closed_at IS NOT NULL
       AND v_lead.lost_reason_code IS NULL
       AND v_lead.lost_reason_detail IS NULL THEN
      RETURN QUERY
      SELECT v_lead.id, v_lead.stage_id, v_target.id, v_target.stage_kind, v_lead.closed_at;
      RETURN;
    END IF;

    IF v_target.stage_kind = 'lost'
       AND v_lead.closed_at IS NOT NULL
       AND v_lead.lost_reason_code IS NOT DISTINCT FROM v_reason_code
       AND v_lead.lost_reason_detail IS NOT DISTINCT FROM v_reason_detail THEN
      RETURN QUERY
      SELECT v_lead.id, v_lead.stage_id, v_target.id, v_target.stage_kind, v_lead.closed_at;
      RETURN;
    END IF;

    RAISE EXCEPTION 'crm_stage_transition_idempotency_conflict' USING ERRCODE = '23505';
  END IF;

  -- State-changing transitions require the current pipeline to still be active.
  -- FOR SHARE serializes this check against a concurrent pipeline UPDATE/archive:
  -- transition first => archive waits; archive first => transition rechecks and fails.
  PERFORM 1
  FROM public.crm_pipelines p
  WHERE p.id = v_lead.pipeline_id
    AND p.clinic_id = v_clinic
    AND p.archived_at IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_current_pipeline_archived' USING ERRCODE = '23514';
  END IF;

  v_from_stage := v_lead.stage_id;

  UPDATE public.crm_leads
  SET stage_id = v_target.id,
      closed_at = CASE
        WHEN v_target.stage_kind = 'open' THEN NULL
        ELSE now()
      END,
      lost_reason_code = CASE
        WHEN v_target.stage_kind = 'lost' THEN v_reason_code
        ELSE NULL
      END,
      lost_reason_detail = CASE
        WHEN v_target.stage_kind = 'lost' THEN v_reason_detail
        ELSE NULL
      END
  WHERE id = v_lead.id
    AND clinic_id = v_clinic
  RETURNING public.crm_leads.closed_at
       INTO v_lead.closed_at;

  INSERT INTO public.crm_lead_activities (
    clinic_id,
    lead_id,
    activity_type,
    actor_id,
    actor_kind,
    metadata
  ) VALUES (
    v_clinic,
    v_lead.id,
    'stage_changed',
    auth.uid(),
    'human',
    jsonb_strip_nulls(
      jsonb_build_object(
        'from_stage_id', v_from_stage,
        'to_stage_id', v_target.id,
        'stage_kind', v_target.stage_kind,
        'lost_reason_code', CASE WHEN v_target.stage_kind = 'lost' THEN v_reason_code ELSE NULL END,
        'lost_reason_detail', CASE WHEN v_target.stage_kind = 'lost' THEN v_reason_detail ELSE NULL END
      )
    )
  );

  INSERT INTO public.audit_log (
    clinic_id,
    usuario_id,
    acao,
    detalhe
  ) VALUES (
    v_clinic,
    auth.uid(),
    'CRM_LEAD_STAGE_CHANGED',
    format(
      'lead_id=%s; from_stage_id=%s; to_stage_id=%s; stage_kind=%s',
      v_lead.id,
      v_from_stage,
      v_target.id,
      v_target.stage_kind
    )
  );

  RETURN QUERY
  SELECT v_lead.id, v_from_stage, v_target.id, v_target.stage_kind, v_lead.closed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text)
TO authenticated;

COMMENT ON FUNCTION public.transition_current_clinic_crm_lead_stage(uuid,uuid,text,text) IS
  'Canonical same-pipeline Lead stage transition. State-changing transitions require an active current pipeline; exact side-effect-free retries remain idempotent.';

COMMIT;
