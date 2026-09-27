\set ON_ERROR_STOP on

SELECT '1) canonical phone/email normalization is deterministic and conservative' AS check;
DO $$
DECLARE
  v_variants text[];
BEGIN
  IF public.crm_normalize_contact_phone('(51) 99999-1111') <> '+5551999991111' THEN
    RAISE EXCEPTION 'crm_phone_br_national_normalization_invalid';
  END IF;

  IF public.crm_normalize_contact_phone('+55 51 99999-1111') <> '+5551999991111' THEN
    RAISE EXCEPTION 'crm_phone_br_plus55_normalization_invalid';
  END IF;

  IF public.crm_normalize_contact_phone('+1 (415) 555-2671') <> '+14155552671' THEN
    RAISE EXCEPTION 'crm_phone_explicit_international_normalization_invalid';
  END IF;

  IF public.crm_normalize_contact_phone('12345') IS NOT NULL THEN
    RAISE EXCEPTION 'crm_phone_ambiguous_short_input_should_not_be_signal';
  END IF;

  IF public.crm_normalize_contact_email('Local.Part@Example.COM') <> 'Local.Part@example.com' THEN
    RAISE EXCEPTION 'crm_email_domain_normalization_invalid';
  END IF;

  IF public.crm_normalize_contact_email('Local.Part+tag@Example.COM') <> 'Local.Part+tag@example.com' THEN
    RAISE EXCEPTION 'crm_email_plus_tag_was_rewritten';
  END IF;

  v_variants := public.crm_contact_phone_candidate_variants('+55 51 97777-0000');
  IF NOT ('+5551977770000' = ANY(v_variants))
     OR NOT ('+555177770000' = ANY(v_variants)) THEN
    RAISE EXCEPTION 'crm_phone_br_legacy_variants_missing:%', v_variants;
  END IF;
END $$;

-- Legacy active Contacts intentionally keep normalized columns NULL to prove
-- candidate fallback without a mass backfill.
INSERT INTO public.contacts (
  id, clinic_id, name, phone, email, phone_normalized, email_normalized
) VALUES
  (
    '72000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Legacy Phone',
    '+55 51 98888-0001',
    NULL,
    NULL,
    NULL
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'Legacy Email',
    NULL,
    'Case.Local@Example.COM',
    NULL,
    NULL
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'Split Phone',
    '+55 51 98888-0003',
    NULL,
    NULL,
    NULL
  ),
  (
    '72000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    'Split Email',
    NULL,
    'split@example.test',
    NULL,
    NULL
  ),
  (
    '72000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001',
    'Legacy Ninth Digit',
    '+55 51 7777-0005',
    NULL,
    NULL,
    NULL
  );

SELECT '2) writer preview finds legacy NULL-normalized exact phone/email and BR legacy variant' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

DO $$
DECLARE
  v_reasons text[];
BEGIN
  SELECT match_reasons
    INTO v_reasons
  FROM public.list_current_clinic_crm_contact_identity_candidates(
    '+55 51 98888-0001',
    NULL
  )
  WHERE contact_id='72000000-0000-0000-0000-000000000001';

  IF v_reasons IS NULL OR NOT ('phone_exact' = ANY(v_reasons)) THEN
    RAISE EXCEPTION 'crm_legacy_null_phone_candidate_missing:%', v_reasons;
  END IF;

  SELECT match_reasons
    INTO v_reasons
  FROM public.list_current_clinic_crm_contact_identity_candidates(
    NULL,
    'Case.Local@example.com'
  )
  WHERE contact_id='72000000-0000-0000-0000-000000000002';

  IF v_reasons IS NULL OR NOT ('email_exact' = ANY(v_reasons)) THEN
    RAISE EXCEPTION 'crm_legacy_null_email_candidate_missing:%', v_reasons;
  END IF;

  SELECT match_reasons
    INTO v_reasons
  FROM public.list_current_clinic_crm_contact_identity_candidates(
    '+55 51 97777-0005',
    NULL
  )
  WHERE contact_id='72000000-0000-0000-0000-000000000005';

  IF v_reasons IS NULL OR NOT ('phone_br_legacy_variant' = ANY(v_reasons)) THEN
    RAISE EXCEPTION 'crm_br_legacy_variant_candidate_missing:%', v_reasons;
  END IF;
