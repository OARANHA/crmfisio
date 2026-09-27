\set ON_ERROR_STOP on

SELECT '1) create an isolated Lead in the active default pipeline' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000020',
  'Contato Pipeline Archive Guard'
);

SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000020',
  '71000000-0000-0000-0000-000000000020',
  'Lead Pipeline Archive Guard'
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_leads l
    JOIN public.crm_pipelines p
      ON p.id = l.pipeline_id
     AND p.clinic_id = l.clinic_id
    JOIN public.crm_stages s
      ON s.id = l.stage_id
     AND s.pipeline_id = l.pipeline_id
     AND s.clinic_id = l.clinic_id
    WHERE l.id = '81000000-0000-0000-0000-000000000020'
      AND p.archived_at IS NULL
      AND s.archived_at IS NULL
      AND s.stage_kind = 'open'
  ) THEN
    RAISE EXCEPTION 'guard_fixture_lead_not_active_open';
  END IF;
END $$;

SELECT '2) archived target stage remains rejected while pipeline is active' AS check;
DO $$
DECLARE
  v_pipeline uuid;
  v_current uuid;
  v_target uuid;
BEGIN
  SELECT pipeline_id, stage_id
    INTO v_pipeline, v_current
  FROM public.crm_leads
  WHERE id = '81000000-0000-0000-0000-000000000020';

  SELECT id
    INTO v_target
  FROM public.crm_stages
  WHERE pipeline_id = v_pipeline
    AND archived_at IS NULL
    AND stage_kind = 'open'
    AND id <> v_current
  ORDER BY position, id
  LIMIT 1;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'guard_fixture_second_open_stage_missing';
  END IF;

  UPDATE public.crm_stages
  SET archived_at = now()
  WHERE id = v_target;

  PERFORM set_config('medicspro.guard_target_stage', v_target::text, false);
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_target uuid := current_setting('medicspro.guard_target_stage')::uuid;
BEGIN
  BEGIN
    PERFORM * FROM public.transition_current_clinic_crm_lead_stage(
      '81000000-0000-0000-0000-000000000020',
      v_target
    );
    RAISE EXCEPTION 'archived_target_stage_unexpectedly_allowed';
  EXCEPTION
    WHEN no_data_found THEN NULL;
  END;
END $$;
RESET ROLE;

UPDATE public.crm_stages
SET archived_at = NULL
WHERE id = current_setting('medicspro.guard_target_stage')::uuid;

SELECT '3) archived current pipeline blocks state-changing transition server-side' AS check;
DO $
DECLARE
  v_pipeline uuid;
  v_original_stage uuid;
BEGIN
  SELECT pipeline_id, stage_id
    INTO v_pipeline, v_original_stage
  FROM public.crm_leads
  WHERE id = '81000000-0000-0000-0000-000000000020';

  PERFORM set_config('medicspro.guard_original_stage', v_original_stage::text, false);

  UPDATE public.crm_pipelines
  SET archived_at = now()
  WHERE id = v_pipeline;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_stages
    WHERE pipeline_id = v_pipeline
      AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'guard_fixture_stages_were_coupled_to_pipeline_archive';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_pipeline uuid;
  v_current uuid;
  v_target uuid;
BEGIN
  SELECT pipeline_id, stage_id
    INTO v_pipeline, v_current
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id = '81000000-0000-0000-0000-000000000020';

  SELECT id
    INTO v_target
  FROM public.list_current_clinic_crm_stages(v_pipeline)
  WHERE archived_at IS NULL
    AND stage_kind = 'open'
    AND id <> v_current
  ORDER BY position, id
  LIMIT 1;

  -- Exact replay of the current state remains side-effect free and idempotent.
  PERFORM * FROM public.transition_current_clinic_crm_lead_stage(
    '81000000-0000-0000-0000-000000000020',
    v_current
  );

  BEGIN
    PERFORM * FROM public.transition_current_clinic_crm_lead_stage(
      '81000000-0000-0000-0000-000000000020',
      v_target
    );
    RAISE EXCEPTION 'archived_pipeline_transition_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM <> 'crm_current_pipeline_archived' THEN
        RAISE;
      END IF;
  END;
END $$;
RESET ROLE;

SELECT '4) rejected transition leaves Lead, activity, audit and Patient domain untouched' AS check;
DO $
DECLARE
  v_pipeline uuid;
  v_expected_stage uuid := current_setting('medicspro.guard_original_stage')::uuid;
BEGIN
  SELECT pipeline_id
    INTO v_pipeline
  FROM public.crm_leads
  WHERE id = '81000000-0000-0000-0000-000000000020';

  IF (SELECT stage_id FROM public.crm_leads WHERE id = '81000000-0000-0000-0000-000000000020')
     IS DISTINCT FROM v_expected_stage THEN
    RAISE EXCEPTION 'archived_pipeline_rejection_changed_lead_stage';
  END IF;

  IF (SELECT count(*)
      FROM public.crm_lead_activities
      WHERE lead_id = '81000000-0000-0000-0000-000000000020'
        AND activity_type = 'stage_changed') <> 0 THEN
    RAISE EXCEPTION 'archived_pipeline_rejection_emitted_activity';
  END IF;

  IF (SELECT count(*)
      FROM public.audit_log
      WHERE acao = 'CRM_LEAD_STAGE_CHANGED'
        AND detalhe LIKE '%81000000-0000-0000-0000-000000000020%') <> 0 THEN
    RAISE EXCEPTION 'archived_pipeline_rejection_emitted_audit';
  END IF;

  IF (SELECT count(*) FROM public.patients) <> 2
     OR EXISTS (SELECT 1 FROM public.patients WHERE funil_stage <> 'lead')
     OR (SELECT count(*) FROM public.patient_journey_events) <> 0 THEN
    RAISE EXCEPTION 'archived_pipeline_guard_touched_patient_domain';
  END IF;

  UPDATE public.crm_pipelines
  SET archived_at = NULL
  WHERE id = v_pipeline;
END $$;

SELECT 'COMMERCIAL CRM ARCHIVED PIPELINE TRANSITION GUARD BEHAVIOR CASES PASSED' AS result;
