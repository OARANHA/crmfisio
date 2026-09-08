-- Nexus C-04 behavior matrix on the effective C-01/C-06/C-02/C-03 baseline.
CREATE OR REPLACE FUNCTION public.test_c04_try_incorporate(p_actor uuid, p_result uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE v_id uuid;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'c04_test_must_run_under_authenticated';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', p_actor::text, false);
  v_id := public.incorporate_nexus_result_into_clinical_record(p_result);
  RETURN 'OK:' || v_id::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE || ':' || SQLERRM;
END;
$$;
GRANT EXECUTE ON FUNCTION public.test_c04_try_incorporate(uuid,uuid) TO authenticated;

-- 1) Historical finalized C-02/pre-C03 data never becomes chart content without
-- explicit lifecycle evidence.
SET ROLE authenticated;
DO $$
DECLARE v_pre uuid; v text;
BEGIN
  SELECT processed_result_id INTO v_pre
  FROM public.nexus_self_assessment_invites
  WHERE id='00000000-0000-0000-0000-000000000901';
  v := public.test_c04_try_incorporate('00000000-0000-0000-0000-000000000101',v_pre);
  IF v NOT LIKE 'ERR:%nexus_c04_signed_lifecycle_required%' THEN
    RAISE EXCEPTION 'C04 historical result without C03 proof escaped: %',v;
  END IF;
END $$;
RESET ROLE;

-- 2) PHQ-9 processed but not reviewed cannot be incorporated.
SET ROLE authenticated;
DO $$
DECLARE v_result uuid; v text;
BEGIN
  SELECT processed_result_id INTO v_result FROM public.nexus_self_assessment_invites
  WHERE id='00000000-0000-0000-0000-000000000902';
  v := public.test_c04_try_incorporate('00000000-0000-0000-0000-000000000101',v_result);
  IF v NOT LIKE 'ERR:%nexus_c04_signed_lifecycle_required%' THEN
    RAISE EXCEPTION 'C04 processed-only PHQ9 escaped: %',v;
  END IF;
END $$;
RESET ROLE;

-- 3) Human review alone is still insufficient when C-04 requires C-03 sign.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.review_nexus_result(processed_result_id)
FROM public.nexus_self_assessment_invites
WHERE id='00000000-0000-0000-0000-000000000902';
DO $$
DECLARE v_result uuid; v text;
BEGIN
  SELECT processed_result_id INTO v_result FROM public.nexus_self_assessment_invites
  WHERE id='00000000-0000-0000-0000-000000000902';
  v := public.test_c04_try_incorporate('00000000-0000-0000-0000-000000000101',v_result);
  IF v NOT LIKE 'ERR:%nexus_c04_signed_lifecycle_required%' THEN
    RAISE EXCEPTION 'C04 reviewed-but-unsigned PHQ9 escaped: %',v;
  END IF;
END $$;
RESET ROLE;

-- 4) Signed PHQ-9 becomes one immutable/readable official-record snapshot.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.sign_nexus_result(processed_result_id)
FROM public.nexus_self_assessment_invites
WHERE id='00000000-0000-0000-0000-000000000902';
SELECT public.incorporate_nexus_result_into_clinical_record(processed_result_id)
FROM public.nexus_self_assessment_invites
WHERE id='00000000-0000-0000-0000-000000000902';
RESET ROLE;
DO $$
DECLARE v_result uuid;
BEGIN
  SELECT processed_result_id INTO v_result FROM public.nexus_self_assessment_invites
  WHERE id='00000000-0000-0000-0000-000000000902';
  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_record_nexus_incorporations i
    WHERE i.nexus_result_id=v_result
      AND i.patient_id='00000000-0000-0000-0000-000000000301'
      AND i.professional_id='00000000-0000-0000-0000-000000000101'
      AND i.tool_key='phq9' AND i.rule_key='nexus.phq9'
      AND i.rule_version='nexus-2026-09-03'
      AND i.total_score=4 AND i.max_score=27
      AND i.classification='minimal'
      AND i.clinical_summary LIKE 'PHQ9%'
      AND i.source_reviewed_at IS NOT NULL AND i.source_signed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'C04 signed PHQ9 snapshot missing or untraceable'; END IF;
END $$;

-- 5) GAD-7 follows the same explicit review/sign/incorporation contract.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.review_nexus_result(processed_result_id)
FROM public.nexus_self_assessment_invites WHERE id='00000000-0000-0000-0000-000000000903';
SELECT public.sign_nexus_result(processed_result_id)
FROM public.nexus_self_assessment_invites WHERE id='00000000-0000-0000-0000-000000000903';
SELECT public.incorporate_nexus_result_into_clinical_record(processed_result_id)
FROM public.nexus_self_assessment_invites WHERE id='00000000-0000-0000-0000-000000000903';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinical_record_nexus_incorporations i
    JOIN public.nexus_self_assessment_invites s ON s.processed_result_id=i.nexus_result_id
    WHERE s.id='00000000-0000-0000-0000-000000000903'
      AND i.tool_key='gad7' AND i.total_score=3 AND i.max_score=21
      AND i.classification='minimal'
  ) THEN RAISE EXCEPTION 'C04 signed GAD7 snapshot missing'; END IF;
END $$;