END $$;
RESET ROLE;

SELECT '3) professional and financeiro cannot use identity candidate preview' AS check;
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', false);
  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_contact_identity_candidates('+55 51 98888-0001', NULL);
    RAISE EXCEPTION 'professional_identity_preview_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', false);
  BEGIN
    PERFORM * FROM public.list_current_clinic_crm_contact_identity_candidates('+55 51 98888-0001', NULL);
    RAISE EXCEPTION 'financeiro_identity_preview_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '4) deleted/anonymized Contacts are excluded without tombstone disclosure' AS check;
INSERT INTO public.contacts (id, clinic_id, name, phone, deleted_at)
VALUES (
  '72000000-0000-0000-0000-000000000006',
  '20000000-0000-0000-0000-000000000001',
  'Deleted Identity',
  '+55 51 98888-0006',
  now()
);

INSERT INTO public.contacts (id, clinic_id, name, phone, anonymized_at)
VALUES (
  '72000000-0000-0000-0000-000000000007',
  '20000000-0000-0000-0000-000000000001',
  'Anonymized Identity',
  '+55 51 98888-0007',
  now()
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.list_current_clinic_crm_contact_identity_candidates('+55 51 98888-0006', NULL)
  ) THEN
    RAISE EXCEPTION 'deleted_identity_candidate_leaked';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.list_current_clinic_crm_contact_identity_candidates('+55 51 98888-0007', NULL)
  ) THEN
    RAISE EXCEPTION 'anonymized_identity_candidate_leaked';
  END IF;
END $$;
RESET ROLE;

SELECT '5) phone->A + email->B returns an explicit multi-candidate conflict set' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(contact_id ORDER BY contact_id)
    INTO v_ids
  FROM public.list_current_clinic_crm_contact_identity_candidates(
    '+55 51 98888-0003',
    'split@example.test'
  );

  IF v_ids IS DISTINCT FROM ARRAY[
    '72000000-0000-0000-0000-000000000003'::uuid,
    '72000000-0000-0000-0000-000000000004'::uuid
  ] THEN
    RAISE EXCEPTION 'crm_split_signal_candidate_set_invalid:%', v_ids;
  END IF;
END $$;
RESET ROLE;

SELECT '6) existing Contact writer is create-if-clear and cannot bypass identity resolution' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_current_clinic_crm_contact(
      '72000000-0000-0000-0000-000000000010',
      'Bypass Attempt',
      '+55 51 98888-0001',
      NULL
    );
    RAISE EXCEPTION 'crm_contact_identity_bypass_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM <> 'crm_contact_identity_resolution_required' THEN
        RAISE;
      END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.contacts WHERE id='72000000-0000-0000-0000-000000000010'
  ) THEN
    RAISE EXCEPTION 'crm_contact_identity_bypass_persisted_contact';
  END IF;
END $$;

SELECT '7) create_if_clear creates Contact+Lead, stores canonical values and exact retry is side-effect idempotent' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

SELECT * FROM public.create_current_clinic_crm_resolved_prospect(
  '72000000-0000-0000-0000-000000000011',
  '82000000-0000-0000-0000-000000000011',
  'Resolved Clear',
  'Resolved Lead',
  'create_if_clear',
  '(51) 95555-0011',
  'Resolved.Local@Example.COM',
  NULL,
  NULL,
  NULL,
  NULL,
  25000,
  'identity_test'
);

