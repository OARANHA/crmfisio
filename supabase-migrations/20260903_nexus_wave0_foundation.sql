-- MedicsPro / Nexus Clinical Engine — Onda 0
-- Fundação aditiva: profissão/capabilities + resultados clínicos + red flags + evidências.
-- Não altera RLS, RPCs, roles ou colunas legadas existentes.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Identidade profissional: garante os metadados já usados pelo cadastro.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_type text,
  ADD COLUMN IF NOT EXISTS council_type text,
  ADD COLUMN IF NOT EXISTS council_state text,
  ADD COLUMN IF NOT EXISTS especialidade text;

CREATE INDEX IF NOT EXISTS idx_profiles_clinic_professional_type
  ON public.profiles(clinic_id, professional_type)
  WHERE ativo IS TRUE AND professional_type IS NOT NULL;

CREATE OR REPLACE FUNCTION public.current_professional_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(lower(trim(p.professional_type)), '')
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_professional_type() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_professional_type() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Catálogo de capabilities e concessões por profissional.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.capability_catalog (
  capability_key text PRIMARY KEY,
  domain text NOT NULL,
  description text NOT NULL,
  clinical boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.professional_capabilities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES public.capability_catalog(capability_key) ON DELETE RESTRICT,
  granted boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professional_id, capability_key)
);

CREATE INDEX IF NOT EXISTS idx_professional_capabilities_lookup
  ON public.professional_capabilities(clinic_id, professional_id, capability_key);

INSERT INTO public.capability_catalog (capability_key, domain, description, clinical)
VALUES
  ('clinical.assessments', 'clinical', 'Criar e finalizar avaliações clínicas estruturadas', true),
  ('clinical.soap', 'clinical', 'Produzir e assinar documentação clínica SOAP', true),
  ('clinical.patient_timeline', 'clinical', 'Consultar timeline clínica longitudinal do paciente', true),
  ('nexus.access', 'nexus', 'Acessar o Nexus Clinical Engine', true),
  ('nexus.scales', 'nexus', 'Aplicar escalas clínicas Nexus', true),
  ('nexus.eem', 'nexus', 'Registrar Exame do Estado Mental Nexus', true),
  ('nexus.cognition', 'nexus', 'Aplicar instrumentos cognitivos Nexus', true),
  ('nexus.calculators', 'nexus', 'Executar calculadoras clínicas Nexus', true),
  ('nexus.psychopharmacology', 'nexus', 'Acessar ferramentas de psicofarmacologia Nexus', true),
  ('nexus.education', 'nexus', 'Acessar educação em saúde contextual Nexus', true),
  ('nexus.evidence', 'nexus', 'Consultar evidências e proveniência clínica Nexus', true)
ON CONFLICT (capability_key) DO UPDATE
SET domain = EXCLUDED.domain,
    description = EXCLUDED.description,
    clinical = EXCLUDED.clinical,
    active = true,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.validate_professional_capability_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.professional_id
      AND p.clinic_id = NEW.clinic_id
      AND p.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para a clínica informada';
  END IF;

  IF NEW.granted_by IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles g
    WHERE g.id = NEW.granted_by
      AND g.clinic_id = NEW.clinic_id
      AND g.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Responsável pela concessão inválido para a clínica informada';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_professional_capability_context ON public.professional_capabilities;
CREATE TRIGGER trg_professional_capability_context
BEFORE INSERT OR UPDATE ON public.professional_capabilities
FOR EACH ROW EXECUTE FUNCTION public.validate_professional_capability_context();

