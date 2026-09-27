\set ON_ERROR_STOP on

-- Add the two remaining canonical CRM writer roles to the existing #522 fixture.
INSERT INTO auth.users (id, email) VALUES
  ('40000000-0000-0000-0000-000000000005', 'admin-a@example.test'),
  ('40000000-0000-0000-0000-000000000006', 'recep-a@example.test');

INSERT INTO public.profiles (id, clinic_id, role, ativo) VALUES
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'admin', true),
  ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'recep', true);

-- A Clinic B contact is inserted by the fixture owner role (database superuser)
-- only to prove that the current-clinic command cannot cross tenant.
INSERT INTO public.contacts (id, clinic_id, name)
VALUES (
  '71000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'Contato B'
);

SELECT '1) owner creates Contact and exact retry is idempotent' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000010',
  'Contato Secreto',
  '+55 51 99999-1111',
  'secret@example.test'
);
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000010',
  'Contato Secreto',
  '+55 51 99999-1111',
  'secret@example.test'
);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.contacts WHERE id='71000000-0000-0000-0000-000000000010') <> 1 THEN
    RAISE EXCEPTION 'contact_retry_created_duplicate';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contacts
    WHERE id='71000000-0000-0000-0000-000000000010'
      AND patient_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'contact_creation_linked_patient';
  END IF;

  IF (SELECT count(*) FROM public.audit_log WHERE acao='CRM_CONTACT_CREATED' AND detalhe LIKE '%71000000-0000-0000-0000-000000000010%') <> 1 THEN
    RAISE EXCEPTION 'contact_retry_duplicated_audit';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE acao='CRM_CONTACT_CREATED'
      AND (
        detalhe ILIKE '%Contato Secreto%'
        OR detalhe LIKE '%99999-1111%'
        OR detalhe ILIKE '%secret@example.test%'
      )
  ) THEN
    RAISE EXCEPTION 'contact_audit_leaked_pii';
  END IF;
END $$;

SELECT '2) Contact replay with different contract fails explicitly' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_current_clinic_crm_contact(
      '71000000-0000-0000-0000-000000000010',
      'Outro Nome',
      '+55 51 99999-1111',
      'secret@example.test'
    );
    RAISE EXCEPTION 'contact_replay_conflict_unexpectedly_allowed';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '3) admin and reception may create Contact; professional/financeiro may not' AS check;
SET ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000005', false);
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000011',
  'Contato Admin'
);

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000006', false);
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000012',
  'Contato Recep'
);

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_current_clinic_crm_contact(
      '71000000-0000-0000-0000-000000000013',
      'Contato Profissional'
    );
    RAISE EXCEPTION 'professional_crm_write_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_current_clinic_crm_contact(
      '71000000-0000-0000-0000-000000000014',
      'Contato Financeiro'
    );
    RAISE EXCEPTION 'financeiro_crm_write_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '4) disabled crm.access fails closed' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_current_clinic_crm_contact(
      '71000000-0000-0000-0000-000000000015',
      'Contato Clinic B via RPC'
    );
    RAISE EXCEPTION 'disabled_crm_access_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '5) owner creates Lead in default open stage; retry does not duplicate side effects' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000010',
  'Avaliação comercial',
  NULL,
  NULL,
  NULL,
  15000,
  'manual'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000010',
  'Avaliação comercial',
  NULL,
  NULL,
  NULL,
  15000,
  'manual'
);
RESET ROLE;

DO $$
DECLARE
  v_kind text;
