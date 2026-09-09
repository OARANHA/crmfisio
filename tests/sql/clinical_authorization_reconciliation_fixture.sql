CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

GRANT authenticated, anon, service_role TO postgres;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')
$$;

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY,
  deleted_at timestamptz,
  lifecycle_status text NOT NULL DEFAULT 'active'
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  role text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  professional_type text,
  council_type text,
  council_state text,
  registro text
);

CREATE TABLE public.capability_catalog (
  capability_key text PRIMARY KEY,
  clinical boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.professional_capabilities (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  capability_key text NOT NULL REFERENCES public.capability_catalog(capability_key),
  granted boolean NOT NULL,
  PRIMARY KEY (professional_id, capability_key)
);

CREATE TABLE public.test_entitlements (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  feature_key text NOT NULL,
  allowed boolean NOT NULL,
  PRIMARY KEY (clinic_id, feature_key)
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  funil_stage text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_journey_events (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  reason text NOT NULL,
  notes text,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  actor_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  paciente_id uuid NOT NULL REFERENCES public.patients(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  fisio_id uuid NOT NULL REFERENCES public.profiles(id),
  room_id uuid,
  data date NOT NULL DEFAULT current_date,
  inicio time NOT NULL DEFAULT time '09:00',
  fim time NOT NULL DEFAULT time '10:00',
  tipo text NOT NULL DEFAULT 'Consulta',
  valor integer NOT NULL DEFAULT 0,
  pacote_id uuid,
  serie_id uuid,
  is_fit_in boolean NOT NULL DEFAULT false,
  rescheduled_from_id uuid,
  status text NOT NULL,
  cancellation_reason text,
  arrived_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
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
SECURITY DEFINER
SET search_path = public, pg_temp
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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.ativo IS TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_entitlement_allowed(p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((
    SELECT e.allowed
    FROM public.test_entitlements e
    WHERE e.clinic_id = public.current_clinic_id()
      AND e.feature_key = p_feature
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_valid_clinical_identity()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profession text;
  v_council text;
  v_state text;
  v_registration text;
BEGIN
  SELECT
    lower(trim(coalesce(p.professional_type, ''))),
    lower(trim(coalesce(p.council_type, ''))),
    trim(coalesce(p.council_state, '')),
    trim(coalesce(p.registro, ''))
  INTO v_profession, v_council, v_state, v_registration
  FROM public.profiles p
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active';

  IF NOT FOUND OR v_profession = '' THEN RETURN false; END IF;
  IF v_profession = 'medico' THEN
    RETURN v_council = 'crm' AND v_state <> '' AND v_registration <> '';
  END IF;
  IF v_profession = 'fisioterapeuta' THEN
    RETURN v_council = 'crefito' AND v_state <> '' AND v_registration <> '';
  END IF;
  IF v_profession = 'psicologo' THEN
    RETURN v_council = 'crp' AND v_state <> '' AND v_registration <> '';
  END IF;
  RETURN v_profession = 'quiropraxista';
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_clinical_capability(p_capability text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_explicit boolean;
BEGIN
  SELECT p.* INTO v_profile
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.ativo IS TRUE;

  IF v_profile.id IS NULL OR NOT public.current_user_has_valid_clinical_identity() THEN
    RETURN false;
  END IF;

  SELECT pc.granted INTO v_explicit
  FROM public.professional_capabilities pc
  JOIN public.capability_catalog cc ON cc.capability_key = pc.capability_key
  WHERE pc.clinic_id = v_profile.clinic_id
    AND pc.professional_id = v_profile.id
    AND pc.capability_key = p_capability
    AND cc.clinical IS TRUE
    AND cc.active IS TRUE;

  IF FOUND THEN RETURN coalesce(v_explicit, false); END IF;

  IF v_profile.role = 'professional' THEN
    RETURN p_capability IN ('clinical.attend', 'clinical.evolution.write');
  END IF;

  RETURN false;
END;
$$;

-- Effective pre-reconciliation patient journey contract: clinical decisions are
-- still tied to the removed fisio role.
CREATE OR REPLACE FUNCTION public.transition_patient_journey(
  p_patient_id uuid,
  p_to_stage text,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(patient_id uuid, from_stage text, to_stage text, patient_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_from text;
  v_status text;
BEGIN
  SELECT * INTO v_actor FROM public.profiles WHERE id = auth.uid() AND ativo = true;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'Perfil ativo não encontrado' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_patient
  FROM public.patients
  WHERE id = p_patient_id AND clinic_id = v_actor.clinic_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_patient.id IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado na clínica' USING ERRCODE = 'P0002'; END IF;

  IF p_to_stage NOT IN ('lead','avaliacao','tratamento','alta') THEN RAISE EXCEPTION 'Etapa de jornada inválida'; END IF;
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'Motivo da transição é obrigatório'; END IF;

  v_from := v_patient.funil_stage;
  IF v_from = p_to_stage THEN RAISE EXCEPTION 'Paciente já está nesta etapa'; END IF;

  IF v_from = 'lead' AND p_to_stage = 'avaliacao' THEN
    IF v_actor.role NOT IN ('owner','admin','fisio','recep') THEN
      RAISE EXCEPTION 'Perfil sem permissão para encaminhar à avaliação' USING ERRCODE = '42501';
    END IF;
  ELSIF v_from = 'avaliacao' AND p_to_stage = 'tratamento' THEN
    IF v_actor.role <> 'fisio' THEN
      RAISE EXCEPTION 'Somente profissional clínico pode iniciar tratamento' USING ERRCODE = '42501';
    END IF;
  ELSIF v_from = 'tratamento' AND p_to_stage = 'alta' THEN
    IF v_actor.role <> 'fisio' THEN
      RAISE EXCEPTION 'Somente profissional clínico pode conceder alta' USING ERRCODE = '42501';
    END IF;
  ELSIF v_from = 'alta' AND p_to_stage = 'tratamento' THEN
    IF v_actor.role NOT IN ('fisio','owner','admin') THEN
      RAISE EXCEPTION 'Perfil sem permissão para reabrir tratamento' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Transição de jornada não permitida: % -> %', v_from, p_to_stage USING ERRCODE = '42501';
  END IF;

  UPDATE public.patients
  SET funil_stage = p_to_stage,
      status = CASE WHEN p_to_stage = 'alta' THEN 'alta' ELSE 'ativo' END,
      updated_at = now()
  WHERE id = v_patient.id;

  INSERT INTO public.patient_journey_events(id, clinic_id, patient_id, from_stage, to_stage, reason, notes, actor_id, actor_role)
  VALUES (gen_random_uuid(), v_actor.clinic_id, v_patient.id, v_from, p_to_stage, trim(p_reason), p_notes, v_actor.id, v_actor.role);

  v_status := CASE WHEN p_to_stage = 'alta' THEN 'alta' ELSE 'ativo' END;
  RETURN QUERY SELECT v_patient.id, v_from, p_to_stage, v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_patient_crm_stage_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE app_role text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.funil_stage IS NOT DISTINCT FROM OLD.funil_stage THEN RETURN NEW; END IF;
  IF public.current_clinic_id() IS NULL
     OR NEW.clinic_id IS DISTINCT FROM public.current_clinic_id()
     OR NOT public.current_clinic_entitlement_allowed('crm.access') THEN
    RAISE EXCEPTION 'Módulo CRM não liberado para esta clínica' USING ERRCODE = '42501';
  END IF;
  app_role := public.current_app_role();
  IF app_role IS NULL OR app_role NOT IN ('owner','admin','recep') THEN
    RAISE EXCEPTION 'Sem permissão para alterar o funil do CRM' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_patient_crm_stage_entitlement
BEFORE UPDATE OF funil_stage ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.guard_patient_crm_stage_entitlement();

CREATE OR REPLACE FUNCTION public.guard_appointment_mutation_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_jwt_role text := coalesce(auth.role(), '');
BEGIN
  IF v_jwt_role = 'service_role' OR (v_jwt_role = '' AND session_user IN ('postgres','supabase_admin')) THEN RETURN NEW; END IF;
  IF v_role IS NULL THEN RAISE EXCEPTION 'appointment_active_tenant_role_required' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF v_role = 'fisio' AND (auth.uid() IS NULL OR NEW.fisio_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'appointment_fisio_self_assignment_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF v_role = 'fisio' AND (auth.uid() IS NULL OR OLD.fisio_id IS DISTINCT FROM auth.uid() OR NEW.fisio_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'appointment_fisio_self_mutation_required' USING ERRCODE = '42501';
    END IF;
    IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
       OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
       OR NEW.fisio_id IS DISTINCT FROM OLD.fisio_id
       OR NEW.room_id IS DISTINCT FROM OLD.room_id
       OR NEW.data IS DISTINCT FROM OLD.data
       OR NEW.inicio IS DISTINCT FROM OLD.inicio
       OR NEW.fim IS DISTINCT FROM OLD.fim
       OR NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.pacote_id IS DISTINCT FROM OLD.pacote_id
       OR NEW.serie_id IS DISTINCT FROM OLD.serie_id
       OR NEW.is_fit_in IS DISTINCT FROM OLD.is_fit_in
       OR NEW.rescheduled_from_id IS DISTINCT FROM OLD.rescheduled_from_id THEN
      RAISE EXCEPTION 'appointment_structural_update_requires_canonical_flow' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF v_role IS NULL THEN RETURN NEW; END IF;
  v_is_clinical_transition := NEW.status = 'em_atendimento' OR (OLD.status = 'em_atendimento' AND NEW.status = 'finalizado');
  IF v_is_clinical_transition THEN
    IF NOT public.current_user_has_clinical_capability('clinical.attend') THEN
      RAISE EXCEPTION 'clinical_professional_capability_required' USING ERRCODE = '42501';
    END IF;
    IF auth.uid() IS NULL OR OLD.fisio_id IS DISTINCT FROM auth.uid() OR NEW.fisio_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'appointment_clinical_self_transition_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF v_role = 'professional' AND (auth.uid() IS NULL OR OLD.fisio_id IS DISTINCT FROM auth.uid() OR NEW.fisio_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'appointment_professional_self_transition_required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

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
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  app_role := public.current_app_role();
  IF app_role IS NULL THEN RETURN NEW; END IF;
  v_clinical := NEW.status = 'em_atendimento' OR (OLD.status = 'em_atendimento' AND NEW.status = 'finalizado');
  IF v_clinical THEN
    allowed := public.current_user_has_clinical_capability('clinical.attend')
      AND auth.uid() IS NOT NULL
      AND OLD.fisio_id = auth.uid()
      AND NEW.fisio_id = auth.uid();
  ELSIF app_role IN ('owner','admin') THEN
    allowed := true;
  ELSIF app_role IN ('recep','professional') THEN
    allowed := (OLD.status = 'agendado' AND NEW.status IN ('confirmado','faltou','cancelado'))
      OR (OLD.status = 'confirmado' AND NEW.status IN ('faltou','cancelado'));
  END IF;
  IF NOT allowed THEN RAISE EXCEPTION 'Transição de status não permitida para o perfil atual: % -> %', OLD.status, NEW.status USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_evolution_before_appointment_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'em_atendimento' OR NEW.status IS DISTINCT FROM 'finalizado' THEN RETURN NEW; END IF;
  IF public.current_app_role() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.current_user_has_clinical_capability('clinical.attend')
     OR NOT public.current_user_has_clinical_capability('clinical.evolution.write')
     OR auth.uid() IS NULL
     OR NEW.fisio_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'clinical_finalize_self_authorship_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.physiotherapy_evolutions e
    WHERE e.session_id = NEW.id AND e.clinic_id = NEW.clinic_id
      AND e.patient_id = NEW.paciente_id AND e.professional_id = auth.uid()
      AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinical_evolution_required_before_finalize' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_appointment_mutation_boundary
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_mutation_boundary();
CREATE TRIGGER trg_guard_appointment_clinical_self_transition
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_clinical_self_transition();
CREATE TRIGGER trg_guard_appointment_status_transition
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_status_transition();
CREATE TRIGGER trg_require_evolution_before_appointment_finalize
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.require_evolution_before_appointment_finalize();

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_journey_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY patients_select_tenant ON public.patients
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());
CREATE POLICY patients_update_operational ON public.patients
FOR UPDATE TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','fisio','recep'))
WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY appointments_select_tenant ON public.appointments
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());
CREATE POLICY appointments_insert_operational ON public.appointments
FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','fisio','recep'));
CREATE POLICY appointments_update_operational ON public.appointments
FOR UPDATE TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.current_app_role() IN ('owner','admin','fisio','recep'))
WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY journey_events_select_tenant ON public.patient_journey_events
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
GRANT SELECT, UPDATE ON public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT SELECT ON public.patient_journey_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.patient_journey_events FROM authenticated;
GRANT EXECUTE ON FUNCTION public.transition_patient_journey(uuid,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.transition_patient_journey(uuid,text,text,text) FROM anon;

INSERT INTO public.clinics(id) VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

INSERT INTO public.capability_catalog(capability_key) VALUES
  ('clinical.attend'),
  ('clinical.evolution.write');

INSERT INTO public.test_entitlements(clinic_id, feature_key, allowed) VALUES
  ('00000000-0000-0000-0000-000000000001', 'crm.access', true),
  ('00000000-0000-0000-0000-000000000002', 'crm.access', true);

INSERT INTO public.profiles(id, clinic_id, role, professional_type, council_type, council_state, registro) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'professional', 'medico', 'CRM', 'RS', 'TESTE-1'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'professional', 'medico', 'CRM', 'RS', 'TESTE-2'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'professional', 'medico', NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'recep', NULL, NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'owner', NULL, NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'admin', NULL, NULL, NULL, NULL),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'professional', 'medico', 'CRM', 'SP', 'TESTE-3');

INSERT INTO public.professional_capabilities(clinic_id, professional_id, capability_key, granted) VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'clinical.attend', true),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'clinical.evolution.write', true),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'clinical.attend', false),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'clinical.evolution.write', true),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'clinical.attend', true),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'clinical.evolution.write', true),
  ('00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'clinical.attend', true),
  ('00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'clinical.evolution.write', true);

INSERT INTO public.patients(id, clinic_id, funil_stage) VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'avaliacao'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'tratamento'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'alta'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'lead'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'avaliacao'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'avaliacao'),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'avaliacao');

INSERT INTO public.appointments(id, clinic_id, paciente_id, professional_id, fisio_id, status) VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'em_atendimento'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'em_atendimento'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'em_atendimento'),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'agendado'),
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'em_atendimento'),
  ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'em_atendimento');

INSERT INTO public.physiotherapy_evolutions(id, clinic_id, patient_id, professional_id, session_id, texto) VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Evolução válida');
