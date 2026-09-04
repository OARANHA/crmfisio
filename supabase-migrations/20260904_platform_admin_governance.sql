-- MEDICSPRO — Platform Admin governance foundation
-- Separates SaaS-level administration from clinic roles.
-- IMPORTANT: production already has platform_admins/platform_audit_log from
-- 20260903_platform_provisioning.sql. This migration upgrades that schema in place.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Compatibility with installations created before this governance layer.
ALTER TABLE public.platform_admins
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.platform_automation_settings (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT platform_automation_settings_key_check CHECK (
    key IN (
      'automation.enabled',
      'finance.overdue',
      'automation.core_tick',
      'waitlist.recovery',
      'reactivation.auto',
      'evolution.worker',
      'nexus.self_assessment_processor'
    )
  )
);

-- Keep the UUID audit identity used by the provisioning migration. The governance
-- RPC returns id as text so both existing UUID rows and future callers stay stable.
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL DEFAULT 'platform',
  target_id uuid NULL,
  entity_type text NOT NULL,
  entity_key text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_audit_log
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_key text;

-- Existing provisioning rows only have target_type/target_id. Backfill the
-- governance projection without rewriting or deleting historical audit data.
UPDATE public.platform_audit_log
SET entity_type = COALESCE(entity_type, target_type, 'platform'),
    entity_key = COALESCE(entity_key, target_id::text, action)
WHERE entity_type IS NULL OR entity_key IS NULL;

ALTER TABLE public.platform_audit_log
  ALTER COLUMN entity_type SET NOT NULL,
  ALTER COLUMN entity_key SET NOT NULL,
  ALTER COLUMN target_type SET DEFAULT 'platform';

INSERT INTO public.platform_automation_settings (key, enabled)
VALUES
  ('automation.enabled', true),
  ('finance.overdue', true),
  ('automation.core_tick', true),
  ('waitlist.recovery', true),
  ('reactivation.auto', true),
  ('evolution.worker', true),
  ('nexus.self_assessment_processor', true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

-- SaaS governance is not a tenant table and is intentionally deny-by-default.
REVOKE ALL ON TABLE public.platform_admins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_automation_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_audit_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
      AND pa.ativo = true
  )
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_get_automation_settings()
RETURNS TABLE (
  key text,
  enabled boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.key, s.enabled, s.updated_at
  FROM public.platform_automation_settings s
  ORDER BY s.key;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_get_automation_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_get_automation_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_set_automation_setting(
  p_key text,
  p_enabled boolean
)
RETURNS TABLE (
  key text,
  enabled boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before boolean;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'enabled_required' USING ERRCODE = '22004';
  END IF;

  SELECT s.enabled
    INTO v_before
  FROM public.platform_automation_settings s
  WHERE s.key = p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_platform_automation_setting' USING ERRCODE = '22023';
  END IF;

  UPDATE public.platform_automation_settings s
  SET enabled = p_enabled,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE s.key = p_key;

  INSERT INTO public.platform_audit_log (
    actor_user_id,
    action,
    target_type,
    entity_type,
    entity_key,
    detail
  ) VALUES (
    auth.uid(),
    'PLATFORM_AUTOMATION_SETTING_CHANGED',
    'platform_automation_setting',
    'platform_automation_setting',
    p_key,
    jsonb_build_object('before', v_before, 'after', p_enabled)
  );

  RETURN QUERY
  SELECT s.key, s.enabled, s.updated_at
  FROM public.platform_automation_settings s
  WHERE s.key = p_key;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_set_automation_setting(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_set_automation_setting(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_get_audit_log(p_limit integer DEFAULT 30)
RETURNS TABLE (
  id text,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_key text,
  detail jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id::text, a.actor_user_id, a.action, a.entity_type, a.entity_key, a.detail, a.created_at
  FROM public.platform_audit_log a
  ORDER BY a.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_get_audit_log(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_get_audit_log(integer) TO authenticated;

COMMENT ON TABLE public.platform_admins IS
  'SaaS-level administrators. Separate from profiles.role and clinic membership.';
COMMENT ON TABLE public.platform_automation_settings IS
  'Global runtime governance toggles read by the MedicsPro scheduled orchestrator.';
COMMENT ON TABLE public.platform_audit_log IS
  'Append-only audit trail shared by provisioning and SaaS-level governance changes.';

COMMIT;
