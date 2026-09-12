-- Behavioral assertions after the real C-06 bootstrap, deterministic scenario
-- fixture and this reconciliation. Every probe uses authenticated + RLS.

CREATE OR REPLACE FUNCTION public.assert_care_read_state(
  p_label text, p_patient uuid, p_expected boolean
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'care_read_probe_requires_authenticated'; END IF;
  IF public.can_access_patient_clinical_record(p_patient) IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '% expected care read %, got %', p_label, p_expected,
      public.can_access_patient_clinical_record(p_patient);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.assert_care_read_state(text,uuid,boolean) TO authenticated;

-- Positive appointment proof: professional 111 is present in fisio_id while
-- professional_id deliberately points elsewhere. No other relationship for 111
-- exists to patient 302, so ALLOW proves appointments.fisio_id is authoritative.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000111',true);
DO $$ BEGIN
  IF public.current_user_has_valid_clinical_identity() IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.timeline.read') IS NOT TRUE THEN
    RAISE EXCEPTION 'professional_read_identity_or_capability_precheck_failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE id='00000000-0000-0000-0000-000000000511'
      AND fisio_id='00000000-0000-0000-0000-000000000111'
      AND professional_id='00000000-0000-0000-0000-000000000109'
      AND professional_id<>fisio_id
  ) THEN RAISE EXCEPTION 'fisio_id_divergence_fixture_invalid'; END IF;
END $$;
SELECT public.assert_care_read_state('professional fisio_id relationship with divergent professional_id','00000000-0000-0000-0000-000000000302',true);
SELECT public.assert_care_read_state('professional cross tenant','00000000-0000-0000-0000-000000000401',false);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.physiotherapy_evaluations; IF n <> 1 THEN RAISE EXCEPTION 'evaluation RLS regression: %', n; END IF;
  SELECT count(*) INTO n FROM public.physiotherapy_evolutions; IF n <> 1 THEN RAISE EXCEPTION 'evolution RLS regression: %', n; END IF;
  SELECT count(*) INTO n FROM public.clinical_assessments; IF n <> 1 THEN RAISE EXCEPTION 'assessment RLS regression: %', n; END IF;
  SELECT count(*) INTO n FROM public.assessment_body_points; IF n <> 1 THEN RAISE EXCEPTION 'body map read RLS regression: %', n; END IF;
  SELECT count(*) INTO n FROM public.nexus_clinical_results; IF n <> 1 THEN RAISE EXCEPTION 'Nexus result RLS regression: %', n; END IF;
  SELECT count(*) INTO n FROM public.nexus_red_flags; IF n <> 1 THEN RAISE EXCEPTION 'Nexus flag RLS regression: %', n; END IF;
  SELECT count(*) INTO n FROM public.nexus_self_assessment_invites; IF n <> 1 THEN RAISE EXCEPTION 'Nexus invite RLS regression: %', n; END IF;
  SELECT count(*) INTO n FROM public.list_patient_clinical_snapshot(); IF n <> 1 THEN RAISE EXCEPTION 'snapshot RLS regression: %', n; END IF;
END $$;
COMMIT;

-- Inverse control: professional 112 has valid identity and timeline.read and is
-- present only in appointments.professional_id for patient 302. With no fisio_id
-- or other clinical relationship, the canonical boundary must deny access.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000112',true);
DO $$ BEGIN
  IF public.current_user_has_valid_clinical_identity() IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.timeline.read') IS NOT TRUE THEN
    RAISE EXCEPTION 'professional_id_only_precheck_failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE paciente_id='00000000-0000-0000-0000-000000000302'
      AND professional_id='00000000-0000-0000-0000-000000000112'
  ) OR EXISTS (
    SELECT 1 FROM public.appointments
    WHERE paciente_id='00000000-0000-0000-0000-000000000302'
      AND fisio_id='00000000-0000-0000-0000-000000000112'
  ) OR EXISTS (
    SELECT 1 FROM public.physiotherapy_evaluations
    WHERE patient_id='00000000-0000-0000-0000-000000000302'
      AND professional_id='00000000-0000-0000-0000-000000000112'
  ) OR EXISTS (
    SELECT 1 FROM public.physiotherapy_evolutions
    WHERE patient_id='00000000-0000-0000-0000-000000000302'
      AND professional_id='00000000-0000-0000-0000-000000000112'
      AND deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.clinical_assessments
    WHERE patient_id='00000000-0000-0000-0000-000000000302'
      AND professional_id='00000000-0000-0000-0000-000000000112'
  ) OR EXISTS (
    SELECT 1 FROM public.nexus_clinical_results
    WHERE patient_id='00000000-0000-0000-0000-000000000302'
      AND professional_id='00000000-0000-0000-0000-000000000112'
  ) OR EXISTS (
    SELECT 1 FROM public.nexus_self_assessment_invites
    WHERE patient_id='00000000-0000-0000-0000-000000000302'
      AND professional_id='00000000-0000-0000-0000-000000000112'
  ) THEN RAISE EXCEPTION 'professional_id_only_fixture_not_isolated'; END IF;
