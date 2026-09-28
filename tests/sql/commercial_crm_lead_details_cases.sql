\set ON_ERROR_STOP on

SELECT '1) owner real change updates only title/value/source and emits bounded evidence' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000080',
  'Contato Detalhes Principal'
);

SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000080',
  '71000000-0000-0000-0000-000000000080',
  'Detalhe inicial',
  NULL,
  NULL,
  NULL,
  1000,
  'seed'
);
RESET ROLE;

CREATE TEMP TABLE medicspro_details_before AS
SELECT
  id,
  contact_id,
  pipeline_id,
  stage_id,
  owner_id,
  closed_at,
  lost_reason_code,
  lost_reason_detail,
  updated_at
FROM public.crm_leads
WHERE id = '81000000-0000-0000-0000-000000000080';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_expected timestamptz;
BEGIN
  SELECT lead_updated_at
    INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id = '81000000-0000-0000-0000-000000000080';

  PERFORM public.update_current_clinic_crm_lead_details(
    '81000000-0000-0000-0000-000000000080',
    v_expected,
    '  Detalhe confidencial X  ',
    987654321,
    '  origem-secreta-x  '
  );
END $$;
RESET ROLE;

DO $$
DECLARE
  v_before medicspro_details_before%ROWTYPE;
  v_after public.crm_leads%ROWTYPE;
BEGIN
  SELECT * INTO v_before FROM medicspro_details_before;
  SELECT * INTO v_after
  FROM public.crm_leads
  WHERE id = '81000000-0000-0000-0000-000000000080';

  IF v_after.title <> 'Detalhe confidencial X'
     OR v_after.value_cents <> 987654321
     OR v_after.source <> 'origem-secreta-x' THEN
    RAISE EXCEPTION 'lead_details_values_not_normalized_or_persisted';
  END IF;

  IF v_after.contact_id IS DISTINCT FROM v_before.contact_id
     OR v_after.pipeline_id IS DISTINCT FROM v_before.pipeline_id
     OR v_after.stage_id IS DISTINCT FROM v_before.stage_id
     OR v_after.owner_id IS DISTINCT FROM v_before.owner_id
     OR v_after.closed_at IS DISTINCT FROM v_before.closed_at
     OR v_after.lost_reason_code IS DISTINCT FROM v_before.lost_reason_code
     OR v_after.lost_reason_detail IS DISTINCT FROM v_before.lost_reason_detail THEN
    RAISE EXCEPTION 'lead_details_mutated_forbidden_lead_fields';
  END IF;

  IF v_after.updated_at IS NOT DISTINCT FROM v_before.updated_at THEN
    RAISE EXCEPTION 'lead_details_updated_at_did_not_advance';
  END IF;

  IF (SELECT count(*)
      FROM public.crm_lead_activities
      WHERE lead_id = v_after.id
        AND activity_type = 'lead_details_updated') <> 1 THEN
    RAISE EXCEPTION 'lead_details_expected_one_activity';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_lead_activities
    WHERE lead_id = v_after.id
      AND activity_type = 'lead_details_updated'
      AND metadata->'changed_fields' = '["title","value_cents","source"]'::jsonb
      AND metadata - 'changed_fields' = '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'lead_details_activity_metadata_not_bounded';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.crm_lead_activities
    WHERE lead_id = v_after.id
      AND activity_type = 'lead_details_updated'
      AND (
        metadata::text ILIKE '%Detalhe confidencial X%'
        OR metadata::text ILIKE '%origem-secreta-x%'
        OR metadata::text LIKE '%987654321%'
      )
  ) THEN
    RAISE EXCEPTION 'lead_details_activity_leaked_values';
  END IF;

  IF (SELECT count(*)
      FROM public.audit_log
      WHERE acao = 'CRM_LEAD_DETAILS_UPDATED'
        AND detalhe LIKE '%81000000-0000-0000-0000-000000000080%') <> 1 THEN
    RAISE EXCEPTION 'lead_details_expected_one_audit';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE acao = 'CRM_LEAD_DETAILS_UPDATED'
      AND detalhe LIKE '%81000000-0000-0000-0000-000000000080%'
      AND (
        detalhe ILIKE '%Detalhe confidencial X%'
        OR detalhe ILIKE '%origem-secreta-x%'
        OR detalhe LIKE '%987654321%'
      )
  ) THEN
    RAISE EXCEPTION 'lead_details_audit_leaked_values';
  END IF;
END $$;

