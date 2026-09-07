-- MEDICSPRO — canonical multiprofessional clinical foundation
-- Separates operational role, professional identity and clinical capabilities.
-- This migration intentionally keeps the legacy role=fisio bridge only for the
-- short cutover window; new clinical authorization must use the generic helpers.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Generic clinical capability catalog
-- ---------------------------------------------------------------------------

INSERT INTO public.capability_catalog (capability_key, domain, description, clinical)
VALUES
  ('clinical.attend', 'clinical', 'Realizar atendimento clínico atribuído ao próprio profissional', true),
  ('clinical.timeline.read', 'clinical', 'Consultar linha do tempo clínica conforme vínculo assistencial', true),
  ('clinical.evolution.write', 'clinical', 'Registrar evolução clínica vinculada ao próprio atendimento', true),
  ('clinical.assessment.apply', 'clinical', 'Aplicar e finalizar avaliações clínicas estruturadas', true),
  ('clinical.body_map', 'clinical', 'Registrar achados em mapa corporal quando aplicável', true),
  ('clinical.documents', 'clinical', 'Operar documentos clínicos autorizados', true)
ON CONFLICT (capability_key) DO UPDATE
SET domain = EXCLUDED.domain,
    description = EXCLUDED.description,
    clinical = EXCLUDED.clinical,
    active = true,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Generic professional identity validation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_has_valid_clinical_identity()
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
  v_profession text;
  v_council text;
  v_state text;
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
  INTO v_profession, v_council, v_state, v_registration
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

  -- Transitional bridge only. Existing fisio profiles are kept working until
  -- the explicit professional-role cutover migrates the very small test set.
  IF v_role = 'fisio' THEN
    RETURN true;
  END IF;

  IF v_profession = '' THEN
    RETURN false;
  END IF;

  -- Regulated identities already modeled by the product fail closed when the
  -- expected professional credential is incomplete.
  IF v_profession IN ('fisioterapeuta', 'fisioterapia', 'physiotherapist', 'physical therapist') THEN
    RETURN v_council = 'crefito' AND v_state <> '' AND v_registration <> '';
  END IF;

  IF v_profession IN ('psicologo', 'psicólogo', 'psicologa', 'psicóloga', 'psychologist') THEN
    RETURN v_council = 'crp' AND v_state <> '' AND v_registration <> '';
  END IF;

  IF v_profession IN ('medico', 'médico', 'medica', 'médica', 'physician', 'doctor') THEN
    RETURN v_council = 'crm' AND v_state <> '' AND v_registration <> '';
  END IF;

  -- Other clinical professions (e.g. chiropractic) remain explicit rather than
  -- pretending a universal council rule exists. Their ability to act still
  -- requires an explicit clinical capability grant below.
  RETURN v_profession IN ('quiropraxista', 'quiropraxia', 'chiropractor', 'chiropractic');
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_has_valid_clinical_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_valid_clinical_identity() TO authenticated;

COMMENT ON FUNCTION public.current_user_has_valid_clinical_identity() IS
  'Generic clinical identity boundary. Known regulated professions validate council/state/registration; additional professions still require explicit clinical capability grants.';