CREATE OR REPLACE FUNCTION public.has_professional_capability(p_capability text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_role text;
  v_profession text;
  v_explicit boolean;
BEGIN
  SELECT p.clinic_id, p.role, nullif(lower(trim(p.professional_type)), '')
    INTO v_clinic_id, v_role, v_profession
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT pc.granted
    INTO v_explicit
  FROM public.professional_capabilities pc
  WHERE pc.clinic_id = v_clinic_id
    AND pc.professional_id = auth.uid()
    AND pc.capability_key = p_capability
  LIMIT 1;

  -- Um grant/deny explícito sempre vence o fallback legado.
  IF FOUND THEN
    RETURN coalesce(v_explicit, false);
  END IF;

  -- Ponte de compatibilidade: preserva os profissionais clínicos atuais.
  IF v_role = 'fisio' AND p_capability IN (
    'clinical.assessments',
    'clinical.soap',
    'clinical.patient_timeline'
  ) THEN
    RETURN true;
  END IF;

  -- Médicos hoje ainda podem usar o papel clínico legado `fisio`.
  -- O professional_type, e não o role, determina acesso Nexus no fallback.
  IF v_role = 'fisio'
     AND v_profession = 'medico'
     AND p_capability IN (
       'nexus.access',
       'nexus.scales',
       'nexus.eem',
       'nexus.cognition',
       'nexus.calculators',
       'nexus.psychopharmacology',
       'nexus.education',
       'nexus.evidence'
     ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.has_professional_capability(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_professional_capability(text) TO authenticated;

ALTER TABLE public.capability_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS capability_catalog_read_authenticated ON public.capability_catalog;
CREATE POLICY capability_catalog_read_authenticated
ON public.capability_catalog
FOR SELECT TO authenticated
USING (active IS TRUE);

DROP POLICY IF EXISTS professional_capabilities_read_scope ON public.professional_capabilities;
CREATE POLICY professional_capabilities_read_scope
ON public.professional_capabilities
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    professional_id = auth.uid()
    OR public.current_app_role() IN ('owner', 'admin')
  )
);

-- Escritas ficam server-side (service role/Admin API) nesta onda.
GRANT SELECT ON public.capability_catalog TO authenticated;
GRANT SELECT ON public.professional_capabilities TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Evidências clínicas Nexus.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.nexus_evidence_sources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  evidence_key text NOT NULL UNIQUE,
  topic text NOT NULL,
  title text NOT NULL,
  source text NOT NULL,
  publication_year integer,
  summary text,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url text,
  evidence_version text NOT NULL DEFAULT '1',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(key_points) = 'array')
);

ALTER TABLE public.nexus_evidence_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nexus_evidence_read_authenticated ON public.nexus_evidence_sources;
CREATE POLICY nexus_evidence_read_authenticated
ON public.nexus_evidence_sources
FOR SELECT TO authenticated
USING (active IS TRUE);

GRANT SELECT ON public.nexus_evidence_sources TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Resultado clínico Nexus canônico.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.nexus_clinical_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  module_key text NOT NULL,
  tool_key text NOT NULL,
  rule_key text NOT NULL,
  rule_version text NOT NULL,
  required_capability text NOT NULL REFERENCES public.capability_catalog(capability_key) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_score numeric,
  max_score numeric,
  classification text,
  severity text CHECK (severity IS NULL OR severity IN ('low', 'moderate', 'high', 'severe')),
  interpretation text,
  soap_text text,
  evidence_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(input_snapshot) = 'object'),
  CHECK (jsonb_typeof(output_snapshot) = 'object'),
  CHECK (jsonb_typeof(evidence_snapshot) = 'array'),
  CHECK (
    (status = 'draft' AND finalized_at IS NULL)
    OR (status = 'finalized' AND finalized_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_nexus_results_patient_tool
  ON public.nexus_clinical_results(patient_id, tool_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_results_appointment
  ON public.nexus_clinical_results(appointment_id)
  WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nexus_results_professional
  ON public.nexus_clinical_results(professional_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_nexus_result_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid := public.current_clinic_id();
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica ativa não identificada';
  END IF;

  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := v_clinic_id;
  ELSIF NEW.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'clinic_id incompatível com o usuário autenticado';
  END IF;

  IF NEW.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'professional_id deve ser o profissional autenticado';
  END IF;

  IF NOT public.has_professional_capability(NEW.required_capability) THEN
    RAISE EXCEPTION 'Profissional sem capability para esta ferramenta Nexus';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id
      AND p.clinic_id = v_clinic_id
      AND p.deleted_at IS NULL
      AND coalesce(p.anonimizado, false) IS FALSE
  ) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.professional_id
      AND p.clinic_id = v_clinic_id
      AND p.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para esta clínica';
  END IF;

  IF NEW.appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = NEW.appointment_id
      AND a.clinic_id = v_clinic_id
      AND a.paciente_id = NEW.patient_id
  ) THEN
    RAISE EXCEPTION 'Atendimento incompatível com paciente/clínica';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexus_result_context ON public.nexus_clinical_results;
CREATE TRIGGER trg_nexus_result_context
BEFORE INSERT OR UPDATE OF clinic_id, patient_id, professional_id, appointment_id, required_capability
ON public.nexus_clinical_results
FOR EACH ROW EXECUTE FUNCTION public.validate_nexus_result_context();

CREATE OR REPLACE FUNCTION public.guard_nexus_result_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'finalized' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Resultado Nexus finalizado é imutável; registre novo resultado/adendo';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'finalized' THEN
    IF NEW.professional_id <> auth.uid() THEN
      RAISE EXCEPTION 'Somente o autor pode finalizar o resultado Nexus';
    END IF;
    IF NEW.finalized_at IS NULL THEN
      NEW.finalized_at := now();
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexus_result_immutable ON public.nexus_clinical_results;
CREATE TRIGGER trg_nexus_result_immutable
BEFORE UPDATE ON public.nexus_clinical_results
FOR EACH ROW EXECUTE FUNCTION public.guard_nexus_result_immutability();

ALTER TABLE public.nexus_clinical_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nexus_results_read_clinical ON public.nexus_clinical_results;
CREATE POLICY nexus_results_read_clinical
ON public.nexus_clinical_results
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner', 'admin')
    OR public.has_professional_capability('clinical.patient_timeline')
    OR public.has_professional_capability('nexus.access')
  )
);

