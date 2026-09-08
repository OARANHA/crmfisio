-- MedicsPro — Clinical foundation reconciliation
-- Canonicalizes the remaining clinical trigger boundaries after the
-- `fisio` -> `professional` role cutover and binds structured assessments to
-- the actual professional responsible for an optional appointment.
--
-- Scope is intentionally narrow: no schema redesign, no policy replacement,
-- no trigger recreation and no removal of appointments.fisio_id. The latter
-- remains a temporary compatibility alias; appointments.professional_id is the
-- canonical care-professional reference.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_clinical_assessment_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid := public.current_clinic_id();
  v_template_clinic uuid;
  v_template_owner text;
  v_version_template uuid;
BEGIN
  IF v_clinic_id IS NULL
     OR NOT public.current_user_has_clinical_capability('clinical.assessment.apply') THEN
    RAISE EXCEPTION 'clinical_assessment_author_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := v_clinic_id;
  ELSIF NEW.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'clinic_id incompatível com o usuário autenticado';
  END IF;

  IF auth.uid() IS NULL OR NEW.professional_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'professional_id deve ser o profissional autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = NEW.patient_id
      AND p.clinic_id = v_clinic_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica';
  END IF;

  IF NEW.appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id
      AND a.clinic_id = v_clinic_id
      AND a.paciente_id = NEW.patient_id
      AND a.professional_id = NEW.professional_id
  ) THEN
    RAISE EXCEPTION 'Atendimento inválido para paciente/clínica/profissional';
  END IF;

  SELECT t.clinic_id, t.owner_type
    INTO v_template_clinic, v_template_owner
  FROM public.assessment_templates t
  WHERE t.id = NEW.template_id
    AND t.status = 'active';

  IF v_template_owner IS NULL THEN
    RAISE EXCEPTION 'Modelo de avaliação inexistente ou inativo';
  END IF;

  IF v_template_owner = 'clinic' AND v_template_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'Modelo pertence a outra clínica';
  END IF;

  SELECT v.template_id
    INTO v_version_template
  FROM public.assessment_template_versions v
  WHERE v.id = NEW.template_version_id
    AND v.published_at IS NOT NULL;

  IF v_version_template IS NULL OR v_version_template <> NEW.template_id THEN
    RAISE EXCEPTION 'Versão publicada incompatível com o modelo';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_clinical_assessment_context() IS
  'Canonical structured-assessment boundary: clinical.assessment.apply + self-authorship + tenant/patient/template checks; optional appointment must belong to the same clinic, patient and professional via appointments.professional_id.';

CREATE OR REPLACE FUNCTION public.guard_legacy_clinical_self_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_clinic_id uuid := public.current_clinic_id();
  v_required_capability text;
BEGIN
  -- Controlled migrations/service repairs keep the pre-existing trusted path.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  v_required_capability := CASE TG_TABLE_NAME
    WHEN 'physiotherapy_evaluations' THEN 'clinical.assessment.apply'
    WHEN 'physiotherapy_evolutions' THEN 'clinical.evolution.write'
    ELSE NULL
  END;

  IF v_required_capability IS NULL
     OR NOT public.current_user_has_clinical_capability(v_required_capability) THEN
    RAISE EXCEPTION 'clinical_author_required' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL OR NEW.professional_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'clinical_self_authorship_required' USING ERRCODE = '42501';
  END IF;

  IF v_clinic_id IS NULL OR NEW.clinic_id IS DISTINCT FROM v_clinic_id THEN
    RAISE EXCEPTION 'clinical_tenant_mismatch' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.professional_id IS DISTINCT FROM NEW.professional_id THEN
    RAISE EXCEPTION 'clinical_author_immutable' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_legacy_clinical_self_authorship() IS
  'Compatibility-table clinical authorship guard. Authorization is capability-based and multiprofessional; self-authorship and tenant boundaries remain mandatory.';

CREATE OR REPLACE FUNCTION public.guard_clinical_evolution_session_linkage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_appointment public.appointments%ROWTYPE;
BEGIN
  -- Trusted internal/service repair paths keep working outside tenant app context.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.session_id IS DISTINCT FROM NEW.session_id
    OR OLD.patient_id IS DISTINCT FROM NEW.patient_id
    OR OLD.clinic_id IS DISTINCT FROM NEW.clinic_id
    OR OLD.professional_id IS DISTINCT FROM NEW.professional_id
  ) THEN
    RAISE EXCEPTION 'clinical_evolution_linkage_immutable' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.session_id IS NULL THEN
    RAISE EXCEPTION 'clinical_evolution_session_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.session_id IS NOT NULL THEN
    SELECT a.*
      INTO v_appointment
    FROM public.appointments AS a
    WHERE a.id = NEW.session_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'clinical_evolution_session_not_found' USING ERRCODE = '42501';
    END IF;

    IF v_appointment.clinic_id IS DISTINCT FROM NEW.clinic_id
       OR v_appointment.paciente_id IS DISTINCT FROM NEW.patient_id
       OR v_appointment.professional_id IS DISTINCT FROM NEW.professional_id THEN
      RAISE EXCEPTION 'clinical_evolution_session_mismatch' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' AND v_appointment.status <> 'em_atendimento' THEN
      RAISE EXCEPTION 'clinical_evolution_requires_active_session' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_clinical_evolution_session_linkage() IS
  'Authenticated evolution/session linkage uses canonical appointments.professional_id and requires exact clinic, patient and professional ownership; linkage fields are immutable.';

COMMIT;
