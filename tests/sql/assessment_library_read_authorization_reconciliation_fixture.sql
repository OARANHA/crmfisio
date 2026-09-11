\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
$$;

-- PostgreSQL does not implicitly cast text -> uuid from a SQL function result.
CREATE OR REPLACE FUNCTION public.test_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  clinic_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  role text NOT NULL
);

CREATE TABLE public.assessment_templates (
  id uuid PRIMARY KEY,
  clinic_id uuid,
  owner_type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE public.assessment_template_versions (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.assessment_templates(id),
  version integer NOT NULL,
  published_at timestamptz
);

ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_template_versions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.assessment_templates, public.assessment_template_versions TO authenticated;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.clinic_id
  FROM public.profiles p
  WHERE p.id = public.test_auth_uid()
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
  WHERE p.id = public.test_auth_uid()
    AND p.ativo IS TRUE
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_clinic_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

INSERT INTO public.profiles(id, clinic_id, ativo, role) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', true,  'professional'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', false, 'professional'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '22222222-2222-4222-8222-222222222222', true,  'professional'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '11111111-1111-4111-8111-111111111111', true,  'owner');

INSERT INTO public.assessment_templates(id, clinic_id, owner_type, name, status) VALUES
  ('10000000-0000-4000-8000-000000000003', NULL, 'platform', 'Anamnese Médica Geral', 'active'),
  ('10000000-0000-4000-8000-000000000004', NULL, 'platform', 'Anamnese Psiquiátrica', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '11111111-1111-4111-8111-111111111111', 'clinic', 'Modelo Clínica A', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', 'clinic', 'Modelo Clínica B', 'active');

INSERT INTO public.assessment_template_versions(id, template_id, version, published_at) VALUES
  ('11000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 1, now()),
  ('11000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 1, now()),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 1, now()),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 1, now());

-- Reproduce the effective production drift: read authorization was tied to
-- the pre-cutover role list, so a canonical `professional` saw no library rows.
CREATE POLICY assessment_templates_read_available
ON public.assessment_templates
FOR SELECT TO authenticated
USING (
  public.current_clinic_id() IS NOT NULL
  AND public.current_app_role() IN ('owner', 'admin', 'fisio')
  AND (
    owner_type = 'platform'
    OR (owner_type = 'clinic' AND clinic_id = public.current_clinic_id())
  )
);

CREATE POLICY assessment_template_versions_read_available
ON public.assessment_template_versions
FOR SELECT TO authenticated
USING (
  public.current_clinic_id() IS NOT NULL
  AND public.current_app_role() IN ('owner', 'admin', 'fisio')
  AND EXISTS (
    SELECT 1 FROM public.assessment_templates t
    WHERE t.id = assessment_template_versions.template_id
  )
);

-- Sentinel management policy: reconciliation must not broaden write authority.
CREATE POLICY assessment_templates_insert_manager_sentinel
ON public.assessment_templates
FOR INSERT TO authenticated
WITH CHECK (false);
