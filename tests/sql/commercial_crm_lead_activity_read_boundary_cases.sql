\set ON_ERROR_STOP on

-- Additional reader-role fixtures are deliberately local to this behavior proof.
INSERT INTO auth.users (id, email) VALUES
  ('40000000-0000-0000-0000-000000000021', 'admin-activity-read@example.test'),
  ('40000000-0000-0000-0000-000000000022', 'recep-activity-read@example.test'),
  ('40000000-0000-0000-0000-000000000023', 'inactive-activity-read@example.test'),
  ('40000000-0000-0000-0000-000000000024', 'no-profile-activity-read@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, clinic_id, role, ativo) VALUES
  ('40000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000001', 'admin', true),
  ('40000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000001', 'recep', true),
  ('40000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000001', 'professional', false)
ON CONFLICT (id) DO UPDATE
SET clinic_id = EXCLUDED.clinic_id,
    role = EXCLUDED.role,
    ativo = EXCLUDED.ativo;

SELECT '1) seed one Lead and internal activities with deliberately over-broad metadata' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000099',
  'Contato Activity Boundary'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000099',
  '71000000-0000-0000-0000-000000000099',
  'Lead Activity Boundary'
);

-- A second Lead is used to prove invalid resolution_mode fail-closed without
-- violating the existing exactly-once contact_identity_resolved invariant.
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000097',
  'Contato Invalid Resolution Boundary'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000097',
  '71000000-0000-0000-0000-000000000097',
  'Lead Invalid Resolution Boundary'
);
RESET ROLE;

INSERT INTO public.crm_lead_activities (
  id, clinic_id, lead_id, activity_type, actor_id, actor_kind, metadata, created_at
) VALUES
  (
    '91000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000099',
    'stage_changed',
    '40000000-0000-0000-0000-000000000001',
    'human',
    jsonb_build_object(
      'from_stage_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'to_stage_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'stage_kind', 'lost',
      'lost_reason_code', 'secret-code',
      'lost_reason_detail', 'SEGREDO LIVRE',
      'future_secret', 'stage-secret'
    ),
    now() + interval '1 second'
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000099',
    'contact_identity_resolved',
    '40000000-0000-0000-0000-000000000001',
    'human',
    jsonb_build_object(
      'resolution_mode', 'explicit_reuse',
      'requested_contact_id', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'resolved_contact_id', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'candidate_ids', jsonb_build_array('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
      'match_reasons', jsonb_build_array('phone_exact'),
      'distinct_reason', 'SEGREDO DISTINTO',
      'future_secret', 'identity-secret'
    ),
    now() + interval '2 seconds'
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000097',
    'contact_identity_resolved',
    '40000000-0000-0000-0000-000000000001',
    'automation',
    '{"resolution_mode":"future_mode","candidate_ids":["secret"],"future_secret":"x"}'::jsonb,
    now() + interval '3 seconds'
  ),
  (
    '91000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000099',
    'future_activity_type',
    '40000000-0000-0000-0000-000000000001',
    'api',
    '{"patient_id":"must-not-cross","arbitrary":"secret"}'::jsonb,
    now() + interval '4 seconds'
  );

SELECT '2) owner receives only the reviewed projection while canonical storage remains intact' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_stage record;
  v_identity record;
  v_invalid record;
  v_unknown record;
BEGIN
  SELECT * INTO v_stage
  FROM public.list_current_clinic_crm_lead_activities(
    '81000000-0000-0000-0000-000000000099'
  )
  WHERE id='91000000-0000-0000-0000-000000000001';

  IF v_stage.actor_id IS NOT NULL
     OR v_stage.actor_kind <> 'human'
     OR v_stage.metadata <> jsonb_build_object(
       'from_stage_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'to_stage_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     ) THEN
    RAISE EXCEPTION 'stage_activity_projection_not_bounded:%', row_to_json(v_stage);
  END IF;

  SELECT * INTO v_identity
  FROM public.list_current_clinic_crm_lead_activities(
    '81000000-0000-0000-0000-000000000099'
  )
  WHERE id='91000000-0000-0000-0000-000000000002';

  IF v_identity.actor_id IS NOT NULL
     OR v_identity.actor_kind <> 'human'
     OR v_identity.metadata <> '{"resolution_mode":"explicit_reuse"}'::jsonb THEN
    RAISE EXCEPTION 'identity_activity_projection_not_bounded:%', row_to_json(v_identity);
  END IF;

  SELECT * INTO v_invalid
  FROM public.list_current_clinic_crm_lead_activities(
    '81000000-0000-0000-0000-000000000097'
  )
  WHERE id='91000000-0000-0000-0000-000000000003';

  IF v_invalid.actor_id IS NOT NULL
     OR v_invalid.actor_kind <> 'automation'
     OR v_invalid.metadata <> '{}'::jsonb THEN
    RAISE EXCEPTION 'invalid_resolution_mode_not_fail_closed:%', row_to_json(v_invalid);
  END IF;

  SELECT * INTO v_unknown
  FROM public.list_current_clinic_crm_lead_activities(
    '81000000-0000-0000-0000-000000000099'
  )
  WHERE id='91000000-0000-0000-0000-000000000004';

  IF v_unknown.actor_id IS NOT NULL
     OR v_unknown.actor_kind <> 'api'
     OR v_unknown.metadata <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unknown_activity_not_fail_closed:%', row_to_json(v_unknown);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000099'
    ) r
    WHERE r.actor_id IS NOT NULL
       OR r.metadata ? 'lost_reason_code'
       OR r.metadata ? 'lost_reason_detail'
       OR r.metadata ? 'candidate_ids'
       OR r.metadata ? 'match_reasons'
       OR r.metadata ? 'distinct_reason'
       OR r.metadata ? 'requested_contact_id'
       OR r.metadata ? 'resolved_contact_id'
       OR r.metadata ? 'patient_id'
       OR r.metadata ? 'future_secret'
       OR r.metadata ? 'arbitrary'
  ) THEN
    RAISE EXCEPTION 'activity_reader_leaked_internal_metadata';
  END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_lead_activities
    WHERE id='91000000-0000-0000-0000-000000000002'
      AND actor_id='40000000-0000-0000-0000-000000000001'
      AND metadata->>'requested_contact_id'='cccccccc-cccc-cccc-cccc-cccccccccccc'
      AND metadata->>'resolved_contact_id'='dddddddd-dddd-dddd-dddd-dddddddddddd'
      AND metadata->'candidate_ids' IS NOT NULL
      AND metadata->'match_reasons' IS NOT NULL
      AND metadata->>'distinct_reason'='SEGREDO DISTINTO'
  ) THEN
    RAISE EXCEPTION 'canonical_activity_storage_was_not_preserved';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_lead_activities
    WHERE id='91000000-0000-0000-0000-000000000001'
      AND metadata->>'lost_reason_detail'='SEGREDO LIVRE'
      AND metadata->>'future_secret'='stage-secret'
  ) THEN
    RAISE EXCEPTION 'canonical_stage_activity_storage_was_not_preserved';
  END IF;
