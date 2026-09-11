\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  email text NOT NULL,
  nome text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','fisio','recep','financeiro')),
  ativo boolean NOT NULL DEFAULT true
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
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
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active'
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
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.ativo IS TRUE
    AND c.deleted_at IS NULL
    AND c.lifecycle_status = 'active'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_clinic_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

INSERT INTO public.clinics (id, name, cnpj, lifecycle_status) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Clínica A', '11111111000111', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'Clínica B', '22222222000122', 'active'),
  ('20000000-0000-0000-0000-000000000003', 'Clínica Suspensa', '33333333000133', 'suspended');

INSERT INTO public.profiles (id, clinic_id, email, nome, role, ativo) VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner-a@example.test', 'Owner A', 'owner', true),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'admin-a@example.test', 'Admin A', 'admin', true),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'fisio-a@example.test', 'Fisio A', 'fisio', true),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'recep-a@example.test', 'Recep A', 'recep', true),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'fin-a@example.test', 'Financeiro A', 'financeiro', true),
  ('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'inactive-a@example.test', 'Inactive A', 'admin', false),
  ('10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'owner-b@example.test', 'Owner B', 'owner', true),
  ('10000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000003', 'owner-s@example.test', 'Owner Suspended', 'owner', true);
