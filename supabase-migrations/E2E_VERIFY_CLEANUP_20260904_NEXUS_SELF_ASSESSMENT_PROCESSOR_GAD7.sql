\set ON_ERROR_STOP on

DO $$
DECLARE
  v_invite public.nexus_self_assessment_invites%ROWTYPE;
  v_result public.nexus_clinical_results%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.nexus_self_assessment_invites
  WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'::uuid;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'GAD7_PROCESSOR_E2E_FAIL: convite sintético ausente';
  END IF;
  IF v_invite.status <> 'processed' OR v_invite.processed_result_id IS NULL THEN
    RAISE EXCEPTION 'GAD7_PROCESSOR_E2E_FAIL: convite não processado';
  END IF;

  SELECT * INTO v_result
  FROM public.nexus_clinical_results
  WHERE id = v_invite.processed_result_id;

  IF v_result.id IS NULL OR v_result.status <> 'finalized' THEN
    RAISE EXCEPTION 'GAD7_PROCESSOR_E2E_FAIL: resultado ausente/não finalizado';
  END IF;

  IF v_result.clinic_id <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid
     OR v_result.patient_id <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid
     OR v_result.professional_id <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid THEN
    RAISE EXCEPTION 'GAD7_PROCESSOR_E2E_FAIL: autoria/tenant/paciente divergentes';
  END IF;

  IF v_result.tool_key <> 'gad7'
     OR v_result.rule_version <> 'nexus-2026-09-03'
     OR v_result.total_score <> 11
     OR v_result.max_score <> 21
     OR v_result.classification <> 'Ansiedade moderada'
     OR v_result.severity <> 'moderate' THEN
    RAISE EXCEPTION 'GAD7_PROCESSOR_E2E_FAIL: cálculo divergente';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.nexus_red_flags WHERE result_id = v_result.id
  ) THEN
    RAISE EXCEPTION 'GAD7_PROCESSOR_E2E_FAIL: GAD-7 não deveria criar red flag neste caso';
  END IF;
END $$;

SELECT
  'NEXUS_SELF_ASSESSMENT_PROCESSOR_GAD7_E2E_OK' AS verification,
  i.processed_result_id AS result_id,
  r.total_score,
  r.classification,
  r.status AS result_status,
  (SELECT count(*) FROM public.nexus_red_flags f WHERE f.result_id = r.id) AS red_flags
FROM public.nexus_self_assessment_invites i
JOIN public.nexus_clinical_results r ON r.id = i.processed_result_id
WHERE i.id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'::uuid;

BEGIN;
DELETE FROM public.nexus_red_flags WHERE patient_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid;
DELETE FROM public.nexus_self_assessment_invites WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'::uuid;
DELETE FROM public.nexus_clinical_results WHERE patient_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid;
DELETE FROM public.professional_capabilities WHERE professional_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid;
DELETE FROM public.patients WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid;
DELETE FROM public.profiles WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid;
DELETE FROM auth.users WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid;
DELETE FROM public.audit_log WHERE clinic_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid;
DELETE FROM public.clinics WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid;
COMMIT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.clinics WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid)
     OR EXISTS (SELECT 1 FROM auth.users WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid)
     OR EXISTS (SELECT 1 FROM public.patients WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid)
     OR EXISTS (SELECT 1 FROM public.nexus_self_assessment_invites WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'::uuid) THEN
    RAISE EXCEPTION 'GAD7_PROCESSOR_E2E_CLEANUP_FAIL: fixture sintética permaneceu';
  END IF;
END $$;

SELECT 'NEXUS_SELF_ASSESSMENT_PROCESSOR_GAD7_E2E_CLEANUP_OK' AS cleanup;