END $$;

SELECT '3) every released current-clinic reader role receives the same bounded projection' AS check;
SET ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000099'
    )
    WHERE id='91000000-0000-0000-0000-000000000002'
      AND actor_id IS NULL
      AND metadata='{"resolution_mode":"explicit_reuse"}'::jsonb
  ) THEN RAISE EXCEPTION 'owner_bounded_activity_read_failed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000021', false);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000099'
    ) WHERE id='91000000-0000-0000-0000-000000000004' AND metadata='{}'::jsonb
  ) THEN RAISE EXCEPTION 'admin_bounded_activity_read_failed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000022', false);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000099'
    ) WHERE id='91000000-0000-0000-0000-000000000004' AND metadata='{}'::jsonb
  ) THEN RAISE EXCEPTION 'recep_bounded_activity_read_failed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', false);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000099'
    ) WHERE id='91000000-0000-0000-0000-000000000002'
      AND actor_id IS NULL
      AND metadata='{"resolution_mode":"explicit_reuse"}'::jsonb
  ) THEN RAISE EXCEPTION 'professional_bounded_activity_read_failed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', false);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000099'
    ) WHERE id='91000000-0000-0000-0000-000000000002'
      AND actor_id IS NULL
      AND metadata='{"resolution_mode":"explicit_reuse"}'::jsonb
  ) THEN RAISE EXCEPTION 'financeiro_bounded_activity_read_failed'; END IF;
END $$;
RESET ROLE;

SELECT '4) cross-tenant Lead lookup fails before timeline projection' AS check;
DO $fixture$
DECLARE
  v_pipeline uuid;
  v_stage uuid;
BEGIN
  SELECT id INTO v_pipeline
  FROM public.crm_pipelines
  WHERE clinic_id='20000000-0000-0000-0000-000000000002'
    AND is_default IS TRUE
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO v_stage
  FROM public.crm_stages
  WHERE clinic_id='20000000-0000-0000-0000-000000000002'
    AND pipeline_id=v_pipeline
    AND stage_kind='open'
  ORDER BY position
  LIMIT 1;

  INSERT INTO public.contacts (id, clinic_id, name)
  VALUES (
    '71000000-0000-0000-0000-000000000098',
    '20000000-0000-0000-0000-000000000002',
    'Cross Tenant Activity Contact'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.crm_leads (
    id, clinic_id, contact_id, pipeline_id, stage_id, title
  ) VALUES (
    '81000000-0000-0000-0000-000000000098',
    '20000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000098',
    v_pipeline,
    v_stage,
    'Cross Tenant Activity Lead'
  )
  ON CONFLICT (id) DO NOTHING;
END $fixture$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000098'
    );
    RAISE EXCEPTION 'cross_tenant_activity_reader_unexpectedly_allowed';
  EXCEPTION
    WHEN no_data_found THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '5) anonymous, inactive/no-profile and missing crm.access fail closed' AS check;
SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000099'
    );
    RAISE EXCEPTION 'anonymous_activity_reader_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000023', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000099'
    );
    RAISE EXCEPTION 'inactive_profile_activity_reader_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000024', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000099'
    );
    RAISE EXCEPTION 'missing_profile_activity_reader_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_lead_activities(
      '81000000-0000-0000-0000-000000000098'
    );
    RAISE EXCEPTION 'missing_crm_access_activity_reader_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '6) raw authenticated activity DML remains closed' AS check;
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.crm_lead_activities', 'INSERT')
     OR has_table_privilege('authenticated', 'public.crm_lead_activities', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.crm_lead_activities', 'DELETE') THEN
    RAISE EXCEPTION 'raw_activity_dml_browser_privilege_regressed';
  END IF;
END $$;

SELECT 'COMMERCIAL CRM LEAD ACTIVITY READ BOUNDARY BEHAVIOR CASES PASSED' AS result;
