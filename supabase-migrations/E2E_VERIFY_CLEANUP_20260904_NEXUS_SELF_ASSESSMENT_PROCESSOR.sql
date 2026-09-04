-- Verify PHQ-9 self-assessment processor E2E, then clean synthetic fixture.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_invite public.nexus_self_assessment_invites%ROWTYPE;
  v_result public.nexus_clinical_results%ROWTYPE;
  v_flags integer;
BEGIN
  SELECT * INTO v_invite
  FROM public.nexus_self_assessment_invites
  WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'PROCESSOR_E2E_FAIL: convite sintético ausente';
  END IF;
  IF v_invite.status <> 'processed' OR v_invite.processed_result_id IS NULL THEN
    RAISE EXCEPTION 'PROCESSOR_E2E_FAIL: convite não processado (status %, result %)', v_invite.status, v_invite.processed_result_id;
  END IF;

  SELECT * INTO v_result
  FROM public.nexus_clinical_results
  WHERE id = v_invite.processed_result_id;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'PROCESSOR_E2E_FAIL: resultado Nexus ausente';
  END IF;
  IF v_result.status <> 'finalized' THEN
    RAISE EXCEPTION 'PROCESSOR_E2E_FAIL: resultado não finalizado';
  END IF;
  IF v_result.clinic_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid
     OR v_result.patient_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid
     OR v_result.professional_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid THEN
    RAISE EXCEPTION 'PROCESSOR_E2E_FAIL: autoria/tenant/paciente divergentes';
  END IF;
  IF v_result.tool_key <> 'phq9'
     OR v_result.rule_version <> 'nexus-2026-09-03'
     OR v_result.total_score <> 9
     OR v_result.max_score <> 27
     OR v_result.classification <> 'Depressão leve'
     OR v_result.severity <> 'low' THEN
    RAISE EXCEPTION 'PROCESSOR_E2E_FAIL: cálculo PHQ-9 divergente';
  END IF;

  SELECT count(*) INTO v_flags
  FROM public.nexus_red_flags
  WHERE result_id = v_result.id
    AND flag_code = 'phq9.item9.positive'
    AND severity = 'critical';

  IF v_flags <> 1 THEN
    RAISE EXCEPTION 'PROCESSOR_E2E_FAIL: red flag q9 esperada 1, encontrada %', v_flags;
  END IF;
END $$;

SELECT
  'NEXUS_SELF_ASSESSMENT_PROCESSOR_E2E_OK' AS verification,
  i.processed_result_id AS result_id,
  r.total_score,
  r.classification,
  r.status AS result_status,
  (SELECT count(*) FROM public.nexus_red_flags f WHERE f.result_id = r.id) AS red_flags
FROM public.nexus_self_assessment_invites i
JOIN public.nexus_clinical_results r ON r.id = i.processed_result_id
WHERE i.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid;

BEGIN;
DELETE FROM public.nexus_red_flags WHERE patient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid;
DELETE FROM public.nexus_self_assessment_invites WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid;
DELETE FROM public.nexus_clinical_results WHERE patient_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid;
DELETE FROM public.professional_capabilities WHERE professional_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid;
DELETE FROM public.patients WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid;
DELETE FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid;
DELETE FROM auth.users WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid;
-- Audit triggers may have recorded actions performed by the synthetic tenant.
-- Remove only records scoped to the deterministic E2E clinic before deleting it.
DELETE FROM public.audit_log WHERE clinic_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid;
DELETE FROM public.clinics WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid;
COMMIT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.clinics WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid)
     OR EXISTS (SELECT 1 FROM auth.users WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid)
     OR EXISTS (SELECT 1 FROM public.patients WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid)
     OR EXISTS (SELECT 1 FROM public.nexus_self_assessment_invites WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid)
     OR EXISTS (SELECT 1 FROM public.audit_log WHERE clinic_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid) THEN
    RAISE EXCEPTION 'PROCESSOR_E2E_CLEANUP_FAIL: fixture sintética permaneceu';
  END IF;
END $$;

SELECT 'NEXUS_SELF_ASSESSMENT_PROCESSOR_E2E_CLEANUP_OK' AS cleanup;