SELECT '2) exact retry accepts the pre-COMMIT token and duplicates no evidence' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_old_expected timestamptz;
BEGIN
  SELECT updated_at INTO v_old_expected FROM medicspro_details_before;

  PERFORM public.update_current_clinic_crm_lead_details(
    '81000000-0000-0000-0000-000000000080',
    v_old_expected,
    'Detalhe confidencial X',
    987654321,
    'origem-secreta-x'
  );
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*)
      FROM public.crm_lead_activities
      WHERE lead_id='81000000-0000-0000-0000-000000000080'
        AND activity_type='lead_details_updated') <> 1 THEN
    RAISE EXCEPTION 'lead_details_retry_duplicated_activity';
  END IF;

  IF (SELECT count(*)
      FROM public.audit_log
      WHERE acao='CRM_LEAD_DETAILS_UPDATED'
        AND detalhe LIKE '%81000000-0000-0000-0000-000000000080%') <> 1 THEN
    RAISE EXCEPTION 'lead_details_retry_duplicated_audit';
  END IF;
END $$;

SELECT '3) stale token with different desired state fails explicitly and never overwrites' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_old_expected timestamptz;
BEGIN
  SELECT updated_at INTO v_old_expected FROM medicspro_details_before;

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000080',
      v_old_expected,
      'Tentativa stale',
      987654321,
      'origem-secreta-x'
    );
    RAISE EXCEPTION 'lead_details_stale_update_unexpectedly_allowed';
  EXCEPTION
    WHEN serialization_failure THEN
      IF SQLERRM <> 'crm_lead_details_stale' THEN
        RAISE;
      END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT title FROM public.crm_leads
      WHERE id='81000000-0000-0000-0000-000000000080')
     <> 'Detalhe confidencial X' THEN
    RAISE EXCEPTION 'lead_details_stale_update_overwrote_state';
  END IF;

  IF (SELECT count(*)
      FROM public.crm_lead_activities
      WHERE lead_id='81000000-0000-0000-0000-000000000080'
        AND activity_type='lead_details_updated') <> 1 THEN
    RAISE EXCEPTION 'lead_details_stale_update_emitted_activity';
  END IF;
END $$;

SELECT '4) source whitespace normalizes to NULL as a real bounded change' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_expected timestamptz;
BEGIN
  SELECT lead_updated_at INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000080';

  PERFORM public.update_current_clinic_crm_lead_details(
    '81000000-0000-0000-0000-000000000080',
    v_expected,
    'Detalhe confidencial X',
    987654321,
    '   '
  );
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT source FROM public.crm_leads
      WHERE id='81000000-0000-0000-0000-000000000080') IS NOT NULL THEN
    RAISE EXCEPTION 'lead_details_source_whitespace_not_null';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_lead_activities
    WHERE lead_id='81000000-0000-0000-0000-000000000080'
      AND activity_type='lead_details_updated'
      AND metadata->'changed_fields' = '["source"]'::jsonb
  ) THEN
    RAISE EXCEPTION 'lead_details_source_change_fields_invalid';
  END IF;
END $$;

SELECT '5) admin and reception may change Lead details' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000081',
  'Contato Detalhes Admin'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000081',
  '71000000-0000-0000-0000-000000000081',
  'Admin inicial'
);

SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000082',
  'Contato Detalhes Recep'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000082',
  '71000000-0000-0000-0000-000000000082',
  'Recep inicial'
);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000005', false);
DO $$
DECLARE v_expected timestamptz;
BEGIN
  SELECT lead_updated_at INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000081';

  PERFORM public.update_current_clinic_crm_lead_details(
    '81000000-0000-0000-0000-000000000081',
    v_expected,
    'Admin atualizado',
    2500,
    'admin'
  );
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000006', false);
DO $$
DECLARE v_expected timestamptz;
BEGIN
  SELECT lead_updated_at INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000082';

  PERFORM public.update_current_clinic_crm_lead_details(
    '81000000-0000-0000-0000-000000000082',
    v_expected,
    'Recep atualizado',
    3500,
    'recep'
  );
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT title FROM public.crm_leads
      WHERE id='81000000-0000-0000-0000-000000000081') <> 'Admin atualizado'
     OR (SELECT title FROM public.crm_leads
         WHERE id='81000000-0000-0000-0000-000000000082') <> 'Recep atualizado' THEN
    RAISE EXCEPTION 'lead_details_writer_roles_failed';
  END IF;
END $$;

