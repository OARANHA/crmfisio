-- MEDICSPRO — single-identity clinical authorship for solo / owner-professionals
-- Keeps the canonical clinic role model intact while allowing an owner/admin who
-- is also a validated physiotherapy professional to act clinically under the same
-- authenticated identity. Administrative owners without professional identity
-- remain unable to author physiotherapy records.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_can_author_physiotherapy()
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
  v_professional_type text;
  v_council_type text;
  v_council_state text;
  v_registration text;
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR v_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    lower(trim(coalesce(p.professional_type, ''))),
    lower(trim(coalesce(p.council_type, ''))),
    trim(coalesce(p.council_state, '')),
    trim(coalesce(p.registro, ''))
  INTO
    v_professional_type,
    v_council_type,
    v_council_state,
    v_registration
  FROM public.profiles p
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = v_uid
    AND p.clinic_id = v_clinic
    AND p.ativo IS TRUE
    AND c.deleted_at IS NULL
    AND coalesce(c.lifecycle_status, 'active') = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Compatibility bridge: existing role=fisio professionals keep the exact
  -- behavior they already had, including profiles created before professional
  -- identity metadata became mandatory.
  IF v_role = 'fisio' THEN
    RETURN true;
  END IF;

  -- A manager becomes a clinical author only through a real physiotherapy
  -- identity. Merely owning/administering the clinic never grants authorship.
  IF v_role NOT IN ('owner', 'admin') THEN
    RETURN false;
  END IF;

  RETURN
    v_professional_type IN (
      'fisioterapeuta',
      'fisioterapia',
      'physiotherapist',
      'physical therapist'
    )
    AND v_council_type = 'crefito'
    AND v_council_state <> ''
    AND v_registration <> '';
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_author_physiotherapy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_author_physiotherapy() TO authenticated;

COMMENT ON FUNCTION public.current_user_can_author_physiotherapy() IS
  'Canonical physiotherapy authorship capability. Legacy fisio roles remain compatible; owner/admin require valid physiotherapy + CREFITO identity in their own active tenant.';

-- ---------------------------------------------------------------------------
-- Legacy physiotherapy records: authorship remains self-only, but the role
-- check becomes the canonical professional-identity helper.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS evaluations_insert_author ON public.physiotherapy_evaluations;
CREATE POLICY evaluations_insert_author
ON public.physiotherapy_evaluations
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_can_author_physiotherapy()
);

DROP POLICY IF EXISTS evaluations_update_author ON public.physiotherapy_evaluations;
CREATE POLICY evaluations_update_author
ON public.physiotherapy_evaluations
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_can_author_physiotherapy()
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_can_author_physiotherapy()
);

DROP POLICY IF EXISTS evolutions_insert_author ON public.physiotherapy_evolutions;
CREATE POLICY evolutions_insert_author
ON public.physiotherapy_evolutions
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_can_author_physiotherapy()
);

DROP POLICY IF EXISTS evolutions_update_author ON public.physiotherapy_evolutions;
CREATE POLICY evolutions_update_author
ON public.physiotherapy_evolutions
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_can_author_physiotherapy()
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_can_author_physiotherapy()
);

-- ---------------------------------------------------------------------------
-- Structured assessment engine + body map.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS clinical_assessments_insert_fisio ON public.clinical_assessments;
DROP POLICY IF EXISTS clinical_assessments_insert_author ON public.clinical_assessments;
CREATE POLICY clinical_assessments_insert_author
ON public.clinical_assessments
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_can_author_physiotherapy()
  AND status = 'draft'
);

DROP POLICY IF EXISTS clinical_assessments_update_author ON public.clinical_assessments;
CREATE POLICY clinical_assessments_update_author
ON public.clinical_assessments
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_can_author_physiotherapy()
  AND status = 'draft'
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_can_author_physiotherapy()
  AND status IN ('draft', 'finalized')
);

DROP POLICY IF EXISTS assessment_body_points_insert_author ON public.assessment_body_points;
CREATE POLICY assessment_body_points_insert_author
ON public.assessment_body_points
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_user_can_author_physiotherapy()
  AND EXISTS (
    SELECT 1
    FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
      AND a.clinic_id = public.current_clinic_id()
  )
);

