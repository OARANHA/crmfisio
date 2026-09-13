\set ON_ERROR_STOP on
\pset pager off

-- Existing clinics preserve current behavior after migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.clinic_clinical_flow_settings
    WHERE clinic_id = '20000000-0000-0000-0000-000000000001'::uuid
      AND referral_authoring_enabled IS TRUE
  ) THEN
    RAISE EXCEPTION 'existing_clinic_default_not_true';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinic_clinical_flow_settings
    WHERE clinic_id = '20000000-0000-0000-0000-000000000002'::uuid
      AND referral_authoring_enabled IS TRUE
  ) THEN
    RAISE EXCEPTION 'second_tenant_default_not_true';
  END IF;
END $$;

-- A normal active clinic member can read its clinic policy but cannot change it.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);
DO $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT referral_authoring_enabled
  INTO v_enabled
  FROM public.get_current_clinic_clinical_flow_settings();

  IF v_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'professional_policy_read_wrong_default';
  END IF;

  BEGIN
    PERFORM * FROM public.update_current_clinic_clinical_flow_settings(false);
    RAISE EXCEPTION 'professional_policy_update_unexpectedly_allowed';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      IF SQLERRM <> 'clinic owner/admin access required' THEN
        RAISE;
      END IF;
  END;
END $$;
RESET ROLE;

-- Owner A disables referral authoring only for Clinic A.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT * FROM public.update_current_clinic_clinical_flow_settings(false);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT referral_authoring_enabled FROM public.clinic_clinical_flow_settings WHERE clinic_id='20000000-0000-0000-0000-000000000001') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'owner_policy_disable_not_persisted';
  END IF;
  IF (SELECT referral_authoring_enabled FROM public.clinic_clinical_flow_settings WHERE clinic_id='20000000-0000-0000-0000-000000000002') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'cross_tenant_policy_drift';
  END IF;
END $$;

-- Prepare a pre-existing draft and issued referral while running as the system.
SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.clinical_documents(id, clinic_id, document_type, status, payload)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'referral', 'draft', '{"reason":"draft before disable"}'::jsonb),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'referral', 'issued', '{"reason":"issued before disable"}'::jsonb);

-- While disabled, authenticated clinical authoring is blocked for create/edit/issue.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.clinical_documents(clinic_id, document_type, status, payload)
    VALUES ('20000000-0000-0000-0000-000000000001', 'referral', 'draft', '{}'::jsonb);
    RAISE EXCEPTION 'disabled_referral_insert_unexpectedly_allowed';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      IF SQLERRM <> 'clinical_referral_authoring_disabled' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.clinical_documents
    SET payload = '{"reason":"edited while disabled"}'::jsonb
    WHERE id = '30000000-0000-0000-0000-000000000001'::uuid;
    RAISE EXCEPTION 'disabled_referral_edit_unexpectedly_allowed';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      IF SQLERRM <> 'clinical_referral_authoring_disabled' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.clinical_documents
    SET status = 'issued'
    WHERE id = '30000000-0000-0000-0000-000000000001'::uuid;
    RAISE EXCEPTION 'disabled_referral_issue_unexpectedly_allowed';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      IF SQLERRM <> 'clinical_referral_authoring_disabled' THEN RAISE; END IF;
  END;
END $$;

-- Other document types remain unaffected.
INSERT INTO public.clinical_documents(clinic_id, document_type, status, payload)
VALUES ('20000000-0000-0000-0000-000000000001', 'therapeutic_guidance', 'draft', '{}'::jsonb);

-- Existing issued history can still transition to canceled; the policy is not a
-- historical read/cancel lock.
UPDATE public.clinical_documents
SET status = 'canceled'
WHERE id = '30000000-0000-0000-0000-000000000002'::uuid;
RESET ROLE;

-- Direct table mutation of the policy is not available to the browser role.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    UPDATE public.clinic_clinical_flow_settings
    SET referral_authoring_enabled = true
    WHERE clinic_id = '20000000-0000-0000-0000-000000000001'::uuid;
    RAISE EXCEPTION 'authenticated_direct_policy_update_unexpectedly_allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Admin can re-enable the policy. Authoring becomes available again.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
SELECT * FROM public.update_current_clinic_clinical_flow_settings(true);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);
INSERT INTO public.clinical_documents(clinic_id, document_type, status, payload)
VALUES ('20000000-0000-0000-0000-000000000001', 'referral', 'draft', '{"reason":"enabled again"}'::jsonb);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM public.clinical_documents WHERE id='30000000-0000-0000-0000-000000000002') IS DISTINCT FROM 'canceled' THEN
    RAISE EXCEPTION 'issued_referral_cancel_was_blocked';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_documents
    WHERE clinic_id='20000000-0000-0000-0000-000000000001'
      AND document_type='referral'
      AND payload->>'reason'='enabled again'
  ) THEN
    RAISE EXCEPTION 'referral_authoring_not_restored_after_enable';
  END IF;
END $$;

SELECT 'CLINIC REFERRAL AUTHORING POLICY V1 BEHAVIOR PASS' AS result;
