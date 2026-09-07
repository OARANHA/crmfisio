-- MEDICSPRO — P1 clinical care-relationship read boundary
-- Patient operational identity remains clinic-wide, while clinical content is
-- visible to managers or professionals with an actual care relationship.

BEGIN;

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

  IF v_role <> 'fisio' THEN
    RETURN false;
  END IF;

  -- A professional has a care relationship when the patient has been assigned
  -- to them in the schedule or they have authored a clinical act for the patient.
  RETURN
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.clinic_id = v_clinic
        AND a.paciente_id = p_patient_id
        AND a.fisio_id = v_uid
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
  'Canonical clinical read boundary: managers may read tenant clinical records; a fisio needs an assigned appointment or prior authored clinical act for the patient.';

-- Patient clinical projection: keep operational patient directory separate and
-- only return sensitive patient columns when the canonical care boundary allows it.
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

  IF v_role NOT IN ('owner', 'admin', 'fisio') THEN
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

-- Legacy clinical records. The former FOR ALL write policies were also
-- permissive SELECT policies, so split read/write explicitly.
DROP POLICY IF EXISTS evaluations_select_clinical ON public.physiotherapy_evaluations;
DROP POLICY IF EXISTS evaluations_write_clinical ON public.physiotherapy_evaluations;
DROP POLICY IF EXISTS evaluations_insert_author ON public.physiotherapy_evaluations;
DROP POLICY IF EXISTS evaluations_update_author ON public.physiotherapy_evaluations;

CREATE POLICY evaluations_select_care_relationship
ON public.physiotherapy_evaluations
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
);

CREATE POLICY evaluations_insert_author
ON public.physiotherapy_evaluations
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
);

CREATE POLICY evaluations_update_author
ON public.physiotherapy_evaluations
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
);

DROP POLICY IF EXISTS evolutions_select_clinical ON public.physiotherapy_evolutions;
DROP POLICY IF EXISTS evolutions_write_clinical ON public.physiotherapy_evolutions;
DROP POLICY IF EXISTS evolutions_insert_author ON public.physiotherapy_evolutions;
DROP POLICY IF EXISTS evolutions_update_author ON public.physiotherapy_evolutions;

CREATE POLICY evolutions_select_care_relationship
ON public.physiotherapy_evolutions
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND deleted_at IS NULL
  AND public.can_access_patient_clinical_record(patient_id)
);

CREATE POLICY evolutions_insert_author
ON public.physiotherapy_evolutions
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
);

CREATE POLICY evolutions_update_author
ON public.physiotherapy_evolutions
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND professional_id = auth.uid()
);

-- Structured assessments + body map.
DROP POLICY IF EXISTS clinical_assessments_read_clinical ON public.clinical_assessments;
DROP POLICY IF EXISTS clinical_assessments_read_care_relationship ON public.clinical_assessments;
CREATE POLICY clinical_assessments_read_care_relationship
ON public.clinical_assessments
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
);

DROP POLICY IF EXISTS assessment_body_points_read_clinical ON public.assessment_body_points;
DROP POLICY IF EXISTS assessment_body_points_read_care_relationship ON public.assessment_body_points;
CREATE POLICY assessment_body_points_read_care_relationship
ON public.assessment_body_points
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.clinic_id = public.current_clinic_id()
      AND public.can_access_patient_clinical_record(a.patient_id)
  )
);

-- Nexus results and red flags are clinical chart content too.
DROP POLICY IF EXISTS nexus_results_read_clinical ON public.nexus_clinical_results;
DROP POLICY IF EXISTS nexus_results_read_care_relationship ON public.nexus_clinical_results;
CREATE POLICY nexus_results_read_care_relationship
ON public.nexus_clinical_results
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND (
    public.current_app_role() IN ('owner', 'admin')
    OR public.has_professional_capability('clinical.patient_timeline')
    OR public.has_professional_capability('nexus.access')
  )
);

DROP POLICY IF EXISTS nexus_red_flags_read_clinical ON public.nexus_red_flags;
DROP POLICY IF EXISTS nexus_red_flags_read_care_relationship ON public.nexus_red_flags;
CREATE POLICY nexus_red_flags_read_care_relationship
ON public.nexus_red_flags
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND (
    public.current_app_role() IN ('owner', 'admin')
    OR public.has_professional_capability('clinical.patient_timeline')
    OR public.has_professional_capability('nexus.access')
  )
);

-- Self-assessment responses may contain sensitive patient answers.
DROP POLICY IF EXISTS nexus_self_assessment_staff_read ON public.nexus_self_assessment_invites;
DROP POLICY IF EXISTS nexus_self_assessment_care_read ON public.nexus_self_assessment_invites;
CREATE POLICY nexus_self_assessment_care_read
ON public.nexus_self_assessment_invites
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND (
    public.current_app_role() IN ('owner', 'admin')
    OR public.has_professional_capability('nexus.scales')
  )
);

COMMIT;