BEGIN
  SELECT s.stage_kind INTO v_kind
  FROM public.crm_leads l
  JOIN public.crm_stages s
    ON s.id=l.stage_id
   AND s.pipeline_id=l.pipeline_id
   AND s.clinic_id=l.clinic_id
  WHERE l.id='81000000-0000-0000-0000-000000000001';

  IF v_kind <> 'open' THEN
    RAISE EXCEPTION 'lead_initial_stage_not_open:%', v_kind;
  END IF;

  IF (SELECT count(*) FROM public.crm_lead_activities WHERE lead_id='81000000-0000-0000-0000-000000000001' AND activity_type='lead_created') <> 1 THEN
    RAISE EXCEPTION 'lead_retry_duplicated_creation_activity';
  END IF;

  IF (SELECT count(*) FROM public.audit_log WHERE acao='CRM_LEAD_CREATED' AND detalhe LIKE '%81000000-0000-0000-0000-000000000001%') <> 1 THEN
    RAISE EXCEPTION 'lead_retry_duplicated_creation_audit';
  END IF;
END $$;

SELECT '6) Lead replay conflict, cross-tenant Contact and terminal initial stage fail' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

DO $$
BEGIN
  BEGIN
    PERFORM public.create_current_clinic_crm_lead(
      '81000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000010',
      'Título divergente',
      NULL, NULL, NULL, 15000, 'manual'
    );
    RAISE EXCEPTION 'lead_replay_conflict_unexpectedly_allowed';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.create_current_clinic_crm_lead(
      '81000000-0000-0000-0000-000000000002',
      '71000000-0000-0000-0000-000000000001',
      'Cross tenant'
    );
    RAISE EXCEPTION 'cross_tenant_contact_unexpectedly_allowed';
  EXCEPTION
    WHEN no_data_found THEN NULL;
  END;
END $$;

DO $$
DECLARE
  v_pipeline uuid;
  v_lost uuid;
BEGIN
  SELECT id INTO v_pipeline
  FROM public.crm_pipelines
  WHERE clinic_id='20000000-0000-0000-0000-000000000001'
    AND is_default IS TRUE
    AND archived_at IS NULL;

  SELECT id INTO v_lost
  FROM public.crm_stages
  WHERE pipeline_id=v_pipeline
    AND stage_kind='lost'
    AND archived_at IS NULL;

  BEGIN
    PERFORM public.create_current_clinic_crm_lead(
      '81000000-0000-0000-0000-000000000003',
      '71000000-0000-0000-0000-000000000010',
      'Terminal proibido',
      v_pipeline,
      v_lost
    );
    RAISE EXCEPTION 'terminal_initial_stage_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '7) lost transition is atomic and exact retry is side-effect idempotent' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

DO $$
DECLARE
  v_pipeline uuid;
  v_lost uuid;
BEGIN
  SELECT pipeline_id INTO v_pipeline
  FROM public.crm_leads
  WHERE id='81000000-0000-0000-0000-000000000001';

  SELECT id INTO v_lost
  FROM public.crm_stages
  WHERE pipeline_id=v_pipeline
    AND stage_kind='lost'
    AND archived_at IS NULL;

  PERFORM * FROM public.transition_current_clinic_crm_lead_stage(
    '81000000-0000-0000-0000-000000000001',
    v_lost,
    'no_interest',
    'Sem interesse agora'
  );

  PERFORM * FROM public.transition_current_clinic_crm_lead_stage(
    '81000000-0000-0000-0000-000000000001',
    v_lost,
    'no_interest',
    'Sem interesse agora'
  );
END $$;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE id='81000000-0000-0000-0000-000000000001'
      AND closed_at IS NOT NULL
      AND lost_reason_code='no_interest'
      AND lost_reason_detail='Sem interesse agora'
  ) THEN
    RAISE EXCEPTION 'lost_transition_terminal_state_invalid';
  END IF;

  IF (SELECT count(*) FROM public.crm_lead_activities WHERE lead_id='81000000-0000-0000-0000-000000000001' AND activity_type='stage_changed') <> 1 THEN
    RAISE EXCEPTION 'lost_retry_duplicated_stage_activity';
  END IF;

  IF (SELECT count(*) FROM public.audit_log WHERE acao='CRM_LEAD_STAGE_CHANGED' AND detalhe LIKE '%81000000-0000-0000-0000-000000000001%') <> 1 THEN
    RAISE EXCEPTION 'lost_retry_duplicated_stage_audit';
  END IF;
