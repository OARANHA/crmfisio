-- Behavioral assertions run as SECURITY INVOKER under browser roles.
CREATE FUNCTION public.test_c06_nexus_counts(
  label text,
  expected integer,
  invites integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  actual integer;
  t text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'c06_test_must_run_under_browser_rls';
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'nexus_clinical_results',
    'nexus_red_flags',
    'nexus_self_assessment_invites'
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO actual;
    IF actual <> (
      CASE
        WHEN t = 'nexus_self_assessment_invites'
          THEN coalesce(invites, expected)
        ELSE expected
      END
    ) THEN
      RAISE EXCEPTION
        'C06 Nexus assertion % table %: expected %, got %',
        label,
        t,
        CASE
          WHEN t = 'nexus_self_assessment_invites'
            THEN coalesce(invites, expected)
          ELSE expected
        END,
        actual;
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.test_c06_shared_counts(
  label text,
  expected integer,
  snapshot_expected integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  actual integer;
  snapshot_actual integer := 0;
  t text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'c06_test_must_run_under_browser_rls';
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'physiotherapy_evaluations',
    'physiotherapy_evolutions',
    'clinical_assessments',
    'assessment_body_points'
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO actual;
    IF actual <> expected THEN
      RAISE EXCEPTION
        'C06 shared assertion % table %: expected %, got %',
        label, t, expected, actual;
    END IF;
  END LOOP;

  BEGIN
    SELECT count(*) INTO snapshot_actual
    FROM public.list_patient_clinical_snapshot();
  EXCEPTION
    WHEN insufficient_privilege THEN
      snapshot_actual := 0;
  END;

  IF snapshot_actual <> coalesce(snapshot_expected, expected) THEN
    RAISE EXCEPTION
      'C06 snapshot assertion %: expected %, got %',
      label, coalesce(snapshot_expected, expected), snapshot_actual;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_c06_nexus_counts(text, integer, integer)
  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.test_c06_shared_counts(text, integer, integer)
  TO authenticated, anon;

-- 1) Canonical medical professional + explicit grants + appointment relationship.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
DO $$
BEGIN
  IF NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000301')
     OR public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000302')
     OR public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000401')
     OR NOT public.has_professional_capability('nexus.access') THEN
    RAISE EXCEPTION 'authorized professional medical boundary failed';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('authorized medical professional with appointment', 1);
SELECT public.test_c06_shared_counts('authorized medical professional with appointment', 1);
RESET ROLE;

-- 2) Medical professional with grants but no relationship.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
DO $$
BEGIN
  IF public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000301')
     OR public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000302')
     OR NOT public.has_professional_capability('nexus.access') THEN
    RAISE EXCEPTION 'medical no-care precondition failed';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('medical professional without care relationship', 0);
SELECT public.test_c06_shared_counts('medical professional without care relationship', 0);
RESET ROLE;

-- 3) Medical professional with relationship but no explicit Nexus grant.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000110', false);
DO $$
BEGIN
  IF NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000301')
     OR public.has_professional_capability('nexus.access') THEN
    RAISE EXCEPTION 'role-based Nexus fallback was reintroduced';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('medical professional without explicit Nexus grant', 0);
SELECT public.test_c06_shared_counts('medical professional without explicit Nexus grant', 1);
RESET ROLE;

-- 4) Clinic entitlement remains mandatory and independent of clinical reading.
UPDATE public.platform_clinic_entitlements
SET enabled = false
WHERE clinic_id = '00000000-0000-0000-0000-000000000001'
  AND entitlement_key = 'nexus.access';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
DO $$
BEGIN
  IF public.has_professional_capability('nexus.access') THEN
    RAISE EXCEPTION 'disabled entitlement allowed Nexus';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('medical professional without entitlement', 0);
SELECT public.test_c06_shared_counts('medical professional without entitlement', 1);
RESET ROLE;

UPDATE public.platform_clinic_entitlements
SET enabled = true
WHERE clinic_id = '00000000-0000-0000-0000-000000000001'
  AND entitlement_key = 'nexus.access';

-- 5) Explicit deny continues to win.
UPDATE public.professional_capabilities
SET granted = false
WHERE professional_id = '00000000-0000-0000-0000-000000000101'
  AND capability_key = 'nexus.access';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
DO $$
BEGIN
  IF public.has_professional_capability('nexus.access') THEN
    RAISE EXCEPTION 'explicit Nexus deny did not prevail';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('explicit Nexus access deny', 0);
SELECT public.test_c06_shared_counts('explicit Nexus access deny', 1);
RESET ROLE;

UPDATE public.professional_capabilities
SET granted = true
WHERE professional_id = '00000000-0000-0000-0000-000000000101'
  AND capability_key = 'nexus.access';

-- 6) nexus.scales deny only removes invite visibility.
UPDATE public.professional_capabilities
SET granted = false
WHERE professional_id = '00000000-0000-0000-0000-000000000101'
  AND capability_key = 'nexus.scales';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
SELECT public.test_c06_nexus_counts('explicit scales deny', 1, 0);
RESET ROLE;

UPDATE public.professional_capabilities
SET granted = true
WHERE professional_id = '00000000-0000-0000-0000-000000000101'
  AND capability_key = 'nexus.scales';

-- 7) Non-medical professional may use the shared care relationship, but the
-- medical Nexus boundary blocks even explicit Nexus grants.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', false);
DO $$
BEGIN
  IF NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000301')
     OR public.has_professional_capability('nexus.access') THEN
    RAISE EXCEPTION 'nonmedical professional separation failed';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('nonmedical professional with care and grants', 0);