SELECT '6) professional and financeiro remain read-only' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', false);
DO $$
DECLARE v_expected timestamptz;
BEGIN
  SELECT lead_updated_at INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000081';

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000081',
      v_expected,
      'Professional indevido',
      2500,
      'admin'
    );
    RAISE EXCEPTION 'professional_lead_details_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', false);
DO $$
DECLARE v_expected timestamptz;
BEGIN
  SELECT lead_updated_at INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000082';

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000082',
      v_expected,
      'Financeiro indevido',
      3500,
      'recep'
    );
    RAISE EXCEPTION 'financeiro_lead_details_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '7) crm.access disabled, cross-tenant, missing and deleted Leads fail closed' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '80000000-0000-0000-0000-000000000006',
      now(),
      'Clinic B bloqueado',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'disabled_crm_access_details_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '80000000-0000-0000-0000-000000000006',
      now(),
      'Cross tenant',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'cross_tenant_lead_details_unexpectedly_allowed';
  EXCEPTION
    WHEN no_data_found THEN NULL;
  END;

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000099',
      now(),
      'Missing',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'missing_lead_details_unexpectedly_allowed';
  EXCEPTION
    WHEN no_data_found THEN NULL;
  END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000083',
  'Contato Lead Deleted'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000083',
  '71000000-0000-0000-0000-000000000083',
  'Lead a deletar'
);
RESET ROLE;

UPDATE public.crm_leads
SET deleted_at = now()
WHERE id='81000000-0000-0000-0000-000000000083';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000083',
      now(),
      'Lead deletado',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'deleted_lead_details_unexpectedly_allowed';
  EXCEPTION
    WHEN no_data_found THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '8) invalid title and negative value fail before mutation evidence' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_expected timestamptz;
BEGIN
  SELECT lead_updated_at INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000081';

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000081',
      v_expected,
      '   ',
      2500,
      'admin'
    );
    RAISE EXCEPTION 'empty_lead_title_unexpectedly_allowed';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000081',
      v_expected,
      'Admin atualizado',
      -1,
      'admin'
    );
    RAISE EXCEPTION 'negative_lead_value_unexpectedly_allowed';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '9) anonymized or deleted Contact blocks a real change server-side' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000084',
  'Contato Anon Details'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000084',
  '71000000-0000-0000-0000-000000000084',
  'Anon details inicial'
);
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000085',
  'Contato Deleted Details'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000085',
  '71000000-0000-0000-0000-000000000085',
  'Deleted details inicial'
);
RESET ROLE;

UPDATE public.contacts
SET anonymized_at = now()
WHERE id='71000000-0000-0000-0000-000000000084';

UPDATE public.contacts
SET deleted_at = now()
WHERE id='71000000-0000-0000-0000-000000000085';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_expected timestamptz;
BEGIN
  SELECT lead_updated_at INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000084';

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000084',
      v_expected,
      'Anon details alterado',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'anonymized_contact_details_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM <> 'crm_lead_contact_not_mutable' THEN RAISE; END IF;
  END;

  SELECT lead_updated_at INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000085';

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000085',
      v_expected,
      'Deleted details alterado',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'deleted_contact_details_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM <> 'crm_lead_contact_not_mutable' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.crm_lead_activities
    WHERE lead_id IN (
      '81000000-0000-0000-0000-000000000084',
      '81000000-0000-0000-0000-000000000085'
    )
      AND activity_type='lead_details_updated'
  ) THEN
    RAISE EXCEPTION 'contact_lifecycle_rejection_emitted_details_activity';
  END IF;
END $$;

SELECT '10) archived pipeline blocks real change but exact pre-COMMIT retry remains valid' AS check;
INSERT INTO public.crm_pipelines (
  id, clinic_id, name, is_default
) VALUES (
  '51000000-0000-0000-0000-000000000086',
  '20000000-0000-0000-0000-000000000001',
  'Pipeline Details Retry',
  false
);

INSERT INTO public.crm_stages (
  id, clinic_id, pipeline_id, name, position, stage_kind
) VALUES (
  '52000000-0000-0000-0000-000000000086',
  '20000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000086',
  'Novo Details Retry',
  10,
  'open'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000086',
  'Contato Pipeline Details'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000086',
  '71000000-0000-0000-0000-000000000086',
  'Pipeline details inicial',
  '51000000-0000-0000-0000-000000000086',
  '52000000-0000-0000-0000-000000000086'
);
RESET ROLE;

