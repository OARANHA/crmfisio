\pset pager off
-- Production-safe C-06 verifier. It is read-only: exact helper fingerprints and
-- policy metadata are checked here; the full actor matrix and artificial-policy
-- adversarial test run in the disposable PostgreSQL 16 C-06 harness.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  expected record;
  actual record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname IN ('authenticated', 'anon')
      AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'nexus_c06_browser_role_bypasses_rls';
  END IF;

  FOR expected IN
    SELECT *
    FROM (VALUES
      ('public.current_clinic_id()', '678fac3c2bb8698a44f8a9d9b282f53d'),
      ('public.current_app_role()', '7b2e6e62d9fb349ba6aa48c0744c34a7'),
      ('public.current_nexus_medical_identity_valid()', '59f4b68dda8c2c166ba803ad62f2b509'),
      ('public.current_nexus_entitlement_allowed()', 'fb31e7618a47bd017ad21ec60b12b084'),
      ('public.has_professional_capability(text)', '501cf03c6f0a99ca970f3f491c64083b'),
      ('public.can_access_patient_clinical_record(uuid)', '6a9314528b66df705c5ff36c3619831d'),
      ('public.list_patient_clinical_snapshot()', '2dfeb251865ec09623324341564b10f9')
    ) AS v(signature, body_md5)
  LOOP
    SELECT p.*
      INTO actual
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(expected.signature);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'nexus_c06_missing_helper: %', expected.signature;
    END IF;

    IF md5(actual.prosrc) <> expected.body_md5
       OR NOT actual.prosecdef
       OR actual.provolatile <> 's'
       OR NOT coalesce(actual.proconfig @> ARRAY['search_path=public, pg_temp'], false)
       OR NOT has_function_privilege('authenticated', actual.oid, 'EXECUTE')
       OR has_function_privilege('anon', actual.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'nexus_c06_helper_drift: %', expected.signature;
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_has text;
  v_care text;
BEGIN
  SELECT prosrc INTO v_has
  FROM pg_proc
  WHERE oid = 'public.has_professional_capability(text)'::regprocedure;

  IF v_has ~* 'v_role\s*=\s*''professional''[\s\S]*v_is_nexus[\s\S]*p_capability\s+IN'
     OR v_has ~* 'v_role\s*=\s*''fisio''\s+AND\s+v_is_nexus\s+AND\s+p_capability\s+IN' THEN
    RAISE EXCEPTION 'nexus_c06_implicit_nexus_role_fallback_detected';
  END IF;

  SELECT prosrc INTO v_care
  FROM pg_proc
  WHERE oid = 'public.can_access_patient_clinical_record(uuid)'::regprocedure;

  IF position('a.professional_id = v_uid' IN v_care) = 0
     OR position('a.fisio_id = v_uid' IN v_care) > 0
     OR position('v_role <> ''professional''' IN v_care) = 0 THEN
    RAISE EXCEPTION 'nexus_c06_canonical_care_relationship_not_effective';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE role::text = 'fisio'
  ) THEN
    RAISE EXCEPTION 'nexus_c06_legacy_fisio_role_present';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.appointments'::regclass
      AND attname = 'professional_id'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'nexus_c06_missing_appointments_professional_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.appointments'::regclass
      AND attname = 'fisio_id'
      AND NOT attisdropped
  ) AND EXISTS (
    SELECT 1
    FROM public.appointments
    WHERE professional_id IS DISTINCT FROM fisio_id
  ) THEN
    RAISE EXCEPTION 'nexus_c06_appointment_professional_bridge_drift';
  END IF;
END;
$$;

-- C-01 policies and RESTRICTIVE guards must remain expression-equivalent. The
-- helper fingerprints above are intentionally C-06, not historical C-01.
DO $$
DECLARE
  expected record;
  actual record;
  expr text;