SELECT public.test_c06_shared_counts('nonmedical professional with care and grants', 1);
RESET ROLE;

-- 8) owner/admin preserve documented clinic-wide clinical read, but non-medical
-- managers never cross the Nexus medical boundary.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', false);
DO $$
BEGIN
  IF NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000301')
     OR NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000302')
     OR public.has_professional_capability('nexus.access') THEN
    RAISE EXCEPTION 'nonmedical owner boundary failed';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('nonmedical owner with grants', 0);
SELECT public.test_c06_shared_counts('nonmedical owner with grants', 2);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000105', false);
DO $$
BEGIN
  IF NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000301')
     OR NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000302')
     OR public.has_professional_capability('nexus.access') THEN
    RAISE EXCEPTION 'nonmedical admin boundary failed';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('nonmedical admin with grants', 0);
SELECT public.test_c06_shared_counts('nonmedical admin with grants', 2);
RESET ROLE;

-- 9) Inactive users fail tenant context even if appointment/grants exist.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000106', false);
DO $$
BEGIN
  IF public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000301')
     OR public.has_professional_capability('nexus.access') THEN
    RAISE EXCEPTION 'inactive user boundary failed';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('inactive medical professional', 0);
SELECT public.test_c06_shared_counts('inactive medical professional', 0);
RESET ROLE;

-- 10) Reception and finance remain outside clinical content.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000107', false);
SELECT public.test_c06_nexus_counts('reception', 0);
SELECT public.test_c06_shared_counts('reception', 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000108', false);
SELECT public.test_c06_nexus_counts('finance', 0);
SELECT public.test_c06_shared_counts('finance', 0);
RESET ROLE;

-- 11) Authorship remains a valid care relationship independently of appointment.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000109', false);
DO $$
BEGIN
  IF NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000301')
     OR NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000302') THEN
    RAISE EXCEPTION 'professional authorship relationship failed';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('medical professional with authored care', 2);
SELECT public.test_c06_shared_counts('medical professional with authored care', 2);
RESET ROLE;

-- 12) Suspended clinic closes all browser tenant context.
UPDATE public.clinics
SET lifecycle_status = 'suspended'
WHERE id = '00000000-0000-0000-0000-000000000001';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
SELECT public.test_c06_nexus_counts('suspended clinic', 0);
SELECT public.test_c06_shared_counts('suspended clinic', 0);
RESET ROLE;

UPDATE public.clinics
SET lifecycle_status = 'active'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 13) Other tenant can see only its own linked patient and records.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', false);
DO $$
BEGIN
  IF public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000301')
     OR NOT public.can_access_patient_clinical_record('00000000-0000-0000-0000-000000000401') THEN
    RAISE EXCEPTION 'cross-tenant care relationship failed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.nexus_clinical_results
    WHERE clinic_id = '00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'cross-tenant Nexus result leaked';
  END IF;
END;
$$;
SELECT public.test_c06_nexus_counts('other tenant own data only', 1);
SELECT public.test_c06_shared_counts('other tenant own data only', 1);
RESET ROLE;

-- 14) A permissive USING(true) policy cannot bypass C-01 RESTRICTIVE guards.
CREATE POLICY test_c06_allow_all
ON public.nexus_clinical_results
FOR ALL TO PUBLIC
USING (true)
WITH CHECK (true);

CREATE POLICY test_c06_allow_all
ON public.nexus_red_flags
FOR ALL TO PUBLIC
USING (true)
WITH CHECK (true);

CREATE POLICY test_c06_allow_all
ON public.nexus_self_assessment_invites
FOR ALL TO PUBLIC
USING (true)
WITH CHECK (true);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', false);
SELECT public.test_c06_nexus_counts('restrictive guard blocks nonmedical owner', 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', false);
SELECT public.test_c06_nexus_counts('restrictive guard blocks nonmedical professional', 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
SELECT public.test_c06_nexus_counts('restrictive guard blocks missing care', 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
SELECT public.test_c06_nexus_counts('restrictive guard preserves authorized professional', 1);
RESET ROLE;

DROP POLICY test_c06_allow_all ON public.nexus_clinical_results;
DROP POLICY test_c06_allow_all ON public.nexus_red_flags;
DROP POLICY test_c06_allow_all ON public.nexus_self_assessment_invites;

-- 15) Anonymous access remains blocked even with table SELECT grants in fixture.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$
DECLARE
  t text;
  actual integer;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'nexus_clinical_results',
    'nexus_red_flags',
    'nexus_self_assessment_invites',
    'physiotherapy_evaluations',
    'physiotherapy_evolutions',
    'clinical_assessments',
    'assessment_body_points'
  ]
  LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO actual;
      IF actual <> 0 THEN
        RAISE EXCEPTION 'anonymous leaked table %', t;
      END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  BEGIN
    PERFORM public.list_patient_clinical_snapshot();
    RAISE EXCEPTION 'anonymous executed clinical snapshot';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

-- 16) Structural compatibility remains data-equal without restoring fisio role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'fisio') THEN
    RAISE EXCEPTION 'legacy fisio role reintroduced';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE professional_id IS DISTINCT FROM fisio_id
  ) THEN
    RAISE EXCEPTION 'appointment compatibility bridge diverged';
  END IF;
END;
$$;

SELECT 'NEXUS_C06_BEHAVIOR_OK' AS result;