-- 6) Signed EEM incorporates its readable SOAP/narrative and source metadata;
-- raw input/output snapshots are deliberately absent from the chart table.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.incorporate_nexus_result_into_clinical_record(id) FROM test_c03_eem_result;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.clinical_record_nexus_incorporations i
    JOIN test_c03_eem_result t ON t.id=i.nexus_result_id
    WHERE i.tool_key='eem'
      AND i.rule_key='nexus.eem'
      AND i.soap_text='synthetic C03'
      AND i.clinical_summary LIKE 'EEM%'
  ) THEN RAISE EXCEPTION 'C04 signed EEM snapshot missing'; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinical_record_nexus_incorporations'
      AND column_name IN ('input_snapshot','output_snapshot','evidence_snapshot')
  ) THEN RAISE EXCEPTION 'C04 raw Nexus JSON leaked into official-record contract'; END IF;
END $$;

-- 7) Another physician, non-medical professional, owner/admin non-medical,
-- inactive user and another tenant cannot incorporate the signed author's row.
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
    v := public.test_c04_try_incorporate(actor,'00000000-0000-0000-0000-000000000910');
    IF v NOT LIKE 'ERR:%' THEN
      RAISE EXCEPTION 'C04 unauthorized actor escaped: % => %',actor,v;
    END IF;
  END LOOP;
END $$;
RESET ROLE;

-- 8) Suspended clinic blocks incorporation even for the signed author.
UPDATE public.clinics SET lifecycle_status='suspended'
WHERE id='00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_c04_try_incorporate('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000910');
  IF v NOT LIKE 'ERR:%nexus_c04_active_clinical_context_required%' THEN
    RAISE EXCEPTION 'C04 suspended clinic escaped: %',v;
  END IF;
END $$;
RESET ROLE;
UPDATE public.clinics SET lifecycle_status='active'
WHERE id='00000000-0000-0000-0000-000000000001';

-- 9) Authorized signed result incorporates; a replay returns the same id and
-- never duplicates the chart entry.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
CREATE TEMP TABLE test_c04_replay AS
SELECT public.incorporate_nexus_result_into_clinical_record('00000000-0000-0000-0000-000000000910') AS first_id;
ALTER TABLE test_c04_replay ADD COLUMN second_id uuid;
UPDATE test_c04_replay
SET second_id=public.incorporate_nexus_result_into_clinical_record('00000000-0000-0000-0000-000000000910');
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM test_c04_replay WHERE first_id IS DISTINCT FROM second_id)
     OR (SELECT count(*) FROM public.clinical_record_nexus_incorporations
         WHERE nexus_result_id='00000000-0000-0000-0000-000000000910') <> 1 THEN
    RAISE EXCEPTION 'C04 incorporation replay was not idempotent';
  END IF;
END $$;

-- 10) Browser callers cannot forge a different patient/origin by direct insert.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.clinical_record_nexus_incorporations(id)
    VALUES ('00000000-0000-0000-0000-000000000999');
    RAISE EXCEPTION 'C04 direct forged incorporation escaped';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- 11) Once incorporated, source/provenance cannot be changed or deleted, even by
-- a privileged maintenance actor; future corrections belong to C-05 addenda.
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.clinical_record_nexus_incorporations
  WHERE nexus_result_id='00000000-0000-0000-0000-000000000910';
  BEGIN
    UPDATE public.clinical_record_nexus_incorporations
       SET nexus_result_id=(SELECT processed_result_id FROM public.nexus_self_assessment_invites WHERE id='00000000-0000-0000-0000-000000000902')
     WHERE id=v_id;
    RAISE EXCEPTION 'C04 source tamper escaped';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%nexus_c04_incorporation_immutable%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.clinical_record_nexus_incorporations WHERE id=v_id;
    RAISE EXCEPTION 'C04 hard delete escaped';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%nexus_c04_incorporation_delete_forbidden%' THEN RAISE; END IF;
  END;
END $$;

-- 12) The signed Nexus snapshot remains immutable after incorporation.
DO $$ BEGIN
  BEGIN
    UPDATE public.nexus_clinical_results SET interpretation='tampered after C04'
    WHERE id='00000000-0000-0000-0000-000000000910';
    RAISE EXCEPTION 'C04 source Nexus mutation escaped';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Resultado Nexus finalizado é imutável%' THEN RAISE; END IF;
  END;
END $$;

-- 13) Historical rows without C-03 proof remain unincorporated; explicit action
-- is the only creation path.
DO $$
DECLARE v_pre uuid;
BEGIN
  SELECT processed_result_id INTO v_pre FROM public.nexus_self_assessment_invites
  WHERE id='00000000-0000-0000-0000-000000000901';
  IF EXISTS (SELECT 1 FROM public.clinical_record_nexus_incorporations WHERE nexus_result_id=v_pre) THEN
    RAISE EXCEPTION 'C04 historical result was silently incorporated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clinical_record_nexus_incorporations i
    LEFT JOIN public.nexus_result_clinical_lifecycle l ON l.result_id=i.nexus_result_id
    WHERE l.processed_at IS NULL OR l.reviewed_at IS NULL OR l.signed_at IS NULL
      OR l.reviewed_by IS DISTINCT FROM i.professional_id
      OR l.signed_by IS DISTINCT FROM i.professional_id
  ) THEN RAISE EXCEPTION 'C04 incorporation lacks signed C03 provenance'; END IF;
END $$;

SELECT 'NEXUS_C04_BEHAVIOR_OK' AS result;