SELECT * FROM public.create_current_clinic_crm_resolved_prospect(
  '72000000-0000-0000-0000-000000000011',
  '82000000-0000-0000-0000-000000000011',
  'Resolved Clear',
  'Resolved Lead',
  'create_if_clear',
  '(51) 95555-0011',
  'Resolved.Local@Example.COM',
  NULL,
  NULL,
  NULL,
  NULL,
  25000,
  'identity_test'
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.contacts
    WHERE id='72000000-0000-0000-0000-000000000011'
      AND phone_normalized='+5551955550011'
      AND email_normalized='Resolved.Local@example.com'
  ) THEN
    RAISE EXCEPTION 'crm_resolved_clear_normalized_storage_invalid';
  END IF;

  IF (SELECT count(*) FROM public.contacts WHERE id='72000000-0000-0000-0000-000000000011') <> 1
     OR (SELECT count(*) FROM public.crm_leads WHERE id='82000000-0000-0000-0000-000000000011') <> 1
     OR (SELECT count(*) FROM public.crm_lead_activities WHERE lead_id='82000000-0000-0000-0000-000000000011' AND activity_type='lead_created') <> 1
     OR (SELECT count(*) FROM public.crm_lead_activities WHERE lead_id='82000000-0000-0000-0000-000000000011' AND activity_type='contact_identity_resolved') <> 1
     OR (SELECT count(*) FROM public.audit_log WHERE acao='CRM_CONTACT_CREATED' AND detalhe LIKE '%72000000-0000-0000-0000-000000000011%') <> 1
     OR (SELECT count(*) FROM public.audit_log WHERE acao='CRM_LEAD_CREATED' AND detalhe LIKE '%82000000-0000-0000-0000-000000000011%') <> 1
     OR (SELECT count(*) FROM public.audit_log WHERE acao='CRM_CONTACT_IDENTITY_RESOLVED' AND detalhe LIKE '%82000000-0000-0000-0000-000000000011%') <> 1 THEN
    RAISE EXCEPTION 'crm_resolved_clear_retry_side_effects_not_exactly_once';
  END IF;
END $$;

SELECT '8) divergent orchestration retry fails explicitly' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_current_clinic_crm_resolved_prospect(
      '72000000-0000-0000-0000-000000000011',
      '82000000-0000-0000-0000-000000000011',
      'Resolved Clear',
      'Divergent Title',
      'create_if_clear',
      '(51) 95555-0011',
      'Resolved.Local@Example.COM',
      NULL,
      NULL,
      NULL,
      NULL,
      25000,
      'identity_test'
    );
    RAISE EXCEPTION 'crm_resolved_prospect_divergent_retry_unexpectedly_allowed';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '9) explicit_reuse creates a new Lead for the selected candidate without editing Contact' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
SELECT * FROM public.create_current_clinic_crm_resolved_prospect(
  '72000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000012',
  'Incoming Different Display',
  'Reuse Lead',
  'explicit_reuse',
  '+55 51 98888-0001',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'identity_reuse'
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_leads
    WHERE id='82000000-0000-0000-0000-000000000012'
      AND contact_id='72000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'crm_explicit_reuse_lead_contact_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contacts
    WHERE id='72000000-0000-0000-0000-000000000001'
      AND name='Legacy Phone'
      AND phone='+55 51 98888-0001'
      AND phone_normalized IS NULL
  ) THEN
    RAISE EXCEPTION 'crm_explicit_reuse_edited_contact';
  END IF;
END $$;

SELECT '9b) explicit_reuse exact retry is side-effect idempotent' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

SELECT * FROM public.create_current_clinic_crm_resolved_prospect(
  '72000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000012',
  'Incoming Different Display',
  'Reuse Lead',
  'explicit_reuse',
  '+55 51 98888-0001',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'identity_reuse'
);

RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.crm_lead_activities
      WHERE lead_id='82000000-0000-0000-0000-000000000012'
        AND activity_type='contact_identity_resolved') <> 1
     OR (SELECT count(*) FROM public.audit_log
         WHERE acao='CRM_CONTACT_IDENTITY_RESOLVED'
           AND detalhe LIKE '%82000000-0000-0000-0000-000000000012%') <> 1 THEN
    RAISE EXCEPTION 'crm_explicit_reuse_retry_duplicated_resolution_evidence';
  END IF;
END $$;

