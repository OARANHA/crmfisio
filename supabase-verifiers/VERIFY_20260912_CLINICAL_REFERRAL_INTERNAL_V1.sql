-- D2-E3 Internal Referral V1 verifier.
-- Production-safe: structural/fail-closed probes always run; synthetic positive/
-- negative behavior probes run only when the disposable D2-A fixture is present.
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
     OR position('p.id IS DISTINCT FROM auth.uid()' in v_def) = 0
     OR position('''medico''' in v_def) = 0
     OR position('''fisioterapeuta''' in v_def) = 0
     OR position('''psicologo''' in v_def) = 0
     OR position('''quiropraxista''' in v_def) = 0
     OR position('p.role' in v_def) > 0 THEN
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
     OR position('clinical_referral_internal_service_invalid' in v_def) = 0
     OR position('p.clinic_id = NEW.clinic_id' in v_def) = 0
     OR position('p.ativo IS TRUE' in v_def) = 0
     OR position('NEW.status = ''issued''' in v_def) = 0
     OR position('''medico''' in v_def) = 0
     OR position('''fisioterapeuta''' in v_def) = 0
     OR position('''psicologo''' in v_def) = 0
     OR position('''quiropraxista''' in v_def) = 0
     OR position('p.role' in v_def) > 0 THEN
    RAISE EXCEPTION 'clinical_referral_internal_target_guard_incomplete';
  END IF;

  IF has_function_privilege('anon','public.list_clinical_referral_internal_targets()','EXECUTE') THEN
    RAISE EXCEPTION 'clinical_referral_internal_directory_anon_execute';
  END IF;
  IF NOT has_function_privilege('authenticated','public.list_clinical_referral_internal_targets()','EXECUTE') THEN
    RAISE EXCEPTION 'clinical_referral_internal_directory_authenticated_missing';
  END IF;
END $$;

-- CI reconstructs the disposable D2-A fixture before invoking this verifier.
-- Production intentionally does not contain these synthetic IDs. Persist the
-- fixture presence in a transaction-local GUC so the same verifier can safely
-- distinguish full fixture behavior probes from production fail-closed probes.
SELECT set_config(
  'medicspro.verify_d2e3_fixture_ready',
  CASE WHEN
    EXISTS (SELECT 1 FROM public.clinics WHERE id='d2000000-0000-4000-8000-000000000001'::uuid)
    AND EXISTS (SELECT 1 FROM public.clinics WHERE id='d2000000-0000-4000-8000-000000000002'::uuid)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id='d2100000-0000-4000-8000-000000000001'::uuid AND ativo IS TRUE)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id='d2100000-0000-4000-8000-000000000004'::uuid AND ativo IS TRUE)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id='d2100000-0000-4000-8000-000000000007'::uuid)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id='d2100000-0000-4000-8000-000000000008'::uuid)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id='d2100000-0000-4000-8000-000000000011'::uuid AND ativo IS TRUE)
    AND EXISTS (SELECT 1 FROM public.patients WHERE id='d2200000-0000-4000-8000-000000000001'::uuid)
    AND EXISTS (SELECT 1 FROM public.appointments WHERE id='d2300000-0000-4000-8000-000000000001'::uuid)
    THEN 'true' ELSE 'false' END,
  true
);

SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
DO $$
DECLARE
  v_fixture_ready boolean := current_setting('medicspro.verify_d2e3_fixture_ready', true)::boolean;
BEGIN
  IF v_fixture_ready THEN
    IF EXISTS (SELECT 1 FROM public.list_clinical_referral_internal_targets() WHERE profile_id='d2100000-0000-4000-8000-000000000001'::uuid) THEN
      RAISE EXCEPTION 'clinical_referral_internal_directory_self_leak';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.list_clinical_referral_internal_targets()
      WHERE profile_id IN (
        'd2100000-0000-4000-8000-000000000005'::uuid,
        'd2100000-0000-4000-8000-000000000006'::uuid,
        'd2100000-0000-4000-8000-000000000007'::uuid,
        'd2100000-0000-4000-8000-000000000008'::uuid,
        'd2100000-0000-4000-8000-000000000011'::uuid
      )
    ) THEN
      RAISE EXCEPTION 'clinical_referral_internal_directory_scope_leak';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.list_clinical_referral_internal_targets() WHERE profile_id='d2100000-0000-4000-8000-000000000004'::uuid AND professional_type <> '') THEN
      RAISE EXCEPTION 'clinical_referral_internal_directory_expected_target_missing';
    END IF;
  ELSE
    -- On production the synthetic subject is absent; CI also exercises this
    -- branch with that subject made ineligible. Either way the directory must
    -- fail closed rather than leak tenant data for the JWT.
    IF EXISTS (SELECT 1 FROM public.list_clinical_referral_internal_targets()) THEN
      RAISE EXCEPTION 'clinical_referral_internal_directory_unknown_subject_leak';
    END IF;
    RAISE NOTICE 'D2-E3 production verifier: disposable fixture absent/ineligible; positive directory fixture probes skipped, fail-closed probe passed.';
  END IF;
END $$;
RESET ROLE;