END $$;
SELECT public.assert_care_read_state('professional_id only is not appointment care relationship','00000000-0000-0000-0000-000000000302',false);
COMMIT;

-- Read capability is a hard, independent gate even when the professional has a
-- real appointment relationship and remains an active, valid identity.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
DO $$ BEGIN
  IF public.current_user_has_valid_clinical_identity() IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.timeline.read') IS NOT FALSE THEN
    RAISE EXCEPTION 'professional_no_read_precheck_failed';
  END IF;
END $$;
SELECT public.assert_care_read_state('professional no timeline read','00000000-0000-0000-0000-000000000301',false);
COMMIT;

-- A read-capable professional without a concrete relationship cannot read.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
DO $$ BEGIN
  IF public.current_user_has_valid_clinical_identity() IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.timeline.read') IS NOT TRUE THEN
    RAISE EXCEPTION 'professional_read_precheck_failed';
  END IF;
END $$;
SELECT public.assert_care_read_state('professional existing relationship','00000000-0000-0000-0000-000000000301',true);
SELECT public.assert_care_read_state('professional no relationship','00000000-0000-0000-0000-000000000302',false);
COMMIT;

-- Active clinic managers retain their documented clinic-wide (but never
-- cross-tenant) read path without needing a professional clinical identity.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000104',true);
SELECT public.assert_care_read_state('owner same tenant','00000000-0000-0000-0000-000000000301',true);
SELECT public.assert_care_read_state('owner cross tenant','00000000-0000-0000-0000-000000000401',false);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000105',true);
SELECT public.assert_care_read_state('admin same tenant','00000000-0000-0000-0000-000000000301',true);
SELECT public.assert_care_read_state('admin cross tenant','00000000-0000-0000-0000-000000000401',false);
COMMIT;

-- Other roles, inactive identities, a different tenant and platform context do
-- not gain an exception through this read boundary. Reception and finance also
-- prove that the snapshot returns an empty projection via the canonical helper,
-- rather than throwing from a second local role enumeration.
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000106',true);
SELECT public.assert_care_read_state('inactive professional','00000000-0000-0000-0000-000000000301',false);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000107',true);
SELECT public.assert_care_read_state('reception','00000000-0000-0000-0000-000000000301',false);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.list_patient_clinical_snapshot();
  IF n <> 0 THEN RAISE EXCEPTION 'reception snapshot expected 0, got %', n; END IF;
END $$;
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000108',true);
SELECT public.assert_care_read_state('finance','00000000-0000-0000-0000-000000000301',false);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.list_patient_clinical_snapshot();
  IF n <> 0 THEN RAISE EXCEPTION 'finance snapshot expected 0, got %', n; END IF;
END $$;
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000201',true);
SELECT public.assert_care_read_state('clinic B own relationship','00000000-0000-0000-0000-000000000401',true);
SELECT public.assert_care_read_state('clinic B cross tenant','00000000-0000-0000-0000-000000000301',false);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL row_security=on;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
SELECT public.assert_care_read_state('platform context without clinical profile','00000000-0000-0000-0000-000000000301',false);
COMMIT;

SELECT 'CLINICAL CARE RELATIONSHIP READ BEHAVIOR PASSED' AS result;
