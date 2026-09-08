CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  role text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE public.professional_capabilities (
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  capability_key text NOT NULL,
  granted boolean NOT NULL,
  PRIMARY KEY (professional_id, capability_key)
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  deleted_at timestamptz
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  paciente_id uuid NOT NULL REFERENCES public.patients(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  fisio_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL
);

CREATE TABLE public.assessment_templates (
  id uuid PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id),
  owner_type text NOT NULL,
  status text NOT NULL
);

CREATE TABLE public.assessment_template_versions (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.assessment_templates(id),
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles(id)
);

CREATE TABLE public.clinical_assessments (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  appointment_id uuid REFERENCES public.appointments(id),
  template_id uuid NOT NULL REFERENCES public.assessment_templates(id),
  template_version_id uuid NOT NULL REFERENCES public.assessment_template_versions(id),
  status text NOT NULL DEFAULT 'draft',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

CREATE TABLE public.assessment_body_points (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  assessment_id uuid NOT NULL REFERENCES public.clinical_assessments(id) ON DELETE CASCADE,
  component_key text NOT NULL,
  view text NOT NULL,
  x numeric NOT NULL,
  y numeric NOT NULL,
  region text,
  laterality text,
  intensity smallint,
  symptom text,
  note text
);

CREATE TABLE public.physiotherapy_evaluations (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  data date NOT NULL DEFAULT current_date
);

CREATE TABLE public.physiotherapy_evolutions (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  session_id uuid REFERENCES public.appointments(id),
  texto text NOT NULL,
  deleted_at timestamptz
);

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT p.clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.ativo IS TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.ativo IS TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_clinical_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo IS TRUE
      AND (
        (p.role = 'professional' AND p_capability IN (
          'clinical.attend', 'clinical.timeline.read', 'clinical.evolution.write',
          'clinical.assessment.apply', 'clinical.body_map', 'clinical.documents'
        ))
        OR EXISTS (
          SELECT 1 FROM public.professional_capabilities pc
          WHERE pc.professional_id = p.id
            AND pc.capability_key = p_capability
            AND pc.granted IS TRUE
        )
      )
  )
$$;

-- Effective pre-reconciliation Assessment guard reconstructed from the migration chain.
CREATE OR REPLACE FUNCTION public.validate_clinical_assessment_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_role text;
  v_template_clinic uuid;
  v_template_owner text;
  v_version_template uuid;
BEGIN
  SELECT p.clinic_id, p.role INTO v_clinic_id, v_role
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.ativo = true
  LIMIT 1;
  IF v_clinic_id IS NULL OR v_role <> 'fisio' THEN
    RAISE EXCEPTION 'Ato clínico exige profissional assistencial ativo';
  END IF;
  IF NEW.clinic_id IS NULL THEN NEW.clinic_id := v_clinic_id;
  ELSIF NEW.clinic_id <> v_clinic_id THEN RAISE EXCEPTION 'clinic_id incompatível com o usuário autenticado'; END IF;
  IF NEW.professional_id <> auth.uid() THEN RAISE EXCEPTION 'professional_id deve ser o profissional autenticado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_id AND p.clinic_id = v_clinic_id AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica';
  END IF;
  IF NEW.appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = NEW.appointment_id AND a.clinic_id = v_clinic_id AND a.paciente_id = NEW.patient_id
  ) THEN
    RAISE EXCEPTION 'Atendimento inválido para paciente/clínica';
  END IF;
  SELECT t.clinic_id, t.owner_type INTO v_template_clinic, v_template_owner
  FROM public.assessment_templates t WHERE t.id = NEW.template_id AND t.status = 'active';
  IF v_template_owner IS NULL THEN RAISE EXCEPTION 'Modelo de avaliação inexistente ou inativo'; END IF;
  IF v_template_owner = 'clinic' AND v_template_clinic <> v_clinic_id THEN RAISE EXCEPTION 'Modelo pertence a outra clínica'; END IF;
  SELECT v.template_id INTO v_version_template FROM public.assessment_template_versions v
  WHERE v.id = NEW.template_version_id AND v.published_at IS NOT NULL;
  IF v_version_template IS NULL OR v_version_template <> NEW.template_id THEN RAISE EXCEPTION 'Versão publicada incompatível com o modelo'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clinical_assessment_context
BEFORE INSERT OR UPDATE OF clinic_id, patient_id, professional_id, appointment_id, template_id, template_version_id
ON public.clinical_assessments
FOR EACH ROW EXECUTE FUNCTION public.validate_clinical_assessment_context();

-- Effective pre-reconciliation self-authorship guard: still role='fisio'.
CREATE OR REPLACE FUNCTION public.guard_legacy_clinical_self_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_clinic_id uuid := public.current_clinic_id();
BEGIN
  IF v_role IS NULL THEN RETURN NEW; END IF;
  IF v_role <> 'fisio' THEN RAISE EXCEPTION 'clinical_author_required' USING ERRCODE = '42501'; END IF;
  IF auth.uid() IS NULL OR NEW.professional_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'clinical_self_authorship_required' USING ERRCODE = '42501'; END IF;
  IF v_clinic_id IS NULL OR NEW.clinic_id IS DISTINCT FROM v_clinic_id THEN RAISE EXCEPTION 'clinical_tenant_mismatch' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.professional_id IS DISTINCT FROM NEW.professional_id THEN RAISE EXCEPTION 'clinical_author_immutable' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evaluations_self_authorship
