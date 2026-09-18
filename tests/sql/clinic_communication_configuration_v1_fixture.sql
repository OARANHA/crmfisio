\set ON_ERROR_STOP on

-- This fixture extends the Plan Catalog harness after its migration has created
-- the canonical entitlement resolver.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.role', true), '')
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;

CREATE TABLE public.automation_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_settings_select_tenant
ON public.automation_settings
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY automation_settings_write_admin
ON public.automation_settings
FOR ALL TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
);

-- Production self-hosted Supabase grants broad default privileges on new public
-- tables. Reproduce that ACL drift here so the hardening migration is required.
GRANT ALL ON TABLE public.automation_settings TO anon, authenticated, service_role;

INSERT INTO public.clinics (id, name, lifecycle_status) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Clinic rollout', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'Clinic plan denied', 'active');

INSERT INTO public.automation_settings (clinic_id) VALUES
  ('20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002');

-- Clinic B receives a published plan whose WhatsApp baseline is disabled.
INSERT INTO public.platform_plans (id, plan_key, active)
VALUES ('30000000-0000-0000-0000-000000000001', 'fixture.plan', true);

INSERT INTO public.platform_plan_versions (
  id, plan_id, version, name, description
) VALUES (
  '31000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  1, 'Fixture Plan', 'Communication policy fixture'
);

INSERT INTO public.platform_plan_entitlements (
  plan_version_id, entitlement_key, enabled
)
SELECT
  '31000000-0000-0000-0000-000000000001'::uuid,
  key,
  CASE WHEN key = 'whatsapp.access' THEN false ELSE true END
FROM unnest(ARRAY[
  'nexus.access', 'finance.access', 'crm.access',
  'reports.access', 'assessments.custom', 'whatsapp.access'
]) AS key;

UPDATE public.platform_plan_versions
SET published_at = now()
WHERE id = '31000000-0000-0000-0000-000000000001';

INSERT INTO public.clinic_plan_assignments (
  id, clinic_id, plan_version_id, status, starts_at
) VALUES (
  '32000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '31000000-0000-0000-0000-000000000001',
  'active', now() - interval '1 hour'
);
