-- Disposable PostgreSQL 16 fixture for Nexus C-06. Never target production.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE FUNCTION public.uuid_generate_v4()
RETURNS uuid
LANGUAGE sql
AS $$ SELECT gen_random_uuid() $$;

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY,
  lifecycle_status text,
  deleted_at timestamptz
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id),
  role text CHECK (role IN ('owner', 'admin', 'professional', 'recep', 'financeiro')),
  ativo boolean,
  must_change_password boolean DEFAULT false,
  professional_type text,
  council_type text,
  council_state text,
  registro text
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id),
  deleted_at timestamptz,
  anonimizado boolean DEFAULT false,
  queixa_principal text,
  cid10 text[],
  anamnese jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  fisio_id uuid NOT NULL,
  professional_id uuid NOT NULL
);

CREATE TABLE public.physiotherapy_evaluations (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL
);

CREATE TABLE public.physiotherapy_evolutions (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE public.clinical_assessments (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL
);

CREATE TABLE public.assessment_body_points (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  assessment_id uuid NOT NULL
);

CREATE TABLE public.platform_clinic_entitlements (
  clinic_id uuid,
  entitlement_key text,
  enabled boolean,
  starts_at timestamptz,
  expires_at timestamptz
);

ALTER TABLE public.physiotherapy_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physiotherapy_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_body_points ENABLE ROW LEVEL SECURITY;
