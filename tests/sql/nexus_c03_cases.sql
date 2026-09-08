-- Nexus C-03 behavior matrix on the effective C-01/C-06/C-02 baseline.
CREATE OR REPLACE FUNCTION public.test_c03_try_action(
  p_action text,
  p_actor uuid,
  p_result uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'c03_test_must_run_under_authenticated';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', p_actor::text, false);

  CASE p_action
    WHEN 'process' THEN PERFORM public.complete_nexus_result_processing(p_result);
    WHEN 'review' THEN PERFORM public.review_nexus_result(p_result);
    WHEN 'sign' THEN PERFORM public.sign_nexus_result(p_result);
    ELSE RAISE EXCEPTION 'unknown C03 test action';
  END CASE;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE || ':' || SQLERRM;
END;
$$;
GRANT EXECUTE ON FUNCTION public.test_c03_try_action(text,uuid,uuid) TO authenticated;

-- 1) Migration never silently classifies historical finalized rows as reviewed,
-- signed or even C-03 processed. The pre-fix auto result and C-02 history remain
-- without lifecycle evidence until a new explicit action occurs.
DO $$
DECLARE v_pre uuid;
BEGIN
  SELECT processed_result_id INTO v_pre
  FROM public.nexus_self_assessment_invites
  WHERE id='00000000-0000-0000-0000-000000000901';

  IF EXISTS (SELECT 1 FROM public.nexus_result_clinical_lifecycle) THEN
    RAISE EXCEPTION 'C03 migration silently backfilled lifecycle history';
  END IF;
  IF v_pre IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.nexus_clinical_results
    WHERE id=v_pre AND status='finalized' AND finalized_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'C03 historical finalized result was not preserved';
  END IF;
END;
$$;

-- 2) Generic manual draft: technical completion freezes the snapshot and records
-- only processing. It does not imply human review/signature.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
INSERT INTO public.nexus_clinical_results(
  id, patient_id, professional_id, appointment_id,
  module_key, tool_key, rule_key, rule_version,
  status, input_snapshot, output_snapshot, evidence_snapshot
) VALUES (
  '00000000-0000-0000-0000-000000000910',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000501',
  'scales','phq9','nexus.phq9','nexus-2026-09-03',
  'draft','{}','{}','[]'
);
SELECT public.complete_nexus_result_processing('00000000-0000-0000-0000-000000000910');
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.nexus_clinical_results r
    JOIN public.nexus_result_clinical_lifecycle l ON l.result_id=r.id
    WHERE r.id='00000000-0000-0000-0000-000000000910'
      AND r.status='finalized' AND r.finalized_at IS NOT NULL
      AND l.processed_at IS NOT NULL
      AND l.reviewed_at IS NULL AND l.reviewed_by IS NULL
      AND l.signed_at IS NULL AND l.signed_by IS NULL
  ) THEN RAISE EXCEPTION 'C03 generic processing implied human review/sign'; END IF;
END $$;

-- 3) PHQ-9 and GAD-7 automatic processors continue to work, but produce only
-- technical processing evidence.
INSERT INTO public.nexus_self_assessment_invites(
  id, clinic_id, patient_id, professional_id, appointment_id,
  scale_key, rule_version, token_hash, expires_at,
  status, submitted_at, processing_started_at, response_snapshot
) VALUES
(
  '00000000-0000-0000-0000-000000000902','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000501','phq9','nexus-2026-09-03','c03-phq9-token',
  now()+interval '1 day','submitted',now(),now(),'{}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000903','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000501','gad7','nexus-2026-09-03','c03-gad7-token',
  now()+interval '1 day','submitted',now(),now(),'{}'::jsonb
);

SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.complete_nexus_self_assessment_processing(
  '00000000-0000-0000-0000-000000000902',
  jsonb_build_object(
    'moduleKey','scales','toolKey','phq9','ruleKey','nexus.phq9','ruleVersion','nexus-2026-09-03',
    'requiredCapability','nexus.scales','inputSnapshot','{}'::jsonb,
    'outputSnapshot',jsonb_build_object('guidanceMode','clinician-review'),
    'totalScore',4,'maxScore',27,'classification','minimal','severity','low',
    'interpretation','synthetic PHQ-9','soapText','synthetic','evidenceSnapshot','[]'::jsonb
  ), '[]'::jsonb
);
SELECT public.complete_nexus_self_assessment_processing(
  '00000000-0000-0000-0000-000000000903',
  jsonb_build_object(
    'moduleKey','scales','toolKey','gad7','ruleKey','nexus.gad7','ruleVersion','nexus-2026-09-03',
    'requiredCapability','nexus.scales','inputSnapshot','{}'::jsonb,
    'outputSnapshot',jsonb_build_object('guidanceMode','clinician-review'),
    'totalScore',3,'maxScore',21,'classification','minimal','severity','low',
    'interpretation','synthetic GAD-7','soapText','synthetic','evidenceSnapshot','[]'::jsonb
  ), '[]'::jsonb
);
RESET ROLE;

DO $$
DECLARE invite_id uuid; result_id uuid;
BEGIN
  FOREACH invite_id IN ARRAY ARRAY[
    '00000000-0000-0000-0000-000000000902'::uuid,
    '00000000-0000-0000-0000-000000000903'::uuid
  ] LOOP
    SELECT processed_result_id INTO result_id
    FROM public.nexus_self_assessment_invites WHERE id=invite_id;
    IF result_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.nexus_clinical_results r
      JOIN public.nexus_result_clinical_lifecycle l ON l.result_id=r.id
      WHERE r.id=result_id AND r.status='finalized' AND r.finalized_at IS NOT NULL
        AND l.processed_at IS NOT NULL
        AND l.reviewed_at IS NULL AND l.reviewed_by IS NULL
        AND l.signed_at IS NULL AND l.signed_by IS NULL
    ) THEN
      RAISE EXCEPTION 'C03 automatic processor implied human review/sign: %',invite_id;
    END IF;
  END LOOP;
END;
$$;

-- 4) Signing before explicit review fails.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_c03_try_action('sign','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000910');
  IF v NOT LIKE 'ERR:%nexus_result_review_required_before_sign%' THEN
    RAISE EXCEPTION 'C03 sign without review escaped: %',v;
  END IF;
END $$;
RESET ROLE;

-- 5) Unrelated physician, non-medical professional, owner/admin, inactive user
-- and another tenant cannot review the author's result.
SET ROLE authenticated;
DO $$
DECLARE actor uuid; v text;
BEGIN
  FOREACH actor IN ARRAY ARRAY[
    '00000000-0000-0000-0000-000000000102'::uuid,
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000104'::uuid,
    '00000000-0000-0000-0000-000000000105'::uuid,
    '00000000-0000-0000-0000-000000000106'::uuid,
    '00000000-0000-0000-0000-000000000201'::uuid
  ] LOOP
    v := public.test_c03_try_action('review',actor,'00000000-0000-0000-0000-000000000910');
    IF v NOT LIKE 'ERR:%' THEN
      RAISE EXCEPTION 'C03 unauthorized review escaped: %',actor;
    END IF;
  END LOOP;
END $$;
RESET ROLE;

-- 6) Suspended clinic blocks clinical review through the preserved C-06 boundary.
UPDATE public.clinics SET lifecycle_status='suspended'
WHERE id='00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_c03_try_action('review','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000910');
  IF v NOT LIKE 'ERR:%' THEN RAISE EXCEPTION 'C03 suspended-clinic review escaped'; END IF;
END $$;
RESET ROLE;
UPDATE public.clinics SET lifecycle_status='active'
WHERE id='00000000-0000-0000-0000-000000000001';