END $$;

SELECT '8) conflicting same-stage retry is rejected' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_lost uuid;
BEGIN
  SELECT stage_id INTO v_lost
  FROM public.crm_leads
  WHERE id='81000000-0000-0000-0000-000000000001';

  BEGIN
    PERFORM * FROM public.transition_current_clinic_crm_lead_stage(
      '81000000-0000-0000-0000-000000000001',
      v_lost,
      'other_reason',
      'Mudou a justificativa'
    );
    RAISE EXCEPTION 'stage_retry_conflict_unexpectedly_allowed';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '9) won then open transitions derive and clear terminal fields' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_pipeline uuid;
  v_won uuid;
  v_open uuid;
BEGIN
  SELECT pipeline_id INTO v_pipeline
  FROM public.crm_leads
  WHERE id='81000000-0000-0000-0000-000000000001';

  SELECT id INTO v_won FROM public.crm_stages
  WHERE pipeline_id=v_pipeline AND stage_kind='won' AND archived_at IS NULL;

  SELECT id INTO v_open FROM public.crm_stages
  WHERE pipeline_id=v_pipeline AND stage_kind='open' AND archived_at IS NULL
  ORDER BY position LIMIT 1;

  PERFORM * FROM public.transition_current_clinic_crm_lead_stage(
    '81000000-0000-0000-0000-000000000001', v_won
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE id='81000000-0000-0000-0000-000000000001'
      AND stage_id=v_won
      AND closed_at IS NOT NULL
      AND lost_reason_code IS NULL
      AND lost_reason_detail IS NULL
  ) THEN
    RAISE EXCEPTION 'won_transition_state_invalid';
  END IF;

  PERFORM * FROM public.transition_current_clinic_crm_lead_stage(
    '81000000-0000-0000-0000-000000000001', v_open
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE id='81000000-0000-0000-0000-000000000001'
      AND stage_id=v_open
      AND closed_at IS NULL
      AND lost_reason_code IS NULL
      AND lost_reason_detail IS NULL
  ) THEN
    RAISE EXCEPTION 'open_transition_state_invalid';
  END IF;
END $$;
RESET ROLE;

SELECT '10) transition cannot cross pipeline' AS check;
INSERT INTO public.crm_pipelines (
  id, clinic_id, name, is_default
) VALUES (
  '51000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000001',
  'Pipeline secundário',
  false
);

INSERT INTO public.crm_stages (
  id, clinic_id, pipeline_id, name, position, stage_kind
) VALUES (
  '52000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000010',
  'Novo secundário',
  10,
  'open'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.transition_current_clinic_crm_lead_stage(
      '81000000-0000-0000-0000-000000000001',
      '52000000-0000-0000-0000-000000000010'
    );
    RAISE EXCEPTION 'cross_pipeline_transition_unexpectedly_allowed';
  EXCEPTION
    WHEN no_data_found THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '11) authenticated browser still cannot mutate raw Commercial Core tables' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.contacts (clinic_id, name)
    VALUES ('20000000-0000-0000-0000-000000000001', 'Raw bypass');
    RAISE EXCEPTION 'raw_contact_insert_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.crm_leads
    SET title='Raw bypass'
    WHERE id='81000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'raw_lead_update_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '12) Patient and Patient Journey remain untouched' AS check;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.patients) <> 2 THEN
    RAISE EXCEPTION 'patient_count_changed_by_commercial_commands';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.patients
    WHERE funil_stage <> 'lead'
  ) THEN
    RAISE EXCEPTION 'patient_journey_stage_changed_by_commercial_commands';
  END IF;

  IF (SELECT count(*) FROM public.patient_journey_events) <> 0 THEN
    RAISE EXCEPTION 'patient_journey_event_emitted_by_commercial_commands';
  END IF;
END $$;

SELECT 'COMMERCIAL CRM COMMAND BOUNDARY BEHAVIOR CASES PASSED' AS result;
