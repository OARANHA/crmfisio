-- D2-E3 Internal Referral V1 verifier. Safe to run in production: all behavior probes rollback.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_def text;
  v_trigger_count integer;
BEGIN
  SELECT pg_get_functiondef('public.list_clinical_referral_internal_targets()'::regprocedure) INTO v_def;
  IF position('SECURITY DEFINER' in v_def) = 0
     OR position('current_user_can_issue_clinical_document' in v_def) = 0
     OR position('p.clinic_id = v_clinic_id' in v_def) = 0
     OR position('p.ativo IS TRUE' in v_def) = 0
     OR position('p.id IS DISTINCT FROM auth.uid()' in v_def) = 0 THEN
    RAISE EXCEPTION 'clinical_referral_internal_directory_boundary_missing';
  END IF;

  SELECT count(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'public.clinical_documents'::regclass
    AND tgname = 'trg_clinical_referral_internal_target'
    AND NOT tgisinternal;
  IF v_trigger_count <> 1 THEN RAISE EXCEPTION 'clinical_referral_internal_target_trigger_missing'; END IF;

  SELECT pg_get_functiondef('public.guard_clinical_referral_internal_target()'::regprocedure) INTO v_def;
  IF position('internal_professional' in v_def) = 0
     OR position('internal_service' in v_def) = 0
     OR position('p.clinic_id = NEW.clinic_id' in v_def) = 0
     OR position('p.ativo IS TRUE' in v_def) = 0
     OR position('NEW.status = ''issued''' in v_def) = 0 THEN
    RAISE EXCEPTION 'clinical_referral_internal_target_guard_incomplete';
  END IF;

  IF has_function_privilege('anon','public.list_clinical_referral_internal_targets()','EXECUTE') THEN
    RAISE EXCEPTION 'clinical_referral_internal_directory_anon_execute';
  END IF;
  IF NOT has_function_privilege('authenticated','public.list_clinical_referral_internal_targets()','EXECUTE') THEN
    RAISE EXCEPTION 'clinical_referral_internal_directory_authenticated_missing';
  END IF;
END $$;

-- Authenticated issuer sees only active clinical profiles in own tenant and never itself.
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.list_clinical_referral_internal_targets() WHERE profile_id='d2100000-0000-4000-8000-000000000001'::uuid) THEN
    RAISE EXCEPTION 'clinical_referral_internal_directory_self_leak';
  END IF;
  IF EXISTS (SELECT 1 FROM public.list_clinical_referral_internal_targets() WHERE profile_id IN ('d2100000-0000-4000-8000-000000000005'::uuid,'d2100000-0000-4000-8000-000000000006'::uuid,'d2100000-0000-4000-8000-000000000007'::uuid,'d2100000-0000-4000-8000-000000000008'::uuid)) THEN
    RAISE EXCEPTION 'clinical_referral_internal_directory_scope_leak';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.list_clinical_referral_internal_targets() WHERE profile_id='d2100000-0000-4000-8000-000000000004'::uuid AND professional_type <> '') THEN
    RAISE EXCEPTION 'clinical_referral_internal_directory_expected_target_missing';
  END IF;
END $$;
RESET ROLE;

-- Trigger-level tenant/activity fail-closed probes use direct INSERT under
-- postgres inside this transaction; no business state survives ROLLBACK.
DO $$
DECLARE
  v_base jsonb := '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000004","recipient":{"professional_name":"Psicóloga D2","professional_type":"psicologo","specialty":"","service":"","facility":"Clínica D2 A","contact":""},"reason":"Continuidade do cuidado","priority":"routine"}'::jsonb;
  v_ok boolean := false;
BEGIN
  INSERT INTO public.clinical_documents(
    id, clinic_id, patient_id, appointment_id, document_type, template_id,
    template_version_id, issuer_id, status, payload, document_identifier
  ) VALUES (
    'd2e30000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',
    'd2200000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','referral',
    '12000000-0000-4000-8000-000000000007','12100000-0000-4000-8000-000000000008',
    'd2100000-0000-4000-8000-000000000001','draft',v_base,'D2E3-VALID-TARGET'
  );

  BEGIN
    INSERT INTO public.clinical_documents(
      id, clinic_id, patient_id, appointment_id, document_type, template_id,
      template_version_id, issuer_id, status, payload, document_identifier
    ) VALUES (
      'd2e30000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001',
      'd2200000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','referral',
      '12000000-0000-4000-8000-000000000007','12100000-0000-4000-8000-000000000008',
      'd2100000-0000-4000-8000-000000000001','draft',
      jsonb_set(v_base,'{target_profile_id}','"d2100000-0000-4000-8000-000000000008"'),'D2E3-CROSS-TENANT'
    );
  EXCEPTION WHEN OTHERS THEN v_ok := position('clinical_referral_target_invalid' in SQLERRM) > 0; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'clinical_referral_cross_tenant_target_not_blocked'; END IF;

  v_ok := false;
  BEGIN
    INSERT INTO public.clinical_documents(
      id, clinic_id, patient_id, appointment_id, document_type, template_id,
      template_version_id, issuer_id, status, payload, document_identifier
    ) VALUES (
      'd2e30000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001',
      'd2200000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','referral',
      '12000000-0000-4000-8000-000000000007','12100000-0000-4000-8000-000000000008',
      'd2100000-0000-4000-8000-000000000001','draft',
      jsonb_set(v_base,'{target_profile_id}','"d2100000-0000-4000-8000-000000000007"'),'D2E3-INACTIVE'
    );
  EXCEPTION WHEN OTHERS THEN v_ok := position('clinical_referral_target_invalid' in SQLERRM) > 0; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'clinical_referral_inactive_target_not_blocked'; END IF;
END $$;

SELECT 'CLINICAL REFERRAL INTERNAL V1 VERIFY PASSED' AS result;
ROLLBACK;