DROP POLICY IF EXISTS assessment_body_points_update_author ON public.assessment_body_points;
CREATE POLICY assessment_body_points_update_author
ON public.assessment_body_points
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_user_can_author_physiotherapy()
  AND EXISTS (
    SELECT 1
    FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
      AND a.clinic_id = public.current_clinic_id()
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_user_can_author_physiotherapy()
);

DROP POLICY IF EXISTS assessment_body_points_delete_author ON public.assessment_body_points;
CREATE POLICY assessment_body_points_delete_author
ON public.assessment_body_points
FOR DELETE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_user_can_author_physiotherapy()
  AND EXISTS (
    SELECT 1
    FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
      AND a.clinic_id = public.current_clinic_id()
  )
);

-- ---------------------------------------------------------------------------
-- Clinical appointment transitions.
-- Starting or finishing care is a clinical act. It therefore requires a
-- validated clinical author and the appointment must be assigned to that same
-- authenticated identity, even when the person also has owner/admin powers.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_appointment_clinical_self_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_is_clinical_transition boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Trusted internal database/service execution remains governed by the
  -- surrounding canonical flows.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_clinical_transition :=
    NEW.status = 'em_atendimento'
    OR (OLD.status = 'em_atendimento' AND NEW.status = 'finalizado');

  IF v_is_clinical_transition THEN
    IF NOT public.current_user_can_author_physiotherapy() THEN
      RAISE EXCEPTION 'clinical_professional_identity_required'
        USING ERRCODE = '42501';
    END IF;

    IF auth.uid() IS NULL
       OR OLD.fisio_id IS DISTINCT FROM auth.uid()
       OR NEW.fisio_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'appointment_clinical_self_transition_required'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- Preserve the existing rule that a legacy fisio cannot mutate another
  -- professional's appointment through non-clinical status changes either.
  IF v_role = 'fisio'
     AND (
       auth.uid() IS NULL
       OR OLD.fisio_id IS DISTINCT FROM auth.uid()
       OR NEW.fisio_id IS DISTINCT FROM auth.uid()
     ) THEN
    RAISE EXCEPTION 'appointment_fisio_self_transition_required'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_clinical_self_transition() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app_role text;
  allowed boolean := false;
  v_clinical boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  app_role := public.current_app_role();

  IF app_role IS NULL THEN
    RETURN NEW;
  END IF;

  v_clinical := NEW.status = 'em_atendimento'
    OR (OLD.status = 'em_atendimento' AND NEW.status = 'finalizado');

  IF v_clinical THEN
    allowed := public.current_user_can_author_physiotherapy()
      AND auth.uid() IS NOT NULL
      AND OLD.fisio_id = auth.uid()
      AND NEW.fisio_id = auth.uid();
  ELSIF app_role IN ('owner', 'admin') THEN
    allowed := true;
  ELSIF app_role = 'recep' THEN
    allowed :=
      (OLD.status = 'agendado' AND NEW.status IN ('confirmado', 'faltou', 'cancelado'))
      OR (OLD.status = 'confirmado' AND NEW.status IN ('faltou', 'cancelado'));
  ELSIF app_role = 'fisio' THEN
    allowed :=
      (OLD.status = 'agendado' AND NEW.status IN ('confirmado', 'faltou', 'cancelado'))
      OR (OLD.status = 'confirmado' AND NEW.status IN ('faltou', 'cancelado'));
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Transição de status não permitida para o perfil atual: % -> %', OLD.status, NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_appointment_status_transition() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_evolution_before_appointment_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'em_atendimento'
     OR NEW.status IS DISTINCT FROM 'finalizado' THEN
    RETURN NEW;
  END IF;

  -- Trusted internal/service flows have no tenant app role and retain their
  -- existing behavior. Every authenticated clinical finalization must prove
  -- authorship, self-assignment and an evolution for this exact session.
  IF public.current_app_role() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.current_user_can_author_physiotherapy()
     OR auth.uid() IS NULL
     OR NEW.fisio_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'clinical_finalize_self_authorship_required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.physiotherapy_evolutions e
    WHERE e.session_id = NEW.id
      AND e.clinic_id = NEW.clinic_id
      AND e.patient_id = NEW.paciente_id
      AND e.professional_id = auth.uid()
      AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinical_evolution_required_before_finalize'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.require_evolution_before_appointment_finalize() FROM PUBLIC, anon, authenticated;

COMMIT;
