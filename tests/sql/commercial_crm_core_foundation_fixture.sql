\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  deleted_at timestamptz,
  lifecycle_status text NOT NULL DEFAULT 'active'
);

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  role text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  funil_stage text NOT NULL DEFAULT 'lead',
  deleted_at timestamptz
);

CREATE TABLE public.patient_journey_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE
);

CREATE TABLE public.platform_clinic_entitlements (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  starts_at timestamptz,
  expires_at timestamptz,
  PRIMARY KEY (clinic_id, entitlement_key)
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid,
  acao text NOT NULL,
  detalhe text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
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
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_active_profile()
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';
  END IF;

  SELECT p.*
    INTO v_profile
  FROM public.profiles p
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active_profile_not_found' USING ERRCODE='P0002';
  END IF;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_entitlement_allowed(
  p_entitlement_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_entitlement public.platform_clinic_entitlements%ROWTYPE;
BEGIN
  IF v_clinic IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
    INTO v_entitlement
  FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = v_clinic
    AND e.entitlement_key = p_entitlement_key;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  RETURN v_entitlement.enabled IS TRUE
    AND (v_entitlement.starts_at IS NULL OR v_entitlement.starts_at <= now())
    AND (v_entitlement.expires_at IS NULL OR v_entitlement.expires_at > now());
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_patient_journey(
  p_patient_id uuid,
  p_to_stage text,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(patient_id uuid, from_stage text, to_stage text, patient_status text)
LANGUAGE sql
AS $$
  SELECT p_patient_id, 'lead'::text, p_to_stage, 'ativo'::text
$$;

REVOKE ALL ON FUNCTION public.current_clinic_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_active_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_clinic_entitlement_allowed(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_active_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_clinic_entitlement_allowed(text) TO authenticated, service_role;

INSERT INTO public.clinics (id, name, lifecycle_status) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Clinic A', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'Clinic B', 'active');

INSERT INTO auth.users (id, email) VALUES
  ('40000000-0000-0000-0000-000000000001', 'owner-a@example.test'),
  ('40000000-0000-0000-0000-000000000002', 'professional-a@example.test'),
  ('40000000-0000-0000-0000-000000000003', 'finance-a@example.test'),
  ('40000000-0000-0000-0000-000000000004', 'owner-b@example.test');

INSERT INTO public.profiles (id, clinic_id, role, ativo) VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner', true),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'professional', true),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'financeiro', true),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'owner', true);

INSERT INTO public.patients (id, clinic_id, funil_stage) VALUES
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'lead'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'lead');

INSERT INTO public.platform_clinic_entitlements (
  clinic_id, entitlement_key, enabled, source
) VALUES
  ('20000000-0000-0000-0000-000000000001', 'crm.access', true, 'manual'),
  ('20000000-0000-0000-0000-000000000002', 'crm.access', false, 'manual');
