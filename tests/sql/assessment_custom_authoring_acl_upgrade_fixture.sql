\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

CREATE TABLE public.platform_clinic_entitlements (
  clinic_id uuid NOT NULL,
  entitlement_key text NOT NULL,
  enabled boolean NOT NULL,
  starts_at timestamptz,
  expires_at timestamptz
);
CREATE TABLE public.profiles (id uuid PRIMARY KEY, clinic_id uuid, ativo boolean, role text);
CREATE TABLE public.assessment_templates (id uuid PRIMARY KEY, clinic_id uuid, owner_type text);
CREATE TABLE public.assessment_template_versions (id uuid PRIMARY KEY, template_id uuid);
ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessment_templates_read_available ON public.assessment_templates FOR SELECT TO authenticated USING (owner_type = 'platform' OR clinic_id IS NOT NULL);

-- Baseline functions intentionally contain stale direct grants. CREATE OR
-- REPLACE must not be allowed to preserve them after the upgrade migration.
CREATE FUNCTION public.require_assessment_template_manager() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.guard_custom_assessment_template_entitlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.guard_custom_assessment_version_entitlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.guard_assessment_template_version_immutability() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER trg_guard_custom_assessment_template_entitlement BEFORE INSERT ON public.assessment_templates FOR EACH ROW EXECUTE FUNCTION public.guard_custom_assessment_template_entitlement();
CREATE TRIGGER trg_guard_custom_assessment_version_entitlement BEFORE INSERT ON public.assessment_template_versions FOR EACH ROW EXECUTE FUNCTION public.guard_custom_assessment_version_entitlement();
CREATE TRIGGER trg_assessment_version_immutable BEFORE UPDATE ON public.assessment_template_versions FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_template_version_immutability();

GRANT EXECUTE ON FUNCTION public.require_assessment_template_manager() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_custom_assessment_template_entitlement() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_custom_assessment_version_entitlement() TO anon, authenticated, service_role;