CREATE TEMP TABLE medicspro_details_archive_retry AS
SELECT updated_at
FROM public.crm_leads
WHERE id='81000000-0000-0000-0000-000000000086';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_expected timestamptz;
BEGIN
  SELECT updated_at INTO v_expected FROM medicspro_details_archive_retry;
  PERFORM public.update_current_clinic_crm_lead_details(
    '81000000-0000-0000-0000-000000000086',
    v_expected,
    'Pipeline details persistido',
    8600,
    'pipeline'
  );
END $$;
RESET ROLE;

UPDATE public.crm_pipelines
SET archived_at = now()
WHERE id='51000000-0000-0000-0000-000000000086';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_old_expected timestamptz;
  v_current_expected timestamptz;
BEGIN
  SELECT updated_at INTO v_old_expected FROM medicspro_details_archive_retry;

  -- Exact replay succeeds before archive/privacy/stale guards.
  PERFORM public.update_current_clinic_crm_lead_details(
    '81000000-0000-0000-0000-000000000086',
    v_old_expected,
    'Pipeline details persistido',
    8600,
    'pipeline'
  );

  SELECT lead_updated_at INTO v_current_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000086';

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000086',
      v_current_expected,
      'Pipeline details proibido',
      8600,
      'pipeline'
    );
    RAISE EXCEPTION 'archived_pipeline_details_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM <> 'crm_lead_details_current_pipeline_archived' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*)
      FROM public.crm_lead_activities
      WHERE lead_id='81000000-0000-0000-0000-000000000086'
        AND activity_type='lead_details_updated') <> 1 THEN
    RAISE EXCEPTION 'archived_pipeline_retry_or_rejection_duplicated_activity';
  END IF;

  IF (SELECT title FROM public.crm_leads
      WHERE id='81000000-0000-0000-0000-000000000086')
     <> 'Pipeline details persistido' THEN
    RAISE EXCEPTION 'archived_pipeline_rejection_changed_details';
  END IF;
END $$;

SELECT '11) archived stage blocks a real change server-side' AS check;
INSERT INTO public.crm_pipelines (
  id, clinic_id, name, is_default
) VALUES (
  '51000000-0000-0000-0000-000000000087',
  '20000000-0000-0000-0000-000000000001',
  'Pipeline Stage Details',
  false
);

INSERT INTO public.crm_stages (
  id, clinic_id, pipeline_id, name, position, stage_kind
) VALUES (
  '52000000-0000-0000-0000-000000000087',
  '20000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000087',
  'Stage Details',
  10,
  'open'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
SELECT public.create_current_clinic_crm_contact(
  '71000000-0000-0000-0000-000000000087',
  'Contato Stage Details'
);
SELECT public.create_current_clinic_crm_lead(
  '81000000-0000-0000-0000-000000000087',
  '71000000-0000-0000-0000-000000000087',
  'Stage details inicial',
  '51000000-0000-0000-0000-000000000087',
  '52000000-0000-0000-0000-000000000087'
);
RESET ROLE;

UPDATE public.crm_stages
SET archived_at = now()
WHERE id='52000000-0000-0000-0000-000000000087';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_expected timestamptz;
BEGIN
  SELECT lead_updated_at INTO v_expected
  FROM public.list_current_clinic_crm_leads()
  WHERE lead_id='81000000-0000-0000-0000-000000000087';

  BEGIN
    PERFORM public.update_current_clinic_crm_lead_details(
      '81000000-0000-0000-0000-000000000087',
      v_expected,
      'Stage details proibido',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'archived_stage_details_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM <> 'crm_lead_details_current_stage_archived' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.crm_lead_activities
    WHERE lead_id='81000000-0000-0000-0000-000000000087'
      AND activity_type='lead_details_updated'
  ) THEN
    RAISE EXCEPTION 'archived_stage_rejection_emitted_activity';
  END IF;
END $$;

SELECT '12) authenticated raw Lead UPDATE remains denied' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    UPDATE public.crm_leads
    SET title='Raw details bypass'
    WHERE id='81000000-0000-0000-0000-000000000080';
    RAISE EXCEPTION 'raw_lead_details_update_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '13) Patient and Patient Journey remain untouched' AS check;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.patients) <> 2
     OR EXISTS (SELECT 1 FROM public.patients WHERE funil_stage <> 'lead')
     OR (SELECT count(*) FROM public.patient_journey_events) <> 0 THEN
    RAISE EXCEPTION 'lead_details_touched_patient_domain';
  END IF;
END $$;

SELECT 'COMMERCIAL CRM LEAD DETAILS BEHAVIOR CASES PASSED' AS result;