SELECT '10) explicit_distinct creates a new Contact only with bounded reason code' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_current_clinic_crm_resolved_prospect(
      '72000000-0000-0000-0000-000000000013',
      '82000000-0000-0000-0000-000000000013',
      'Distinct Missing Reason',
      'Distinct Lead Invalid',
      'explicit_distinct',
      '+55 51 98888-0001'
    );
    RAISE EXCEPTION 'crm_explicit_distinct_without_reason_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    PERFORM * FROM public.create_current_clinic_crm_resolved_prospect(
      '72000000-0000-0000-0000-000000000013',
      '82000000-0000-0000-0000-000000000013',
      'Distinct Invalid Reason',
      'Distinct Lead Invalid',
      'explicit_distinct',
      '+55 51 98888-0001',
      NULL,
      'free form phone +55 51 98888-0001'
    );
    RAISE EXCEPTION 'crm_explicit_distinct_freeform_reason_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END $$;

SELECT * FROM public.create_current_clinic_crm_resolved_prospect(
  '72000000-0000-0000-0000-000000000013',
  '82000000-0000-0000-0000-000000000013',
  'Distinct Allowed',
  'Distinct Lead',
  'explicit_distinct',
  '+55 51 98888-0001',
  NULL,
  'shared_contact_channel',
  NULL,
  NULL,
  NULL,
  NULL,
  'identity_distinct'
);
RESET ROLE;

DO $$
DECLARE
  v_meta jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.contacts
    WHERE id='72000000-0000-0000-0000-000000000013'
      AND phone_normalized='+5551988880001'
  ) THEN
    RAISE EXCEPTION 'crm_explicit_distinct_contact_missing_or_not_normalized';
  END IF;

  SELECT metadata INTO v_meta
  FROM public.crm_lead_activities
  WHERE lead_id='82000000-0000-0000-0000-000000000013'
    AND activity_type='contact_identity_resolved';

  IF v_meta->>'resolution_mode' <> 'explicit_distinct'
     OR v_meta->>'override_reason' <> 'shared_contact_channel'
     OR NOT (v_meta->'candidate_ids' @> to_jsonb(ARRAY['72000000-0000-0000-0000-000000000001'::uuid])) THEN
    RAISE EXCEPTION 'crm_explicit_distinct_resolution_metadata_invalid:%', v_meta;
  END IF;
END $$;

SELECT '11) selected Contact must remain a current candidate for explicit_reuse' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_current_clinic_crm_resolved_prospect(
      '72000000-0000-0000-0000-000000000002',
      '82000000-0000-0000-0000-000000000014',
      'Wrong Selected Contact',
      'Wrong Reuse Lead',
      'explicit_reuse',
      '+55 51 98888-0001',
      NULL
    );
    RAISE EXCEPTION 'crm_non_candidate_reuse_unexpectedly_allowed';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT '12) Patient-linked Contact may be reused as Contact without Patient mutation or Patient output authority' AS check;
INSERT INTO public.contacts (
  id, clinic_id, name, phone, patient_id
) VALUES (
  '72000000-0000-0000-0000-000000000020',
  '20000000-0000-0000-0000-000000000001',
  'Patient Linked Contact',
  '+55 51 96666-0020',
  '60000000-0000-0000-0000-000000000001'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
SELECT * FROM public.create_current_clinic_crm_resolved_prospect(
  '72000000-0000-0000-0000-000000000020',
  '82000000-0000-0000-0000-000000000020',
  'Incoming Prospect Name',
  'Patient-linked Contact Lead',
  'explicit_reuse',
  '+55 51 96666-0020'
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE id='60000000-0000-0000-0000-000000000001'
      AND funil_stage='lead'
  ) THEN
    RAISE EXCEPTION 'crm_identity_resolution_mutated_patient';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_leads
    WHERE id='82000000-0000-0000-0000-000000000020'
      AND contact_id='72000000-0000-0000-0000-000000000020'
  ) THEN
    RAISE EXCEPTION 'crm_patient_linked_contact_reuse_failed';
  END IF;
END $$;

