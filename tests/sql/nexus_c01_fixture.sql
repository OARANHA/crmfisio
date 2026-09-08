-- Disposable database only. Minimal dependency schema; production helper bodies,
-- Nexus table definitions and policies are loaded verbatim by the harness.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
CREATE TABLE public.clinics (id uuid PRIMARY KEY, lifecycle_status text, deleted_at timestamptz);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, clinic_id uuid REFERENCES public.clinics(id), role text,
  ativo boolean, must_change_password boolean DEFAULT false, professional_type text,
  council_type text, council_state text, registro text
);
CREATE TABLE public.patients (id uuid PRIMARY KEY, clinic_id uuid REFERENCES public.clinics(id), deleted_at timestamptz, anonimizado boolean DEFAULT false);
CREATE TABLE public.appointments (id uuid PRIMARY KEY, clinic_id uuid, paciente_id uuid, fisio_id uuid);
CREATE TABLE public.physiotherapy_evaluations (id uuid PRIMARY KEY, clinic_id uuid, patient_id uuid, professional_id uuid);
CREATE TABLE public.physiotherapy_evolutions (id uuid PRIMARY KEY, clinic_id uuid, patient_id uuid, professional_id uuid, deleted_at timestamptz);
CREATE TABLE public.clinical_assessments (id uuid PRIMARY KEY, clinic_id uuid, patient_id uuid, professional_id uuid);
CREATE TABLE public.platform_clinic_entitlements (clinic_id uuid, entitlement_key text, enabled boolean, starts_at timestamptz, expires_at timestamptz);
