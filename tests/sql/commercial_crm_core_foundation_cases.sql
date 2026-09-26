\set ON_ERROR_STOP on

SELECT '1) migration does not fabricate Contacts or Leads from Patients' AS check;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.contacts) <> 0
     OR (SELECT count(*) FROM public.crm_leads) <> 0 THEN
    RAISE EXCEPTION 'commercial_history_was_fabricated';
  END IF;
END $$;

SELECT '2) generic default pipeline exists for both fixture clinics' AS check;
DO $$
DECLARE
  v_clinic uuid;
  v_pipeline uuid;
BEGIN
  FOREACH v_clinic IN ARRAY ARRAY[
    '20000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid
  ]
  LOOP
    SELECT p.id INTO v_pipeline
    FROM public.crm_pipelines p
    WHERE p.clinic_id = v_clinic
      AND p.is_default IS TRUE
      AND p.archived_at IS NULL;

    IF v_pipeline IS NULL THEN
      RAISE EXCEPTION 'fixture_default_pipeline_missing:%', v_clinic;
    END IF;

    IF (SELECT count(*) FROM public.crm_stages s WHERE s.pipeline_id=v_pipeline AND s.archived_at IS NULL AND s.stage_kind='won') <> 1
       OR (SELECT count(*) FROM public.crm_stages s WHERE s.pipeline_id=v_pipeline AND s.archived_at IS NULL AND s.stage_kind='lost') <> 1
       OR (SELECT count(*) FROM public.crm_stages s WHERE s.pipeline_id=v_pipeline AND s.archived_at IS NULL AND s.stage_kind='open') < 1 THEN
      RAISE EXCEPTION 'fixture_default_pipeline_shape_invalid:%', v_clinic;
    END IF;
  END LOOP;
END $$;

SELECT '3) Contact may link only to Patient in the same clinic' AS check;
INSERT INTO public.contacts (
  id, clinic_id, name, phone, phone_normalized, patient_id
) VALUES (
  '70000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Contato A',
  '(51) 99999-0001',
  '51999990001',
  '60000000-0000-0000-0000-000000000001'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.contacts (
      id, clinic_id, name, patient_id
    ) VALUES (
      '70000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      'Contato inválido',
      '60000000-0000-0000-0000-000000000002'
    );
    RAISE EXCEPTION 'cross_tenant_contact_patient_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END $$;

SELECT '4) One active Contact per Patient; phone/email are not identity keys' AS check;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.contacts (
      id, clinic_id, name, patient_id
    ) VALUES (
      '70000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000001',
      'Contato duplicado',
      '60000000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'duplicate_active_patient_contact_unexpectedly_allowed';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  INSERT INTO public.contacts (
    id, clinic_id, name, phone, phone_normalized
  ) VALUES (
    '70000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    'Mesmo telefone sem merge',
    '(51) 99999-0001',
    '51999990001'
  );
END $$;

INSERT INTO public.contacts (
  id, clinic_id, name, phone
) VALUES (
  '70000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000002',
  'Contato B',
  '(11) 98888-0002'
);

SELECT '5) Open/won/lost semantics are stage-driven' AS check;
DO $$
DECLARE
  v_pipeline_a uuid;
  v_open_a uuid;
  v_won_a uuid;
  v_lost_a uuid;
BEGIN
  SELECT id INTO v_pipeline_a
  FROM public.crm_pipelines
  WHERE clinic_id='20000000-0000-0000-0000-000000000001'
    AND is_default IS TRUE
    AND archived_at IS NULL;

  SELECT id INTO v_open_a FROM public.crm_stages
  WHERE pipeline_id=v_pipeline_a AND stage_kind='open' AND archived_at IS NULL
  ORDER BY position LIMIT 1;

  SELECT id INTO v_won_a FROM public.crm_stages
  WHERE pipeline_id=v_pipeline_a AND stage_kind='won' AND archived_at IS NULL;

  SELECT id INTO v_lost_a FROM public.crm_stages
  WHERE pipeline_id=v_pipeline_a AND stage_kind='lost' AND archived_at IS NULL;

  INSERT INTO public.crm_leads (
    id, clinic_id, contact_id, pipeline_id, stage_id, owner_id, title
  ) VALUES (
    '80000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    v_pipeline_a,
    v_open_a,
    '40000000-0000-0000-0000-000000000001',
    'Oportunidade A'
  );

  BEGIN
    INSERT INTO public.crm_leads (
      id, clinic_id, contact_id, pipeline_id, stage_id, title, closed_at
    ) VALUES (
      '80000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000004',
      v_pipeline_a,
      v_open_a,
      'Open não pode fechar',
      now()
    );
    RAISE EXCEPTION 'open_lead_closed_at_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.crm_leads (
      id, clinic_id, contact_id, pipeline_id, stage_id, title, closed_at
    ) VALUES (
      '80000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000004',
      v_pipeline_a,
      v_lost_a,
      'Lost sem motivo',
      now()
    );
    RAISE EXCEPTION 'lost_lead_without_reason_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.crm_leads (
      id, clinic_id, contact_id, pipeline_id, stage_id, title, closed_at, lost_reason_code
    ) VALUES (
      '80000000-0000-0000-0000-000000000004',
      '20000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000004',
      v_pipeline_a,
      v_won_a,
      'Won com motivo de perda',
      now(),
      'price'
    );
    RAISE EXCEPTION 'won_lead_with_lost_reason_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.crm_leads (
    id, clinic_id, contact_id, pipeline_id, stage_id, title, closed_at, lost_reason_code
  ) VALUES (
    '80000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000004',
    v_pipeline_a,
    v_lost_a,
    'Lost válido',
    now(),
    'no_interest'
  );
