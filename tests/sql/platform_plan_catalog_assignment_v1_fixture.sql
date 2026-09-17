CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  deleted_at timestamptz NULL,
  lifecycle_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL DEFAULT 'platform',
  target_id uuid NULL,
  entity_type text NOT NULL,
  entity_key text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_clinic_entitlements (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  starts_at timestamptz NULL,
  expires_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id),
  PRIMARY KEY (clinic_id, entitlement_key)
);

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins p
    WHERE p.user_id = auth.uid() AND p.ativo IS TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.clinic_id', true), '')::uuid
$$;

REVOKE ALL ON TABLE public.platform_admins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_clinic_entitlements FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated;