-- 7) Even a privileged direct write cannot forge a reviewer different from the
-- immutable result author; the lifecycle guard is a second line of defense.
SET ROLE service_role;
DO $$
BEGIN
  BEGIN
    UPDATE public.nexus_result_clinical_lifecycle
       SET reviewed_at=now(), reviewed_by='00000000-0000-0000-0000-000000000102'
     WHERE result_id='00000000-0000-0000-0000-000000000910';
    RAISE EXCEPTION 'C03 forged reviewer escaped';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%nexus_clinical_review_author_mismatch%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- 8) Authorized author reviews the frozen snapshot, with explicit author/time.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.review_nexus_result('00000000-0000-0000-0000-000000000910');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.nexus_result_clinical_lifecycle
    WHERE result_id='00000000-0000-0000-0000-000000000910'
      AND processed_at IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND reviewed_by='00000000-0000-0000-0000-000000000101'
      AND signed_at IS NULL AND signed_by IS NULL
  ) THEN RAISE EXCEPTION 'C03 authorized human review was not recorded'; END IF;
END $$;

-- 9) Clinical sign follows review and records its own author/time.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.sign_nexus_result('00000000-0000-0000-0000-000000000910');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.nexus_result_clinical_lifecycle
    WHERE result_id='00000000-0000-0000-0000-000000000910'
      AND reviewed_at IS NOT NULL
      AND reviewed_by='00000000-0000-0000-0000-000000000101'
      AND signed_at IS NOT NULL
      AND signed_by='00000000-0000-0000-0000-000000000101'
      AND signed_at >= reviewed_at
  ) THEN RAISE EXCEPTION 'C03 clinical sign was not recorded'; END IF;
END $$;

-- 10) Signed result content and signed lifecycle are both immutable.
SET ROLE service_role;
DO $$
BEGIN
  BEGIN
    UPDATE public.nexus_clinical_results
       SET interpretation='tampered C03 signed result'
     WHERE id='00000000-0000-0000-0000-000000000910';
    RAISE EXCEPTION 'C03 signed result mutation escaped';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Resultado Nexus finalizado é imutável%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.nexus_result_clinical_lifecycle
       SET reviewed_at=reviewed_at + interval '1 second'
     WHERE result_id='00000000-0000-0000-0000-000000000910';
    RAISE EXCEPTION 'C03 signed lifecycle mutation escaped';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%nexus_clinical_lifecycle_signed_immutable%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- 11) EEM remains atomic and its existing explicit human finalization action now
-- records processing, human review and application-level clinical sign separately.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
CREATE TEMP TABLE test_c03_eem_result AS
SELECT public.finalize_nexus_eem_result(
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000501',
  'nexus-eem-2026-09-03',
  '{}'::jsonb,'{}'::jsonb,'synthetic C03',NULL,'synthetic C03',NULL,'[]'::jsonb,'[]'::jsonb
) AS id;
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM test_c03_eem_result t
    JOIN public.nexus_clinical_results r ON r.id=t.id
    JOIN public.nexus_result_clinical_lifecycle l ON l.result_id=r.id
    WHERE r.status='finalized'
      AND r.required_capability='nexus.eem'
      AND r.professional_id='00000000-0000-0000-0000-000000000101'
      AND l.processed_at IS NOT NULL
      AND l.reviewed_at IS NOT NULL AND l.reviewed_by=r.professional_id
      AND l.signed_at IS NOT NULL AND l.signed_by=r.professional_id
  ) THEN RAISE EXCEPTION 'C03 specific EEM lifecycle regressed'; END IF;
END $$;

-- 12) Historical pre-C03 auto result is still not silently reviewed/signed after
-- all new operations on other rows.
DO $$
DECLARE v_pre uuid;
BEGIN
  SELECT processed_result_id INTO v_pre
  FROM public.nexus_self_assessment_invites
  WHERE id='00000000-0000-0000-0000-000000000901';
  IF EXISTS (
    SELECT 1 FROM public.nexus_result_clinical_lifecycle WHERE result_id=v_pre
  ) THEN
    RAISE EXCEPTION 'C03 historical pre-fix result was silently reclassified';
  END IF;
END;
$$;

SELECT 'NEXUS_C03_BEHAVIOR_OK' AS result;