END $$;

SELECT '6) Lead owner and activity actor cannot cross tenants' AS check;
DO $$
BEGIN
  BEGIN
    UPDATE public.crm_leads
    SET owner_id='40000000-0000-0000-0000-000000000004'
    WHERE id='80000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'cross_tenant_lead_owner_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.crm_lead_activities (
      clinic_id, lead_id, activity_type, actor_id, actor_kind
    ) VALUES (
      '20000000-0000-0000-0000-000000000001',
      '80000000-0000-0000-0000-000000000001',
      'note',
      '40000000-0000-0000-0000-000000000004',
      'human'
    );
    RAISE EXCEPTION 'cross_tenant_activity_actor_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.crm_lead_activities (
    id, clinic_id, lead_id, activity_type, actor_id, actor_kind, metadata
  ) VALUES (
    '90000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'created',
    '40000000-0000-0000-0000-000000000001',
    'human',
    '{"source":"fixture"}'::jsonb
  );
END $$;

SELECT '7) create one Clinic B Lead for isolation checks' AS check;
DO $$
DECLARE
  v_pipeline_b uuid;
  v_open_b uuid;
BEGIN
  SELECT id INTO v_pipeline_b
  FROM public.crm_pipelines
  WHERE clinic_id='20000000-0000-0000-0000-000000000002'
    AND is_default IS TRUE
    AND archived_at IS NULL;

  SELECT id INTO v_open_b
  FROM public.crm_stages
  WHERE pipeline_id=v_pipeline_b AND stage_kind='open' AND archived_at IS NULL
  ORDER BY position LIMIT 1;

  INSERT INTO public.crm_leads (
    id, clinic_id, contact_id, pipeline_id, stage_id, owner_id, title
  ) VALUES (
    '80000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000005',
    v_pipeline_b,
    v_open_b,
    '40000000-0000-0000-0000-000000000004',
    'Oportunidade B'
  );
END $$;

SELECT '8) owner/professional/financeiro read only the current enabled clinic' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.list_current_clinic_crm_leads();
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'owner_a_expected_2_leads_got_%', v_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.list_current_clinic_crm_leads()
    WHERE contact_name='Contato B'
  ) THEN
    RAISE EXCEPTION 'owner_a_cross_tenant_lead_visible';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', false);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.list_current_clinic_crm_pipelines();
  IF v_count < 1 THEN
    RAISE EXCEPTION 'professional_crm_read_unexpectedly_empty';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', false);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.list_current_clinic_crm_pipelines();
  IF v_count < 1 THEN
    RAISE EXCEPTION 'financeiro_crm_read_unexpectedly_empty';
  END IF;
END $$;
RESET ROLE;

SELECT '9) disabled crm.access fails closed for Clinic B' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_pipelines();
    RAISE EXCEPTION 'disabled_crm_entitlement_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '10) authenticated browser cannot DML raw Commercial Core tables' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.contacts (clinic_id, name)
    VALUES ('20000000-0000-0000-0000-000000000001', 'Bypass');
    RAISE EXCEPTION 'authenticated_contact_insert_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.crm_leads SET title='Bypass';
    RAISE EXCEPTION 'authenticated_lead_update_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    DELETE FROM public.crm_lead_activities;
    RAISE EXCEPTION 'authenticated_activity_delete_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '11) activity read validates lead tenant before returning timeline' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.list_current_clinic_crm_lead_activities(
    '80000000-0000-0000-0000-000000000001'
  );
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'lead_activity_read_expected_1_got_%', v_count;
  END IF;

  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_lead_activities(
      '80000000-0000-0000-0000-000000000006'
    );
    RAISE EXCEPTION 'cross_tenant_activity_read_unexpectedly_allowed';
  EXCEPTION
    WHEN no_data_found THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT 'COMMERCIAL CRM CORE FOUNDATION BEHAVIOR CASES PASSED' AS result;