-- ---------------------------------------------------------------------------
-- 3) Generic clinical capability helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_has_clinical_capability(p_capability text)
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
  v_explicit boolean;
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR v_role IS NULL OR coalesce(p_capability, '') = '' THEN
    RETURN false;
  END IF;

  IF NOT public.current_user_has_valid_clinical_identity() THEN
    RETURN false;
  END IF;

  SELECT pc.granted
    INTO v_explicit
  FROM public.professional_capabilities pc
  JOIN public.capability_catalog cc ON cc.capability_key = pc.capability_key
  WHERE pc.clinic_id = v_clinic
    AND pc.professional_id = v_uid
    AND pc.capability_key = p_capability
    AND cc.active IS TRUE
    AND cc.clinical IS TRUE
  LIMIT 1;

  IF FOUND THEN
    RETURN coalesce(v_explicit, false);
  END IF;

  -- Temporary compatibility bridge. This disappears after the 3 test
  -- professionals are migrated to explicit capability grants.
  IF v_role = 'fisio' AND p_capability IN (
    'clinical.attend',
    'clinical.timeline.read',
    'clinical.evolution.write',
    'clinical.assessment.apply',
    'clinical.body_map',
    'clinical.documents',
    'clinical.assessments',
    'clinical.soap',
    'clinical.patient_timeline'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_has_clinical_capability(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_clinical_capability(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_author_clinical_record()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_has_clinical_capability('clinical.evolution.write')
      OR public.current_user_has_clinical_capability('clinical.assessment.apply')
$$;

REVOKE ALL ON FUNCTION public.current_user_can_author_clinical_record() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_author_clinical_record() TO authenticated;

COMMENT ON FUNCTION public.current_user_can_author_clinical_record() IS
  'Canonical multiprofessional authorship helper. Operational role alone never grants clinical authorship.';

-- ---------------------------------------------------------------------------
-- 4) Rewire generic clinical write boundaries away from physiotherapy helper
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS evaluations_insert_author ON public.physiotherapy_evaluations;
CREATE POLICY evaluations_insert_author
ON public.physiotherapy_evaluations
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_has_clinical_capability('clinical.assessment.apply')
);

DROP POLICY IF EXISTS evaluations_update_author ON public.physiotherapy_evaluations;
CREATE POLICY evaluations_update_author
ON public.physiotherapy_evaluations
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_has_clinical_capability('clinical.assessment.apply')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_has_clinical_capability('clinical.assessment.apply')
);

DROP POLICY IF EXISTS evolutions_insert_author ON public.physiotherapy_evolutions;
CREATE POLICY evolutions_insert_author
ON public.physiotherapy_evolutions
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_has_clinical_capability('clinical.evolution.write')
);

DROP POLICY IF EXISTS evolutions_update_author ON public.physiotherapy_evolutions;
CREATE POLICY evolutions_update_author
ON public.physiotherapy_evolutions
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_has_clinical_capability('clinical.evolution.write')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_has_clinical_capability('clinical.evolution.write')
);

DROP POLICY IF EXISTS clinical_assessments_insert_author ON public.clinical_assessments;
CREATE POLICY clinical_assessments_insert_author
ON public.clinical_assessments
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_has_clinical_capability('clinical.assessment.apply')
  AND status = 'draft'
);

DROP POLICY IF EXISTS clinical_assessments_update_author ON public.clinical_assessments;
CREATE POLICY clinical_assessments_update_author
ON public.clinical_assessments
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_has_clinical_capability('clinical.assessment.apply')
  AND status = 'draft'
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_user_has_clinical_capability('clinical.assessment.apply')
  AND status IN ('draft', 'finalized')
);

DROP POLICY IF EXISTS assessment_body_points_insert_author ON public.assessment_body_points;
CREATE POLICY assessment_body_points_insert_author
ON public.assessment_body_points
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_user_has_clinical_capability('clinical.body_map')
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
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
  AND public.current_user_has_clinical_capability('clinical.body_map')
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
      AND a.clinic_id = public.current_clinic_id()
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_user_has_clinical_capability('clinical.body_map')
);

DROP POLICY IF EXISTS assessment_body_points_delete_author ON public.assessment_body_points;
CREATE POLICY assessment_body_points_delete_author
ON public.assessment_body_points
FOR DELETE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_user_has_clinical_capability('clinical.body_map')
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
      AND a.clinic_id = public.current_clinic_id()
  )
);

-- ---------------------------------------------------------------------------
-- 5) Appointment clinical transitions use capability, not profession name
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

  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_clinical_transition :=
    NEW.status = 'em_atendimento'
    OR (OLD.status = 'em_atendimento' AND NEW.status = 'finalizado');

  IF v_is_clinical_transition THEN
    IF NOT public.current_user_has_clinical_capability('clinical.attend') THEN
      RAISE EXCEPTION 'clinical_professional_capability_required'
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

  -- Temporary legacy bridge only until role=fisio is removed.
  IF v_role = 'fisio'
     AND (
       auth.uid() IS NULL
       OR OLD.fisio_id IS DISTINCT FROM auth.uid()
       OR NEW.fisio_id IS DISTINCT FROM auth.uid()
     ) THEN
    RAISE EXCEPTION 'appointment_professional_self_transition_required'
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
    allowed := public.current_user_has_clinical_capability('clinical.attend')
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

  IF public.current_app_role() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.current_user_has_clinical_capability('clinical.attend')
     OR NOT public.current_user_has_clinical_capability('clinical.evolution.write')
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