DO $$
DECLARE
  v_fixture_ready boolean := current_setting('medicspro.verify_d2e3_fixture_ready', true)::boolean;
  v_base jsonb := '{"destination_scope":"internal_professional","target_profile_id":"d2100000-0000-4000-8000-000000000004","recipient":{"professional_name":"Psicóloga D2","professional_type":"psicologo","specialty":"","service":"","facility":"Clínica D2 A","contact":""},"reason":"Continuidade do cuidado","priority":"routine"}'::jsonb;
  v_service jsonb := '{"destination_scope":"internal_service","target_profile_id":"","recipient":{"professional_name":"","professional_type":"psicologo","specialty":"","service":"","facility":"Clínica D2 A","contact":""},"reason":"Continuidade do cuidado","priority":"routine"}'::jsonb;
  v_nonclinical_service jsonb := '{"destination_scope":"internal_service","target_profile_id":"","recipient":{"professional_name":"","professional_type":"recepcionista","specialty":"","service":"","facility":"Clínica D2 A","contact":""},"reason":"Continuidade do cuidado","priority":"routine"}'::jsonb;
  v_ok boolean := false;
  v_version_id uuid;
BEGIN
  SELECT current_version_id INTO v_version_id
  FROM public.clinical_document_templates
  WHERE id='12000000-0000-4000-8000-000000000007'::uuid;
  IF v_version_id IS NULL THEN RAISE EXCEPTION 'clinical_referral_current_version_missing'; END IF;

  IF NOT v_fixture_ready THEN
    RAISE NOTICE 'D2-E3 production verifier: mutation probes use disposable fixture and were skipped; trigger/function fingerprints and fail-closed runtime probe passed.';
    RETURN;
  END IF;

  INSERT INTO public.clinical_documents(
    id, clinic_id, patient_id, appointment_id, document_type, template_id,
    template_version_id, issuer_id, status, payload, document_identifier
  ) VALUES (
    'd2e30000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',
    'd2200000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','referral',
    '12000000-0000-4000-8000-000000000007',v_version_id,
    'd2100000-0000-4000-8000-000000000001','draft',v_base,'D2E3-VALID-TARGET'
  );

  BEGIN
    INSERT INTO public.clinical_documents(
      id, clinic_id, patient_id, appointment_id, document_type, template_id,
      template_version_id, issuer_id, status, payload, document_identifier
    ) VALUES (
      'd2e30000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001',
      'd2200000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','referral',
      '12000000-0000-4000-8000-000000000007',v_version_id,
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
      '12000000-0000-4000-8000-000000000007',v_version_id,
      'd2100000-0000-4000-8000-000000000001','draft',
      jsonb_set(v_base,'{target_profile_id}','"d2100000-0000-4000-8000-000000000007"'),'D2E3-INACTIVE'
    );
  EXCEPTION WHEN OTHERS THEN v_ok := position('clinical_referral_target_invalid' in SQLERRM) > 0; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'clinical_referral_inactive_target_not_blocked'; END IF;

  v_ok := false;
  BEGIN
    INSERT INTO public.clinical_documents(
      id, clinic_id, patient_id, appointment_id, document_type, template_id,
      template_version_id, issuer_id, status, payload, document_identifier
    ) VALUES (
      'd2e30000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000001',
      'd2200000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','referral',
      '12000000-0000-4000-8000-000000000007',v_version_id,
      'd2100000-0000-4000-8000-000000000001','draft',
      jsonb_set(v_base,'{target_profile_id}','"d2100000-0000-4000-8000-000000000011"'),'D2E3-NONCLINICAL-TARGET'
    );
  EXCEPTION WHEN OTHERS THEN v_ok := position('clinical_referral_target_invalid' in SQLERRM) > 0; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'clinical_referral_nonclinical_target_not_blocked'; END IF;

  -- A routed internal service must correspond to an active canonical clinical
  -- profession/area in the same clinic. A fabricated or non-clinical area fails.
  INSERT INTO public.clinical_documents(
    id, clinic_id, patient_id, appointment_id, document_type, template_id,
    template_version_id, issuer_id, status, payload, document_identifier
  ) VALUES (
    'd2e30000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001',
    'd2200000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','referral',
    '12000000-0000-4000-8000-000000000007',v_version_id,
    'd2100000-0000-4000-8000-000000000001','draft',v_service,'D2E3-VALID-SERVICE'
  );

  v_ok := false;
  BEGIN
    INSERT INTO public.clinical_documents(
      id, clinic_id, patient_id, appointment_id, document_type, template_id,
      template_version_id, issuer_id, status, payload, document_identifier
    ) VALUES (
      'd2e30000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000001',
      'd2200000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','referral',
      '12000000-0000-4000-8000-000000000007',v_version_id,
      'd2100000-0000-4000-8000-000000000001','draft',
      jsonb_set(v_service,'{recipient,professional_type}','"area-inexistente"'),'D2E3-INVALID-SERVICE'
    );
  EXCEPTION WHEN OTHERS THEN v_ok := position('clinical_referral_internal_service_invalid' in SQLERRM) > 0; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'clinical_referral_invalid_internal_service_not_blocked'; END IF;

  v_ok := false;
  BEGIN
    INSERT INTO public.clinical_documents(
      id, clinic_id, patient_id, appointment_id, document_type, template_id,
      template_version_id, issuer_id, status, payload, document_identifier
    ) VALUES (
      'd2e30000-0000-4000-8000-000000000007','d2000000-0000-4000-8000-000000000001',
      'd2200000-0000-4000-8000-000000000001','d2300000-0000-4000-8000-000000000001','referral',
      '12000000-0000-4000-8000-000000000007',v_version_id,
      'd2100000-0000-4000-8000-000000000001','draft',v_nonclinical_service,'D2E3-NONCLINICAL-SERVICE'
    );
  EXCEPTION WHEN OTHERS THEN v_ok := position('clinical_referral_internal_service_invalid' in SQLERRM) > 0; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'clinical_referral_nonclinical_service_not_blocked'; END IF;
END $$;

SELECT 'CLINICAL REFERRAL INTERNAL V1 VERIFY PASSED' AS result;
ROLLBACK;