BEGIN
  FOR expected IN
    SELECT *
    FROM (VALUES
      ('nexus_clinical_results', 'nexus_results_read_care_relationship', 'nexus_results_read_guard', false),
      ('nexus_red_flags', 'nexus_red_flags_read_care_relationship', 'nexus_red_flags_read_guard', false),
      ('nexus_self_assessment_invites', 'nexus_self_assessment_care_read', 'nexus_self_assessment_read_guard', true)
    ) AS v(table_name, allow_name, guard_name, scales)
  LOOP
    IF NOT coalesce((
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = to_regclass('public.' || expected.table_name)
    ), false) THEN
      RAISE EXCEPTION 'nexus_c06_c01_rls_disabled_or_missing: %', expected.table_name;
    END IF;

    expr := 'clinic_id=current_clinic_idANDcan_access_patient_clinical_recordpatient_idANDhas_professional_capability''nexus.access''';
    IF expected.scales THEN
      expr := expr || 'ANDhas_professional_capability''nexus.scales''';
    END IF;

    FOR actual IN
      SELECT *
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = expected.table_name
        AND policyname IN (expected.allow_name, expected.guard_name)
    LOOP
      IF actual.cmd <> 'SELECT'
         OR actual.with_check IS NOT NULL
         OR actual.permissive <> (
           CASE
             WHEN actual.policyname = expected.guard_name THEN 'RESTRICTIVE'
             ELSE 'PERMISSIVE'
           END
         )
         OR actual.roles <> (
           CASE
             WHEN actual.policyname = expected.guard_name
               THEN ARRAY['public']::name[]
             ELSE ARRAY['authenticated']::name[]
           END
         )
         OR regexp_replace(
              replace(replace(actual.qual, 'public.', ''), '::text', ''),
              '[[:space:]()]',
              '',
              'g'
            ) IS DISTINCT FROM expr THEN
        RAISE EXCEPTION 'nexus_c06_c01_policy_drift: %', actual.policyname;
      END IF;
    END LOOP;

    IF (
      SELECT count(*)
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = expected.table_name
        AND policyname IN (expected.allow_name, expected.guard_name)
    ) <> 2 THEN
      RAISE EXCEPTION 'nexus_c06_c01_policy_missing: %', expected.table_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'nexus_results_read_clinical',
        'nexus_red_flags_read_clinical',
        'nexus_self_assessment_staff_read'
      )
  ) THEN
    RAISE EXCEPTION 'nexus_c06_obsolete_c01_policy_present';
  END IF;
END;
$$;

-- Shared clinical SELECT surfaces must still delegate patient-level access to
-- the canonical care helper.
DO $$
DECLARE
  expected record;
  actual record;
BEGIN
  FOR expected IN
    SELECT *
    FROM (VALUES
      ('physiotherapy_evaluations', 'evaluations_select_care_relationship'),
      ('physiotherapy_evolutions', 'evolutions_select_care_relationship'),
      ('clinical_assessments', 'clinical_assessments_read_care_relationship'),
      ('assessment_body_points', 'assessment_body_points_read_care_relationship')
    ) AS v(table_name, policy_name)
  LOOP
    SELECT *
      INTO actual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = expected.table_name
      AND policyname = expected.policy_name;

    IF NOT FOUND
       OR actual.cmd <> 'SELECT'
       OR actual.permissive <> 'PERMISSIVE'
       OR actual.roles <> ARRAY['authenticated']::name[]
       OR position('can_access_patient_clinical_record' IN coalesce(actual.qual, '')) = 0 THEN
      RAISE EXCEPTION
        'nexus_c06_shared_clinical_policy_drift: %.%',
        expected.table_name,
        expected.policy_name;
    END IF;
  END LOOP;
END;
$$;

SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'nexus_clinical_results',
    'nexus_red_flags',
    'nexus_self_assessment_invites',
    'physiotherapy_evaluations',
    'physiotherapy_evolutions',
    'clinical_assessments',
    'assessment_body_points'
  )
ORDER BY tablename, cmd, policyname;

SELECT 'NEXUS_C06_VERIFIED' AS result;
COMMIT;
