-- MEDICSPRO — Nexus C-06 canonical professional care relationship
-- Scope: evolve the shared clinical care relationship to the canonical
-- professional role while preserving the C-01 Nexus AND boundary unchanged.
-- No policy, role data, UI or bulk fisio_id rename is performed here.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Refuse unexpected browser-role bypasses and incomplete role cutover.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname IN ('authenticated', 'anon')
      AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'nexus_c06_browser_role_bypasses_rls';
  END IF;

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

  -- fisio_id is still a temporary structural alias in the current rollout.
  -- If it exists, it must agree with the canonical reference before this helper
  -- starts using professional_id.
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

-- Refuse to overwrite stale/custom helper definitions. Re-running this migration
-- is allowed: both the reviewed pre-C06 and post-C06 fingerprints are accepted.
DO $$
DECLARE
  expected record;
  actual record;
BEGIN
  FOR expected IN
    SELECT *
    FROM (VALUES
      (
        'public.has_professional_capability(text)',
        ARRAY[
          'd3c1b16fc57c4da3f304ba086a382991',
          '858f6805dac644028692bcda9f4152bb'
        ]::text[]
      ),
      (
        'public.can_access_patient_clinical_record(uuid)',
        ARRAY[
          'e466279f68d4858a34dfc9dee8de3d98',
          '968f8fede2551a284faf2b2b743832de'
        ]::text[]
      ),
      (
        'public.list_patient_clinical_snapshot()',
        ARRAY[
          '297948ff2f19bac0d9ee58ce136c55bc',
          '3c06241a532a3f131ef519f66f2553ed'
        ]::text[]
      )
    ) AS v(signature, accepted_md5)
  LOOP
    SELECT p.*
      INTO actual
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(expected.signature);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'nexus_c06_missing_helper: %', expected.signature;
    END IF;

    IF NOT (md5(actual.prosrc) = ANY(expected.accepted_md5))
       OR NOT actual.prosecdef
       OR actual.provolatile <> 's'
       OR NOT coalesce(actual.proconfig @> ARRAY['search_path=public, pg_temp'], false)
       OR NOT has_function_privilege('authenticated', actual.oid, 'EXECUTE')
       OR has_function_privilege('anon', actual.oid, 'EXECUTE') THEN
      RAISE EXCEPTION
        'nexus_c06_helper_drift: %; review effective migrations before proceeding',
        expected.signature;
    END IF;
  END LOOP;
END;
$$;

-- C-01 is a hard prerequisite. These policies are inspected, never replaced.
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

