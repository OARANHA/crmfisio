-- MedicsPro — Assessment Engine foundation
-- Additive foundation for standard/custom templates, immutable versions,
-- draft/finalized clinical assessments and structured body-map points.

BEGIN;

CREATE TABLE IF NOT EXISTS public.assessment_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid REFERENCES public.clinics(id),
  owner_type text NOT NULL CHECK (owner_type IN ('platform', 'clinic')),
  name text NOT NULL,
  description text,
  specialty text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_templates_owner_scope CHECK (
    (owner_type = 'platform' AND clinic_id IS NULL)
    OR (owner_type = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.assessment_template_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id uuid NOT NULL REFERENCES public.assessment_templates(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS public.clinical_assessments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  appointment_id uuid REFERENCES public.appointments(id),
  template_id uuid NOT NULL REFERENCES public.assessment_templates(id) ON DELETE RESTRICT,
  template_version_id uuid NOT NULL REFERENCES public.assessment_template_versions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_assessment_finalized_timestamp CHECK (
    (status = 'draft' AND finalized_at IS NULL)
    OR (status = 'finalized' AND finalized_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.assessment_body_points (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  assessment_id uuid NOT NULL REFERENCES public.clinical_assessments(id) ON DELETE CASCADE,
  component_key text NOT NULL,
  view text NOT NULL CHECK (view IN ('front', 'back', 'left', 'right')),
  x numeric(7,6) NOT NULL CHECK (x >= 0 AND x <= 1),
  y numeric(7,6) NOT NULL CHECK (y >= 0 AND y <= 1),
  region text,
  laterality text CHECK (laterality IS NULL OR laterality IN ('left', 'right', 'midline', 'bilateral')),
  intensity smallint CHECK (intensity IS NULL OR (intensity >= 0 AND intensity <= 10)),
  symptom text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_templates_clinic_status
  ON public.assessment_templates(clinic_id, status, name);
CREATE INDEX IF NOT EXISTS idx_assessment_versions_template
  ON public.assessment_template_versions(template_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_assessments_patient
  ON public.clinical_assessments(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_assessments_appointment
  ON public.clinical_assessments(appointment_id)
  WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_body_points_assessment
  ON public.assessment_body_points(assessment_id, component_key);

CREATE OR REPLACE FUNCTION public.assessment_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assessment_templates_updated_at ON public.assessment_templates;
CREATE TRIGGER trg_assessment_templates_updated_at
BEFORE UPDATE ON public.assessment_templates
FOR EACH ROW EXECUTE FUNCTION public.assessment_set_updated_at();

DROP TRIGGER IF EXISTS trg_clinical_assessments_updated_at ON public.clinical_assessments;
CREATE TRIGGER trg_clinical_assessments_updated_at
BEFORE UPDATE ON public.clinical_assessments
FOR EACH ROW EXECUTE FUNCTION public.assessment_set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_body_points_updated_at ON public.assessment_body_points;
CREATE TRIGGER trg_assessment_body_points_updated_at
BEFORE UPDATE ON public.assessment_body_points
FOR EACH ROW EXECUTE FUNCTION public.assessment_set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_assessment_template_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Versão publicada de avaliação é imutável';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assessment_version_immutable ON public.assessment_template_versions;
CREATE TRIGGER trg_assessment_version_immutable
BEFORE UPDATE ON public.assessment_template_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_template_version_immutability();

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
  SELECT p.clinic_id, p.role
    INTO v_clinic_id, v_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo = true
  LIMIT 1;

  IF v_clinic_id IS NULL OR v_role <> 'fisio' THEN
    RAISE EXCEPTION 'Ato clínico exige profissional assistencial ativo';
  END IF;

  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := v_clinic_id;
  ELSIF NEW.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'clinic_id incompatível com o usuário autenticado';
  END IF;

  IF NEW.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'professional_id deve ser o profissional autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id
      AND p.clinic_id = v_clinic_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica';
  END IF;

  IF NEW.appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = NEW.appointment_id
      AND a.clinic_id = v_clinic_id
      AND a.paciente_id = NEW.patient_id
  ) THEN
    RAISE EXCEPTION 'Atendimento inválido para paciente/clínica';
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

DROP TRIGGER IF EXISTS trg_clinical_assessment_context ON public.clinical_assessments;
CREATE TRIGGER trg_clinical_assessment_context
BEFORE INSERT OR UPDATE OF clinic_id, patient_id, professional_id, appointment_id, template_id, template_version_id
ON public.clinical_assessments
FOR EACH ROW EXECUTE FUNCTION public.validate_clinical_assessment_context();

CREATE OR REPLACE FUNCTION public.guard_finalized_clinical_assessment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'finalized' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Avaliação finalizada não pode ser sobrescrita; use adendo/versionamento';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'finalized' THEN
    IF NEW.professional_id <> auth.uid() THEN
      RAISE EXCEPTION 'Somente o autor pode finalizar a avaliação';
    END IF;
    IF NEW.finalized_at IS NULL THEN
      NEW.finalized_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_assessment_finalize_guard ON public.clinical_assessments;
CREATE TRIGGER trg_clinical_assessment_finalize_guard
BEFORE UPDATE ON public.clinical_assessments
FOR EACH ROW EXECUTE FUNCTION public.guard_finalized_clinical_assessment();

CREATE OR REPLACE FUNCTION public.validate_assessment_body_point_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assessment public.clinical_assessments%ROWTYPE;
BEGIN
  SELECT * INTO v_assessment
  FROM public.clinical_assessments a
  WHERE a.id = NEW.assessment_id;

  IF v_assessment.id IS NULL THEN
    RAISE EXCEPTION 'Avaliação inexistente';
  END IF;

  IF v_assessment.status <> 'draft' THEN
    RAISE EXCEPTION 'Pontos corporais só podem ser alterados em rascunho';
  END IF;

  IF v_assessment.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o autor pode alterar o mapa corporal';
  END IF;

  NEW.clinic_id := v_assessment.clinic_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assessment_body_point_context ON public.assessment_body_points;
CREATE TRIGGER trg_assessment_body_point_context
BEFORE INSERT OR UPDATE OF clinic_id, assessment_id
ON public.assessment_body_points
FOR EACH ROW EXECUTE FUNCTION public.validate_assessment_body_point_context();

ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_body_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY assessment_templates_read_available
ON public.assessment_templates
FOR SELECT TO authenticated
USING (
  owner_type = 'platform'
  OR clinic_id = public.current_clinic_id()
);

CREATE POLICY assessment_templates_manage_clinic
ON public.assessment_templates
FOR ALL TO authenticated
USING (
  owner_type = 'clinic'
  AND clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo = true)
)
WITH CHECK (
  owner_type = 'clinic'
  AND clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin')
  AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo = true)
);

CREATE POLICY assessment_versions_read_available
ON public.assessment_template_versions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_templates t
    WHERE t.id = template_id
      AND (t.owner_type = 'platform' OR t.clinic_id = public.current_clinic_id())
  )
);

CREATE POLICY assessment_versions_manage_clinic
ON public.assessment_template_versions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_templates t
    WHERE t.id = template_id
      AND t.owner_type = 'clinic'
      AND t.clinic_id = public.current_clinic_id()
      AND public.current_app_role() IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assessment_templates t
    WHERE t.id = template_id
      AND t.owner_type = 'clinic'
      AND t.clinic_id = public.current_clinic_id()
      AND public.current_app_role() IN ('owner', 'admin')
  )
  AND (published_by IS NULL OR published_by = auth.uid())
);

CREATE POLICY clinical_assessments_read_clinical
ON public.clinical_assessments
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'fisio')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo = true)
);

CREATE POLICY clinical_assessments_insert_fisio
ON public.clinical_assessments
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_app_role() = 'fisio'
  AND status = 'draft'
);

CREATE POLICY clinical_assessments_update_author
ON public.clinical_assessments
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_app_role() = 'fisio'
  AND status = 'draft'
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND public.current_app_role() = 'fisio'
  AND status IN ('draft', 'finalized')
);

CREATE POLICY assessment_body_points_read_clinical
ON public.assessment_body_points
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'fisio')
);

CREATE POLICY assessment_body_points_insert_author
ON public.assessment_body_points
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
      AND a.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY assessment_body_points_update_author
ON public.assessment_body_points
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
  )
)
WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY assessment_body_points_delete_author
ON public.assessment_body_points
FOR DELETE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() = 'fisio'
  AND EXISTS (
    SELECT 1 FROM public.clinical_assessments a
    WHERE a.id = assessment_id
      AND a.professional_id = auth.uid()
      AND a.status = 'draft'
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_template_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.clinical_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_body_points TO authenticated;

COMMIT;