SELECT '13) resolution evidence contains no raw phone/email/name PII' AS check;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE acao='CRM_CONTACT_IDENTITY_RESOLVED'
      AND (
        detalhe ILIKE '%Resolved Clear%'
        OR detalhe ILIKE '%Resolved.Local@Example.COM%'
        OR detalhe LIKE '%95555-0011%'
        OR detalhe ILIKE '%Distinct Allowed%'
        OR detalhe LIKE '%98888-0001%'
      )
  ) THEN
    RAISE EXCEPTION 'crm_identity_resolution_audit_leaked_raw_pii';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.crm_lead_activities
    WHERE activity_type='contact_identity_resolved'
      AND (
        metadata::text ILIKE '%Resolved Clear%'
        OR metadata::text ILIKE '%Resolved.Local@Example.COM%'
        OR metadata::text LIKE '%95555-0011%'
        OR metadata::text ILIKE '%Distinct Allowed%'
        OR metadata::text LIKE '%98888-0001%'
      )
  ) THEN
    RAISE EXCEPTION 'crm_identity_resolution_activity_leaked_raw_pii';
  END IF;
END $$;

SELECT '14) no-signal create uses only the per-Lead retry advisory lock, never a shared signal/global lock' AS check;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
SELECT * FROM public.create_current_clinic_crm_resolved_prospect(
  '72000000-0000-0000-0000-000000000030',
  '82000000-0000-0000-0000-000000000030',
  'No Signal Contact',
  'No Signal Lead',
  'create_if_clear'
);
DO $$
DECLARE
  v_advisory_count integer;
BEGIN
  SELECT count(*)::integer
    INTO v_advisory_count
  FROM pg_locks
  WHERE pid=pg_backend_pid()
    AND locktype='advisory'
    AND granted;

  IF v_advisory_count <> 1 THEN
    RAISE EXCEPTION 'crm_no_signal_advisory_lock_count_invalid:%', v_advisory_count;
  END IF;
END $$;
ROLLBACK;

SELECT '15) lock namespace and candidate lookup are clinic-scoped' AS check;
DO $$
BEGIN
  IF public.crm_contact_identity_lock_key(
       '20000000-0000-0000-0000-000000000001',
       'phone',
       '+5551980000040'
     ) =
     public.crm_contact_identity_lock_key(
       '20000000-0000-0000-0000-000000000002',
       'phone',
       '+5551980000040'
     ) THEN
    RAISE EXCEPTION 'crm_identity_cross_tenant_lock_key_collision_for_same_signal';
  END IF;
END $$;

UPDATE public.platform_clinic_entitlements
SET enabled=true
WHERE clinic_id='20000000-0000-0000-0000-000000000002'
  AND entitlement_key='crm.access';

INSERT INTO public.contacts (id, clinic_id, name, phone)
VALUES (
  '72000000-0000-0000-0000-000000000040',
  '20000000-0000-0000-0000-000000000002',
  'Clinic B Identity',
  '+55 51 98000-0040'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.list_current_clinic_crm_contact_identity_candidates('+55 51 98000-0040', NULL)
  ) THEN
    RAISE EXCEPTION 'crm_identity_cross_tenant_candidate_leak';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.list_current_clinic_crm_contact_identity_candidates('+55 51 98000-0040', NULL)) <> 1 THEN
    RAISE EXCEPTION 'crm_identity_clinic_b_candidate_missing';
  END IF;
END $$;
RESET ROLE;

SELECT '16) final resolution activity is unique per Lead' AS check;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.crm_lead_activities (
      clinic_id, lead_id, activity_type, actor_kind, metadata
    ) VALUES (
      '20000000-0000-0000-0000-000000000001',
      '82000000-0000-0000-0000-000000000011',
      'contact_identity_resolved',
      'system',
      '{}'::jsonb
    );
    RAISE EXCEPTION 'crm_identity_resolution_duplicate_activity_unexpectedly_allowed';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END $$;

SELECT 'COMMERCIAL CRM CONTACT IDENTITY RESOLUTION BEHAVIOR CASES PASSED' AS result;
