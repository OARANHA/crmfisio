-- Reproduce C-03 ambiguity on the effective C-02 baseline: the service processor
-- marks a PHQ-9 result finalized although no human review primitive exists.
INSERT INTO public.nexus_self_assessment_invites(
  id, clinic_id, patient_id, professional_id, appointment_id,
  scale_key, rule_version, token_hash, expires_at,
  status, submitted_at, processing_started_at, response_snapshot
) VALUES (
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000501',
  'phq9','nexus-2026-09-03','c03-pre-token',now()+interval '1 day',
  'submitted',now(),now(),'{}'::jsonb
);

SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.complete_nexus_self_assessment_processing(
  '00000000-0000-0000-0000-000000000901',
  jsonb_build_object(
    'moduleKey','scales',
    'toolKey','phq9',
    'ruleKey','nexus.phq9',
    'ruleVersion','nexus-2026-09-03',
    'requiredCapability','nexus.scales',
    'inputSnapshot','{}'::jsonb,
    'outputSnapshot',jsonb_build_object('guidanceMode','clinician-review'),
    'totalScore',5,
    'maxScore',27,
    'classification','mild',
    'severity','low',
    'interpretation','synthetic C-03 pre-fix',
    'soapText','synthetic',
    'evidenceSnapshot','[]'::jsonb
  ),
  '[]'::jsonb
);
RESET ROLE;

DO $$
DECLARE v_result uuid;
BEGIN
  SELECT processed_result_id INTO v_result
  FROM public.nexus_self_assessment_invites
  WHERE id='00000000-0000-0000-0000-000000000901';

  IF v_result IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.nexus_clinical_results r
    WHERE r.id=v_result
      AND r.status='finalized'
      AND r.finalized_at IS NOT NULL
      AND r.professional_id='00000000-0000-0000-0000-000000000101'
  ) THEN
    RAISE EXCEPTION 'C03 pre-fix processor did not create finalized result';
  END IF;

  IF to_regclass('public.nexus_result_clinical_lifecycle') IS NOT NULL THEN
    RAISE EXCEPTION 'C03 lifecycle unexpectedly existed before fix';
  END IF;
END;
$$;

SELECT 'NEXUS_C03_FINALIZED_WITHOUT_HUMAN_REVIEW_REPRODUCED' AS result;