BEFORE INSERT OR UPDATE ON public.physiotherapy_evaluations
FOR EACH ROW EXECUTE FUNCTION public.guard_legacy_clinical_self_authorship();
CREATE TRIGGER trg_evolutions_self_authorship
BEFORE INSERT OR UPDATE ON public.physiotherapy_evolutions
FOR EACH ROW EXECUTE FUNCTION public.guard_legacy_clinical_self_authorship();

-- Effective pre-reconciliation evolution linkage uses appointments.fisio_id.
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
  IF v_role IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD.session_id IS DISTINCT FROM NEW.session_id OR OLD.patient_id IS DISTINCT FROM NEW.patient_id
    OR OLD.clinic_id IS DISTINCT FROM NEW.clinic_id OR OLD.professional_id IS DISTINCT FROM NEW.professional_id
  ) THEN RAISE EXCEPTION 'clinical_evolution_linkage_immutable' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'INSERT' AND NEW.session_id IS NULL THEN RAISE EXCEPTION 'clinical_evolution_session_required' USING ERRCODE = '42501'; END IF;
  SELECT a.* INTO v_appointment FROM public.appointments a WHERE a.id = NEW.session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'clinical_evolution_session_not_found' USING ERRCODE = '42501'; END IF;
  IF v_appointment.clinic_id IS DISTINCT FROM NEW.clinic_id
     OR v_appointment.paciente_id IS DISTINCT FROM NEW.patient_id
     OR v_appointment.fisio_id IS DISTINCT FROM NEW.professional_id THEN
    RAISE EXCEPTION 'clinical_evolution_session_mismatch' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' AND v_appointment.status <> 'em_atendimento' THEN RAISE EXCEPTION 'clinical_evolution_requires_active_session' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evolutions_session_linkage
BEFORE INSERT OR UPDATE ON public.physiotherapy_evolutions
FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_evolution_session_linkage();

CREATE OR REPLACE FUNCTION public.guard_finalized_clinical_assessment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'finalized' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Avaliação finalizada não pode ser sobrescrita'; END IF;
  IF OLD.status = 'draft' AND NEW.status = 'finalized' THEN
    IF NEW.professional_id <> auth.uid() THEN RAISE EXCEPTION 'Somente o autor pode finalizar a avaliação'; END IF;
    IF NEW.finalized_at IS NULL THEN NEW.finalized_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_clinical_assessment_finalize_guard
BEFORE UPDATE ON public.clinical_assessments FOR EACH ROW EXECUTE FUNCTION public.guard_finalized_clinical_assessment();

CREATE OR REPLACE FUNCTION public.guard_assessment_template_version_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN IF OLD.published_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Versão publicada de avaliação é imutável'; END IF; RETURN NEW; END;
$$;
CREATE TRIGGER trg_assessment_version_immutable BEFORE UPDATE ON public.assessment_template_versions FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_template_version_immutability();

CREATE OR REPLACE FUNCTION public.guard_assessment_template_version_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN IF OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Versão publicada de avaliação não pode ser excluída'; END IF; RETURN OLD; END;
$$;
CREATE TRIGGER trg_assessment_version_delete_guard BEFORE DELETE ON public.assessment_template_versions FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_template_version_delete();

CREATE OR REPLACE FUNCTION public.validate_assessment_body_point_context()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_assessment public.clinical_assessments%ROWTYPE;
BEGIN
  SELECT * INTO v_assessment FROM public.clinical_assessments a WHERE a.id = NEW.assessment_id;
  IF v_assessment.id IS NULL THEN RAISE EXCEPTION 'Avaliação inexistente'; END IF;
  IF v_assessment.status <> 'draft' THEN RAISE EXCEPTION 'Pontos corporais só podem ser alterados em rascunho'; END IF;
  IF v_assessment.professional_id <> auth.uid() THEN RAISE EXCEPTION 'Somente o autor pode alterar o mapa corporal'; END IF;
  NEW.clinic_id := v_assessment.clinic_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_assessment_body_point_context
BEFORE INSERT OR UPDATE OF clinic_id, assessment_id ON public.assessment_body_points
FOR EACH ROW EXECUTE FUNCTION public.validate_assessment_body_point_context();

INSERT INTO public.clinics(id) VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

INSERT INTO public.profiles(id, clinic_id, role, ativo) VALUES
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','professional',true),
  ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','professional',true),
  ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000001','owner',true),
  ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001','admin',true),
  ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002','professional',true);

-- Owner/admin get an explicit assessment capability here so negative tests prove
-- there is still no impersonation bypass even when capability is present.
INSERT INTO public.professional_capabilities VALUES
  ('00000000-0000-0000-0000-000000000013','clinical.assessment.apply',true),
  ('00000000-0000-0000-0000-000000000014','clinical.assessment.apply',true);

INSERT INTO public.patients(id, clinic_id) VALUES
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000002');

INSERT INTO public.appointments(id, clinic_id, paciente_id, professional_id, fisio_id, status) VALUES
  ('00000000-0000-0000-0000-000000001101','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000011','em_atendimento'),
  ('00000000-0000-0000-0000-000000001102','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000012','em_atendimento'),
  ('00000000-0000-0000-0000-000000001103','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000011','em_atendimento'),
  ('00000000-0000-0000-0000-000000002101','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000021','em_atendimento');

INSERT INTO public.assessment_templates(id, clinic_id, owner_type, status) VALUES
  ('00000000-0000-0000-0000-000000003001',NULL,'platform','active'),
  ('00000000-0000-0000-0000-000000003002','00000000-0000-0000-0000-000000000001','clinic','active');
INSERT INTO public.assessment_template_versions(id, template_id, schema, published_at) VALUES
  ('00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003001','{"sections":[]}',now()),
  ('00000000-0000-0000-0000-000000003102','00000000-0000-0000-0000-000000003002','{"sections":[]}',now());