CREATE OR REPLACE FUNCTION public.has_professional_capability(p_capability text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_role text;
  v_explicit boolean;
  v_is_nexus boolean := coalesce(p_capability, '') LIKE 'nexus.%';
BEGIN
  SELECT p.clinic_id, p.role
    INTO v_clinic_id, v_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RETURN false;
  END IF;

  -- Nexus remains fail-closed. Role never grants a Nexus capability.
  IF v_is_nexus THEN
    IF NOT public.current_nexus_entitlement_allowed()
       OR NOT public.current_nexus_medical_identity_valid() THEN
      RETURN false;
    END IF;
  END IF;

  SELECT pc.granted
    INTO v_explicit
  FROM public.professional_capabilities pc
  WHERE pc.clinic_id = v_clinic_id
    AND pc.professional_id = auth.uid()
    AND pc.capability_key = p_capability
  LIMIT 1;

  IF FOUND THEN
    RETURN coalesce(v_explicit, false);
  END IF;

  -- Historical non-Nexus compatibility is intentionally unchanged. The
  -- canonical post-cutover role is professional, so this branch is unreachable
  -- in a correctly migrated tenant and must never be extended to Nexus.
  IF v_role = 'fisio' AND NOT v_is_nexus AND p_capability IN (
    'clinical.assessments',
    'clinical.soap',
    'clinical.patient_timeline'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.has_professional_capability(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_professional_capability(text) TO authenticated;

COMMENT ON FUNCTION public.has_professional_capability(text) IS
  'Capability resolver. Nexus requires valid medical identity, effective clinic entitlement and an explicit professional capability grant/deny; operational role never grants Nexus implicitly.';

CREATE OR REPLACE FUNCTION public.can_access_patient_clinical_record(p_patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR v_role IS NULL OR p_patient_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = p_patient_id
      AND p.clinic_id = v_clinic
      AND p.deleted_at IS NULL
  ) THEN
    RETURN false;
  END IF;

  IF v_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  IF v_role <> 'professional' THEN
    RETURN false;
  END IF;

  -- A professional has a care relationship when the patient has been assigned
  -- to them in the canonical schedule reference or they authored a clinical act.
  RETURN
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.clinic_id = v_clinic
        AND a.paciente_id = p_patient_id
        AND a.professional_id = v_uid
    )
    OR EXISTS (
      SELECT 1 FROM public.physiotherapy_evaluations e
      WHERE e.clinic_id = v_clinic
        AND e.patient_id = p_patient_id
        AND e.professional_id = v_uid
    )
    OR EXISTS (
      SELECT 1 FROM public.physiotherapy_evolutions e
      WHERE e.clinic_id = v_clinic
        AND e.patient_id = p_patient_id
        AND e.professional_id = v_uid
        AND e.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.clinical_assessments a
      WHERE a.clinic_id = v_clinic
        AND a.patient_id = p_patient_id
        AND a.professional_id = v_uid
    )
    OR EXISTS (
      SELECT 1 FROM public.nexus_clinical_results n
      WHERE n.clinic_id = v_clinic
        AND n.patient_id = p_patient_id
        AND n.professional_id = v_uid
    )
    OR EXISTS (
      SELECT 1 FROM public.nexus_self_assessment_invites i
      WHERE i.clinic_id = v_clinic
        AND i.patient_id = p_patient_id
        AND i.professional_id = v_uid
    );
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_patient_clinical_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_patient_clinical_record(uuid) TO authenticated;

COMMENT ON FUNCTION public.can_access_patient_clinical_record(uuid) IS
  'Canonical clinical read boundary: owner/admin preserve tenant clinical read behavior; a professional needs a canonical appointment assignment or prior authored clinical act for the patient.';

CREATE OR REPLACE FUNCTION public.list_patient_clinical_snapshot()
RETURNS TABLE (
  patient_id uuid,
  queixa_principal text,
  cid10 text[],
  anamnese jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF v_clinic IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'tenant_context_required' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('owner', 'admin', 'professional') THEN
    RAISE EXCEPTION 'clinical_access_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.queixa_principal, p.cid10, p.anamnese
  FROM public.patients p
  WHERE p.clinic_id = v_clinic
    AND p.deleted_at IS NULL
    AND public.can_access_patient_clinical_record(p.id)
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_patient_clinical_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_patient_clinical_snapshot() TO authenticated;

COMMENT ON FUNCTION public.list_patient_clinical_snapshot() IS
  'Clinical patient projection for owner/admin and canonical professional actors; professional rows remain limited by can_access_patient_clinical_record().';

-- Postcondition: the reviewed helper bodies are now exact and C-01 policies were
-- never touched in this transaction.
DO $$
DECLARE
  expected record;
  actual record;
BEGIN
  FOR expected IN
    SELECT *
    FROM (VALUES
      ('public.has_professional_capability(text)', '858f6805dac644028692bcda9f4152bb'),
      ('public.can_access_patient_clinical_record(uuid)', '968f8fede2551a284faf2b2b743832de'),
      ('public.list_patient_clinical_snapshot()', '3c06241a532a3f131ef519f66f2553ed')
    ) AS v(signature, body_md5)
  LOOP
    SELECT p.*
      INTO actual
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(expected.signature);

    IF NOT FOUND
       OR md5(actual.prosrc) <> expected.body_md5
       OR NOT actual.prosecdef
       OR actual.provolatile <> 's'
       OR NOT coalesce(actual.proconfig @> ARRAY['search_path=public, pg_temp'], false)
       OR NOT has_function_privilege('authenticated', actual.oid, 'EXECUTE')
       OR has_function_privilege('anon', actual.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'nexus_c06_postcondition_failed: %', expected.signature;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