DROP POLICY IF EXISTS nexus_results_insert_author ON public.nexus_clinical_results;
CREATE POLICY nexus_results_insert_author
ON public.nexus_clinical_results
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND status = 'draft'
  AND public.has_professional_capability(required_capability)
);

DROP POLICY IF EXISTS nexus_results_update_author ON public.nexus_clinical_results;
CREATE POLICY nexus_results_update_author
ON public.nexus_clinical_results
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND status = 'draft'
  AND public.has_professional_capability(required_capability)
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id = auth.uid()
  AND status IN ('draft', 'finalized')
  AND public.has_professional_capability(required_capability)
);

GRANT SELECT, INSERT, UPDATE ON public.nexus_clinical_results TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Red flags Nexus persistentes e auditáveis.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.nexus_red_flags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  result_id uuid NOT NULL REFERENCES public.nexus_clinical_results(id) ON DELETE RESTRICT,
  flag_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  required_action text,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (result_id, flag_code)
);

CREATE INDEX IF NOT EXISTS idx_nexus_red_flags_patient_open
  ON public.nexus_red_flags(patient_id, severity, created_at DESC)
  WHERE acknowledged_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_nexus_red_flag_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.nexus_clinical_results%ROWTYPE;
BEGIN
  SELECT * INTO v_result
  FROM public.nexus_clinical_results r
  WHERE r.id = NEW.result_id;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Resultado Nexus inexistente';
  END IF;

  IF v_result.clinic_id <> public.current_clinic_id() THEN
    RAISE EXCEPTION 'Resultado Nexus pertence a outra clínica';
  END IF;

  IF v_result.patient_id <> NEW.patient_id THEN
    RAISE EXCEPTION 'Red flag incompatível com o paciente do resultado';
  END IF;

  NEW.clinic_id := v_result.clinic_id;

  IF TG_OP = 'INSERT' AND v_result.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o autor do resultado pode registrar a red flag';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexus_red_flag_context ON public.nexus_red_flags;
CREATE TRIGGER trg_nexus_red_flag_context
BEFORE INSERT OR UPDATE OF clinic_id, patient_id, result_id
ON public.nexus_red_flags
FOR EACH ROW EXECUTE FUNCTION public.validate_nexus_red_flag_context();

ALTER TABLE public.nexus_red_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nexus_red_flags_read_clinical ON public.nexus_red_flags;
CREATE POLICY nexus_red_flags_read_clinical
ON public.nexus_red_flags
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner', 'admin')
    OR public.has_professional_capability('clinical.patient_timeline')
    OR public.has_professional_capability('nexus.access')
  )
);

DROP POLICY IF EXISTS nexus_red_flags_insert_author ON public.nexus_red_flags;
CREATE POLICY nexus_red_flags_insert_author
ON public.nexus_red_flags
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1 FROM public.nexus_clinical_results r
    WHERE r.id = result_id
      AND r.clinic_id = public.current_clinic_id()
      AND r.professional_id = auth.uid()
      AND r.status = 'draft'
  )
);

-- Reconhecimento é permitido para profissional clínico com acesso Nexus/timeline.
DROP POLICY IF EXISTS nexus_red_flags_acknowledge ON public.nexus_red_flags;
CREATE POLICY nexus_red_flags_acknowledge
ON public.nexus_red_flags
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND acknowledged_at IS NULL
  AND (
    public.has_professional_capability('clinical.patient_timeline')
    OR public.has_professional_capability('nexus.access')
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND acknowledged_at IS NOT NULL
  AND acknowledged_by = auth.uid()
);

GRANT SELECT, INSERT, UPDATE ON public.nexus_red_flags TO authenticated;

COMMIT;
