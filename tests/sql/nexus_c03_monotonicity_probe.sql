-- Nexus C-03 monotonicity/idempotency probe on the disposable PostgreSQL 16 DB.
-- It uses a fresh unsigned lifecycle so timestamp-order validation is tested before
-- the terminal signed guard can apply, then proves repeated RPCs never regress or
-- rewrite processing/review/sign evidence.

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);

INSERT INTO public.nexus_clinical_results(
  id, patient_id, professional_id, appointment_id,
  module_key, tool_key, rule_key, rule_version,
  status, input_snapshot, output_snapshot, evidence_snapshot
) VALUES (
  '00000000-0000-0000-0000-000000000912',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000501',
  'scales','phq9','nexus.phq9','nexus-2026-09-03',
  'draft','{}','{}','[]'
);

SELECT public.complete_nexus_result_processing(
  '00000000-0000-0000-0000-000000000912'
);

DO $$
DECLARE
  v_before timestamptz;
  v_after timestamptz;
BEGIN
  SELECT processed_at INTO v_before
  FROM public.nexus_result_clinical_lifecycle
  WHERE result_id='00000000-0000-0000-0000-000000000912';

  PERFORM public.complete_nexus_result_processing(
    '00000000-0000-0000-0000-000000000912'
  );

  SELECT processed_at INTO v_after
  FROM public.nexus_result_clinical_lifecycle
  WHERE result_id='00000000-0000-0000-0000-000000000912';

  IF v_before IS NULL OR v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'C03 repeated processing rewrote processed_at';
  END IF;
END;
$$;
RESET ROLE;

-- Direct UPDATE exists only in this disposable DB so the trigger's chronological
-- guards are exercised independently of browser ACL.
GRANT UPDATE ON public.nexus_result_clinical_lifecycle TO service_role;
SET ROLE service_role;
DO $$
BEGIN
  BEGIN
    UPDATE public.nexus_result_clinical_lifecycle
       SET reviewed_at = processed_at - interval '1 second',
           reviewed_by = '00000000-0000-0000-0000-000000000101'
     WHERE result_id='00000000-0000-0000-0000-000000000912';
    RAISE EXCEPTION 'C03 invalid review chronology escaped';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%nexus_clinical_review_timestamp_invalid%' THEN
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.review_nexus_result('00000000-0000-0000-0000-000000000912');

DO $$
DECLARE
  v_processed_before timestamptz;
  v_reviewed_before timestamptz;
  v_processed_after timestamptz;
  v_reviewed_after timestamptz;
BEGIN
  SELECT processed_at, reviewed_at
    INTO v_processed_before, v_reviewed_before
  FROM public.nexus_result_clinical_lifecycle
  WHERE result_id='00000000-0000-0000-0000-000000000912';

  PERFORM public.review_nexus_result(
    '00000000-0000-0000-0000-000000000912'
  );

  SELECT processed_at, reviewed_at
    INTO v_processed_after, v_reviewed_after
  FROM public.nexus_result_clinical_lifecycle
  WHERE result_id='00000000-0000-0000-0000-000000000912';

  IF v_reviewed_before IS NULL
     OR v_processed_after IS DISTINCT FROM v_processed_before
     OR v_reviewed_after IS DISTINCT FROM v_reviewed_before THEN
    RAISE EXCEPTION 'C03 repeated review regressed lifecycle timestamps';
  END IF;
END;
$$;
RESET ROLE;

SET ROLE service_role;
DO $$
BEGIN
  BEGIN
    UPDATE public.nexus_result_clinical_lifecycle
       SET signed_at = reviewed_at - interval '1 second',
           signed_by = '00000000-0000-0000-0000-000000000101'
     WHERE result_id='00000000-0000-0000-0000-000000000912';
    RAISE EXCEPTION 'C03 invalid sign chronology escaped';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%nexus_clinical_sign_timestamp_invalid%' THEN
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;
REVOKE UPDATE ON public.nexus_result_clinical_lifecycle FROM service_role;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.sign_nexus_result('00000000-0000-0000-0000-000000000912');

DO $$
DECLARE
  v_processed_before timestamptz;
  v_reviewed_before timestamptz;
  v_signed_before timestamptz;
  v_updated_before timestamptz;
  v_processed_after timestamptz;
  v_reviewed_after timestamptz;
  v_signed_after timestamptz;
  v_updated_after timestamptz;
BEGIN
  SELECT processed_at, reviewed_at, signed_at, updated_at
    INTO v_processed_before, v_reviewed_before, v_signed_before, v_updated_before
  FROM public.nexus_result_clinical_lifecycle
  WHERE result_id='00000000-0000-0000-0000-000000000912';

  IF v_processed_before IS NULL OR v_reviewed_before IS NULL OR v_signed_before IS NULL
     OR v_reviewed_before < v_processed_before
     OR v_signed_before < v_reviewed_before THEN
    RAISE EXCEPTION 'C03 lifecycle was not monotonic before idempotency replay';
  END IF;

  PERFORM public.complete_nexus_result_processing(
    '00000000-0000-0000-0000-000000000912'
  );
  PERFORM public.review_nexus_result(
    '00000000-0000-0000-0000-000000000912'
  );
  PERFORM public.sign_nexus_result(
    '00000000-0000-0000-0000-000000000912'
  );

  SELECT processed_at, reviewed_at, signed_at, updated_at
    INTO v_processed_after, v_reviewed_after, v_signed_after, v_updated_after
  FROM public.nexus_result_clinical_lifecycle
  WHERE result_id='00000000-0000-0000-0000-000000000912';

  IF v_processed_after IS DISTINCT FROM v_processed_before
     OR v_reviewed_after IS DISTINCT FROM v_reviewed_before
     OR v_signed_after IS DISTINCT FROM v_signed_before
     OR v_updated_after IS DISTINCT FROM v_updated_before THEN
    RAISE EXCEPTION 'C03 repeated RPC replay rewrote signed lifecycle evidence';
  END IF;
END;
$$;
RESET ROLE;

SELECT 'NEXUS_C03_MONOTONICITY_PROBE_OK' AS result;
