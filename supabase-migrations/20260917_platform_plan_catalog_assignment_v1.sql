-- MEDICSPRO — Plan Catalog + Clinic Plan Assignment V1
-- Commercial baseline is separate from explicit clinic entitlement overrides.
-- Effective order: manual override -> active plan baseline -> legacy rollout default.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT platform_plans_key_check CHECK (plan_key ~ '^[a-z0-9][a-z0-9._-]{1,63}$')
);

CREATE TABLE IF NOT EXISTS public.platform_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.platform_plans(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  published_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (plan_id, version)
);

CREATE TABLE IF NOT EXISTS public.platform_plan_entitlements (
  plan_version_id uuid NOT NULL REFERENCES public.platform_plan_versions(id) ON DELETE RESTRICT,
  entitlement_key text NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY (plan_version_id, entitlement_key),
  CONSTRAINT platform_plan_entitlements_key_check CHECK (
    entitlement_key IN (
      'nexus.access', 'finance.access', 'crm.access',
      'reports.access', 'assessments.custom', 'whatsapp.access'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.clinic_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  plan_version_id uuid NOT NULL REFERENCES public.platform_plan_versions(id) ON DELETE RESTRICT,
  status text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NULL,
  ends_at timestamptz NULL,
  reason text NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT clinic_plan_assignments_status_check CHECK (status IN ('active','trialing','past_due','canceled')),
  CONSTRAINT clinic_plan_assignments_window_check CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT clinic_plan_assignments_trial_check CHECK (
    (status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at > starts_at)
    OR status <> 'trialing'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS clinic_plan_assignments_one_open_idx
  ON public.clinic_plan_assignments (clinic_id)
  WHERE ends_at IS NULL;
CREATE INDEX IF NOT EXISTS clinic_plan_assignments_history_idx
  ON public.clinic_plan_assignments (clinic_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS platform_plan_versions_latest_idx
  ON public.platform_plan_versions (plan_id, version DESC);

ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_plan_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_plan_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_plan_entitlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.clinic_plan_assignments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_published_plan_version_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'published_plan_version_immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'published_plan_version_immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL THEN
    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.name IS DISTINCT FROM OLD.name
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'plan_publish_may_only_set_published_at' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_published_plan_entitlement_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_published_at timestamptz;
BEGIN
  SELECT v.published_at INTO v_published_at
  FROM public.platform_plan_versions v
  WHERE v.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.plan_version_id ELSE NEW.plan_version_id END;
  IF v_published_at IS NOT NULL THEN
    RAISE EXCEPTION 'published_plan_entitlements_immutable' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_published_plan_version_immutable ON public.platform_plan_versions;
CREATE TRIGGER trg_guard_published_plan_version_immutable
BEFORE UPDATE OR DELETE ON public.platform_plan_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_published_plan_version_immutable();

DROP TRIGGER IF EXISTS trg_guard_published_plan_entitlement_immutable ON public.platform_plan_entitlements;
CREATE TRIGGER trg_guard_published_plan_entitlement_immutable
BEFORE INSERT OR UPDATE OR DELETE ON public.platform_plan_entitlements
FOR EACH ROW EXECUTE FUNCTION public.guard_published_plan_entitlement_immutable();

CREATE OR REPLACE FUNCTION public.platform_assert_plan_entitlements(p_entitlements jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  IF p_entitlements IS NULL OR jsonb_typeof(p_entitlements) <> 'object' THEN
    RAISE EXCEPTION 'plan_entitlements_object_required' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_count FROM jsonb_each(p_entitlements);
  IF v_count <> 6
     OR NOT (p_entitlements ?& ARRAY['nexus.access','finance.access','crm.access','reports.access','assessments.custom','whatsapp.access'])
     OR EXISTS (SELECT 1 FROM jsonb_each(p_entitlements) e WHERE jsonb_typeof(e.value) <> 'boolean') THEN
    RAISE EXCEPTION 'plan_entitlements_must_define_exact_supported_catalog' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_publish_plan_version(
  p_plan_id uuid,
  p_name text,
  p_description text,
  p_entitlements jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version integer;
  v_version_id uuid;
  v_plan_key text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;
  IF nullif(trim(coalesce(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'plan_name_required' USING ERRCODE = '22023';
  END IF;
  PERFORM public.platform_assert_plan_entitlements(p_entitlements);

  SELECT p.plan_key INTO v_plan_key
  FROM public.platform_plans p
  WHERE p.id = p_plan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(max(v.version), 0) + 1 INTO v_version
  FROM public.platform_plan_versions v
  WHERE v.plan_id = p_plan_id;

  INSERT INTO public.platform_plan_versions (
    plan_id, version, name, description, created_by
  ) VALUES (
    p_plan_id, v_version, trim(p_name), coalesce(trim(p_description), ''), auth.uid()
  ) RETURNING id INTO v_version_id;

  INSERT INTO public.platform_plan_entitlements (plan_version_id, entitlement_key, enabled)
  SELECT v_version_id, e.key, (e.value #>> '{}')::boolean
  FROM jsonb_each(p_entitlements) e;

  UPDATE public.platform_plan_versions
  SET published_at = now()
  WHERE id = v_version_id;

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, entity_type, entity_key, detail
  ) VALUES (
    auth.uid(), 'PLATFORM_PLAN_VERSION_PUBLISHED', 'platform_plan', v_plan_key,
    jsonb_build_object(
      'plan_id', p_plan_id,
      'plan_key', v_plan_key,
      'version_id', v_version_id,
      'version', v_version,
      'name', trim(p_name),
      'entitlements', p_entitlements
    )
  );

  RETURN v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_plan(
  p_plan_key text,
  p_name text,
  p_description text,
  p_entitlements jsonb,
  p_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan_id uuid;
  v_key text := lower(trim(coalesce(p_plan_key, '')));
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;
  IF v_key !~ '^[a-z0-9][a-z0-9._-]{1,63}$' THEN
    RAISE EXCEPTION 'invalid_plan_key' USING ERRCODE = '22023';
  END IF;
  IF nullif(trim(coalesce(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'plan_name_required' USING ERRCODE = '22023';
  END IF;
  PERFORM public.platform_assert_plan_entitlements(p_entitlements);

  INSERT INTO public.platform_plans (
    plan_key, active, created_by, updated_by
  ) VALUES (
    v_key, coalesce(p_active, true), auth.uid(), auth.uid()
  ) RETURNING id INTO v_plan_id;

  PERFORM public.platform_publish_plan_version(
    v_plan_id, trim(p_name), coalesce(trim(p_description), ''), p_entitlements
  );

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, entity_type, entity_key, detail
  ) VALUES (
    auth.uid(), 'PLATFORM_PLAN_CREATED', 'platform_plan', v_key,
    jsonb_build_object('plan_id', v_plan_id, 'plan_key', v_key, 'active', coalesce(p_active, true))
  );

  RETURN v_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_plan_active(p_plan_id uuid, p_active boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before boolean;
  v_key text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'plan_active_required' USING ERRCODE = '22004';
  END IF;

  SELECT p.active, p.plan_key INTO v_before, v_key
  FROM public.platform_plans p
  WHERE p.id = p_plan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_before = p_active THEN RETURN true; END IF;

  UPDATE public.platform_plans
  SET active = p_active, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_plan_id;

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, entity_type, entity_key, detail
  ) VALUES (
    auth.uid(), 'PLATFORM_PLAN_ACTIVE_CHANGED', 'platform_plan', v_key,
    jsonb_build_object('plan_id', p_plan_id, 'before', v_before, 'after', p_active)
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_list_plans()
RETURNS TABLE (
  plan_id uuid,
  plan_key text,
  active boolean,
  version_id uuid,
  version integer,
  name text,
  description text,
  published_at timestamptz,
  entitlements jsonb
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
  SELECT
    p.id,
    p.plan_key,
    p.active,
    v.id,
    v.version,
    v.name,
    v.description,
    v.published_at,
    coalesce((
      SELECT jsonb_object_agg(e.entitlement_key, e.enabled ORDER BY e.entitlement_key)
      FROM public.platform_plan_entitlements e
      WHERE e.plan_version_id = v.id
    ), '{}'::jsonb)
  FROM public.platform_plans p
  JOIN LATERAL (
    SELECT pv.*
    FROM public.platform_plan_versions pv
    WHERE pv.plan_id = p.id AND pv.published_at IS NOT NULL
    ORDER BY pv.version DESC
    LIMIT 1
  ) v ON true
  ORDER BY p.active DESC, v.name, p.plan_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_assign_clinic_plan(
  p_clinic_id uuid,
  p_plan_version_id uuid,
  p_status text DEFAULT 'active',
  p_starts_at timestamptz DEFAULT now(),
  p_trial_ends_at timestamptz DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment_id uuid;
  v_current public.clinic_plan_assignments%ROWTYPE;
  v_plan_id uuid;
  v_plan_key text;
  v_plan_active boolean;
  v_version integer;
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active','trialing') THEN
    RAISE EXCEPTION 'invalid_assignment_status' USING ERRCODE = '22023';
  END IF;
  IF p_starts_at IS NULL THEN
    RAISE EXCEPTION 'assignment_start_required' USING ERRCODE = '22004';
  END IF;
  IF p_starts_at < v_now - interval '5 minutes' OR p_starts_at > v_now + interval '5 minutes' THEN
    RAISE EXCEPTION 'v1_plan_assignment_must_start_now' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'active' AND p_trial_ends_at IS NOT NULL THEN
    RAISE EXCEPTION 'active_assignment_cannot_have_trial_end' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'trialing' AND (p_trial_ends_at IS NULL OR p_trial_ends_at <= v_now) THEN
    RAISE EXCEPTION 'valid_trial_end_required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT p.id, p.plan_key, p.active, v.version
    INTO v_plan_id, v_plan_key, v_plan_active, v_version
  FROM public.platform_plan_versions v
  JOIN public.platform_plans p ON p.id = v.plan_id
  WHERE v.id = p_plan_version_id
    AND v.published_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'published_plan_version_not_found' USING ERRCODE = '22023';
  END IF;
  IF NOT v_plan_active THEN
    RAISE EXCEPTION 'inactive_plan_cannot_be_assigned' USING ERRCODE = '55000';
  END IF;

  PERFORM 1 FROM public.clinics c WHERE c.id = p_clinic_id FOR UPDATE;
  SELECT a.* INTO v_current
  FROM public.clinic_plan_assignments a
  WHERE a.clinic_id = p_clinic_id AND a.ends_at IS NULL
  FOR UPDATE;

  IF FOUND
     AND v_current.plan_version_id = p_plan_version_id
     AND v_current.status = p_status
     AND v_current.trial_ends_at IS NOT DISTINCT FROM p_trial_ends_at THEN
    -- Duplicate submissions of the same commercial state are idempotent even
    -- when the caller supplied a fresh `now()` value for starts_at.
    RETURN v_current.id;
  END IF;

  IF v_current.id IS NOT NULL THEN
    UPDATE public.clinic_plan_assignments
    SET ends_at = GREATEST(v_now, starts_at + interval '1 microsecond')
    WHERE id = v_current.id;
  END IF;

  INSERT INTO public.clinic_plan_assignments (
    clinic_id, plan_version_id, status, starts_at, trial_ends_at,
    reason, assigned_by
  ) VALUES (
    p_clinic_id, p_plan_version_id, p_status, v_now, p_trial_ends_at,
    nullif(trim(coalesce(p_reason, '')), ''), auth.uid()
  ) RETURNING id INTO v_assignment_id;

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, entity_type, entity_key, detail
  ) VALUES (
    auth.uid(), 'PLATFORM_CLINIC_PLAN_ASSIGNED', 'clinic_plan_assignment', p_clinic_id::text,
    jsonb_build_object(
      'clinic_id', p_clinic_id,
      'assignment_id', v_assignment_id,
      'plan_id', v_plan_id,
      'plan_key', v_plan_key,
      'plan_version_id', p_plan_version_id,
      'version', v_version,
      'status', p_status,
      'starts_at', v_now,
      'trial_ends_at', p_trial_ends_at,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'replaces_assignment_id', v_current.id
    )
  );

  RETURN v_assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_cancel_clinic_plan(
  p_clinic_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_assignment public.clinic_plan_assignments%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;
  SELECT a.* INTO v_assignment
  FROM public.clinic_plan_assignments a
  WHERE a.clinic_id = p_clinic_id AND a.ends_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.clinic_plan_assignments
  SET status = 'canceled', ends_at = GREATEST(now(), starts_at + interval '1 microsecond'),
      reason = coalesce(nullif(trim(coalesce(p_reason, '')), ''), reason)
  WHERE id = v_assignment.id;

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, entity_type, entity_key, detail
  ) VALUES (
    auth.uid(), 'PLATFORM_CLINIC_PLAN_CANCELED', 'clinic_plan_assignment', p_clinic_id::text,
    jsonb_build_object('clinic_id', p_clinic_id, 'assignment_id', v_assignment.id, 'reason', p_reason)
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_get_clinic_plan_assignment(p_clinic_id uuid)
RETURNS TABLE (
  assignment_id uuid,
  plan_id uuid,
  plan_key text,
  plan_version_id uuid,
  version integer,
  name text,
  status text,
  starts_at timestamptz,
  trial_ends_at timestamptz,
  ends_at timestamptz,
  assigned_at timestamptz,
  reason text
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
  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT a.id, p.id, p.plan_key, v.id, v.version, v.name,
         a.status, a.starts_at, a.trial_ends_at, a.ends_at, a.assigned_at, a.reason
  FROM public.clinic_plan_assignments a
  JOIN public.platform_plan_versions v ON v.id = a.plan_version_id
  JOIN public.platform_plans p ON p.id = v.plan_id
  WHERE a.clinic_id = p_clinic_id AND a.ends_at IS NULL
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.clinic_entitlement_resolution(
  p_clinic_id uuid,
  p_entitlement_key text
)
RETURNS TABLE (
  override_configured boolean,
  override_enabled boolean,
  override_source text,
  plan_configured boolean,
  plan_enabled boolean,
  plan_key text,
  plan_version integer,
  effective boolean,
  effective_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_override public.platform_clinic_entitlements%ROWTYPE;
  v_plan_enabled boolean;
  v_plan_key text;
  v_plan_version integer;
  v_plan_configured boolean := false;
  v_plan_effective boolean := false;
  v_legacy_default boolean;
BEGIN
  IF p_clinic_id IS NULL OR p_entitlement_key NOT IN (
    'nexus.access','finance.access','crm.access','reports.access','assessments.custom','whatsapp.access'
  ) THEN
    RETURN QUERY SELECT false, false, NULL::text, false, false, NULL::text, NULL::integer, false, 'invalid'::text;
    RETURN;
  END IF;

  SELECT e.* INTO v_override
  FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = p_clinic_id AND e.entitlement_key = p_entitlement_key;

  IF FOUND THEN
    RETURN QUERY SELECT
      true,
      v_override.enabled,
      v_override.source,
      false,
      false,
      NULL::text,
      NULL::integer,
      (v_override.enabled = true
       AND (v_override.starts_at IS NULL OR v_override.starts_at <= now())
       AND (v_override.expires_at IS NULL OR v_override.expires_at > now())),
      'override'::text;
    RETURN;
  END IF;

  SELECT pe.enabled, p.plan_key, pv.version,
         (a.status IN ('active','trialing')
          AND a.starts_at <= now()
          AND (a.status <> 'trialing' OR (a.trial_ends_at IS NOT NULL AND a.trial_ends_at > now())))
    INTO v_plan_enabled, v_plan_key, v_plan_version, v_plan_effective
  FROM public.clinic_plan_assignments a
  JOIN public.platform_plan_versions pv ON pv.id = a.plan_version_id AND pv.published_at IS NOT NULL
  JOIN public.platform_plans p ON p.id = pv.plan_id
  JOIN public.platform_plan_entitlements pe ON pe.plan_version_id = pv.id AND pe.entitlement_key = p_entitlement_key
  WHERE a.clinic_id = p_clinic_id AND a.ends_at IS NULL
  LIMIT 1;

  v_plan_configured := FOUND;
  IF v_plan_configured THEN
    RETURN QUERY SELECT false, false, NULL::text, true, v_plan_enabled, v_plan_key, v_plan_version,
      (v_plan_effective AND v_plan_enabled), 'plan'::text;
    RETURN;
  END IF;

  v_legacy_default := p_entitlement_key IN ('finance.access','crm.access','reports.access','whatsapp.access');
  RETURN QUERY SELECT false, false, NULL::text, false, false, NULL::text, NULL::integer,
    v_legacy_default, 'rollout'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_entitlement_allowed(p_entitlement_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_clinic_id uuid; v_effective boolean;
BEGIN
  v_clinic_id := public.current_clinic_id();
  IF v_clinic_id IS NULL THEN RETURN false; END IF;
  SELECT r.effective INTO v_effective
  FROM public.clinic_entitlement_resolution(v_clinic_id, p_entitlement_key) r;
  RETURN coalesce(v_effective, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.clinic_entitlement_allowed(p_clinic_id uuid, p_entitlement_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_effective boolean;
BEGIN
  SELECT r.effective INTO v_effective
  FROM public.clinic_entitlement_resolution(p_clinic_id, p_entitlement_key) r;
  RETURN coalesce(v_effective, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.current_nexus_entitlement_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.clinic_entitlement_allowed(public.current_clinic_id(), 'nexus.access')
$$;

CREATE OR REPLACE FUNCTION public.assessment_custom_authoring_allowed(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.clinic_entitlement_allowed(p_clinic_id, 'assessments.custom')
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_entitlement_state(p_entitlement_key text)
RETURNS TABLE (
  clinic_id uuid,
  entitlement_key text,
  configured boolean,
  enabled boolean,
  effective boolean,
  source text,
  starts_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid := public.current_clinic_id();
  v_resolution record;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_context_required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_resolution
  FROM public.clinic_entitlement_resolution(v_clinic_id, p_entitlement_key);
  IF v_resolution.effective_source = 'invalid' THEN
    RAISE EXCEPTION 'unknown_clinic_entitlement' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    v_clinic_id,
    p_entitlement_key,
    (v_resolution.override_configured OR v_resolution.plan_configured),
    CASE WHEN v_resolution.override_configured THEN v_resolution.override_enabled
         WHEN v_resolution.plan_configured THEN v_resolution.plan_enabled
         ELSE false END,
    v_resolution.effective,
    CASE WHEN v_resolution.override_configured THEN v_resolution.override_source
         WHEN v_resolution.plan_configured THEN 'plan'
         ELSE NULL END,
    CASE WHEN v_resolution.override_configured THEN e.starts_at
         WHEN v_resolution.plan_configured THEN a.starts_at
         ELSE NULL END,
    CASE WHEN v_resolution.override_configured THEN e.expires_at
         WHEN v_resolution.plan_configured AND a.status = 'trialing' THEN a.trial_ends_at
         ELSE NULL END,
    CASE WHEN v_resolution.override_configured THEN e.updated_at
         WHEN v_resolution.plan_configured THEN a.assigned_at
         ELSE NULL END
  FROM (SELECT 1) one
  LEFT JOIN public.platform_clinic_entitlements e
    ON e.clinic_id = v_clinic_id AND e.entitlement_key = p_entitlement_key
  LEFT JOIN public.clinic_plan_assignments a
    ON a.clinic_id = v_clinic_id AND a.ends_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_get_clinic_entitlements_v3(p_clinic_id uuid)
RETURNS TABLE (
  entitlement_key text,
  configured boolean,
  enabled boolean,
  source text,
  starts_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz,
  plan_configured boolean,
  plan_enabled boolean,
  plan_key text,
  plan_version integer,
  effective boolean,
  effective_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_key text; v_resolution record;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = '22023';
  END IF;

  FOREACH v_key IN ARRAY ARRAY[
    'nexus.access','finance.access','crm.access','reports.access','assessments.custom','whatsapp.access'
  ] LOOP
    SELECT * INTO v_resolution
    FROM public.clinic_entitlement_resolution(p_clinic_id, v_key);
    RETURN QUERY
    SELECT
      v_key,
      v_resolution.override_configured,
      v_resolution.override_enabled,
      v_resolution.override_source,
      e.starts_at,
      e.expires_at,
      e.updated_at,
      v_resolution.plan_configured,
      v_resolution.plan_enabled,
      v_resolution.plan_key,
      v_resolution.plan_version,
      v_resolution.effective,
      v_resolution.effective_source
    FROM (SELECT 1) one
    LEFT JOIN public.platform_clinic_entitlements e
      ON e.clinic_id = p_clinic_id AND e.entitlement_key = v_key;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_published_plan_version_immutable() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_published_plan_entitlement_immutable() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.platform_assert_plan_entitlements(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.clinic_entitlement_resolution(uuid,text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.platform_create_plan(text,text,text,jsonb,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_publish_plan_version(uuid,text,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_set_plan_active(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_plans() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_assign_clinic_plan(uuid,uuid,text,timestamptz,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_cancel_clinic_plan(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_get_clinic_plan_assignment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_get_clinic_entitlements_v3(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.platform_create_plan(text,text,text,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_publish_plan_version(uuid,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_plan_active(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_assign_clinic_plan(uuid,uuid,text,timestamptz,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_cancel_clinic_plan(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_clinic_plan_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_clinic_entitlements_v3(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.current_clinic_entitlement_allowed(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clinic_entitlement_allowed(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_nexus_entitlement_allowed() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_clinic_entitlement_state(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_clinic_entitlement_allowed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_entitlement_allowed(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_nexus_entitlement_allowed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_clinic_entitlement_state(text) TO authenticated;

REVOKE ALL ON FUNCTION public.assessment_custom_authoring_allowed(uuid) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.platform_plans IS 'Stable commercial plan identities. Existing assignments reference immutable versions.';
COMMENT ON TABLE public.platform_plan_versions IS 'Immutable published snapshots of plan name/description and entitlement composition.';
COMMENT ON TABLE public.platform_plan_entitlements IS 'Entitlement baseline attached to an immutable plan version.';
COMMENT ON TABLE public.clinic_plan_assignments IS 'Historical plan/trial assignments per clinic; only one open assignment at a time.';
COMMENT ON FUNCTION public.clinic_entitlement_resolution(uuid,text) IS 'Internal effective order: explicit override, active/trial plan baseline, legacy rollout default.';


CREATE OR REPLACE FUNCTION public.platform_reset_clinic_entitlement(
  p_clinic_id uuid,
  p_entitlement_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before jsonb;
  v_after record;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_entitlement_key NOT IN (
    'nexus.access','finance.access','crm.access','reports.access','assessments.custom','whatsapp.access'
  ) THEN
    RAISE EXCEPTION 'unknown_clinic_entitlement' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'enabled', e.enabled, 'source', e.source,
    'starts_at', e.starts_at, 'expires_at', e.expires_at,
    'updated_at', e.updated_at, 'updated_by', e.updated_by
  ) INTO v_before
  FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = p_clinic_id AND e.entitlement_key = p_entitlement_key
  FOR UPDATE;
  IF v_before IS NULL THEN RETURN false; END IF;

  DELETE FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = p_clinic_id AND e.entitlement_key = p_entitlement_key;

  SELECT * INTO v_after
  FROM public.clinic_entitlement_resolution(p_clinic_id, p_entitlement_key);

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, entity_type, entity_key, detail
  ) VALUES (
    auth.uid(), 'PLATFORM_CLINIC_ENTITLEMENT_RESET', 'clinic_entitlement',
    p_clinic_id::text || ':' || p_entitlement_key,
    jsonb_build_object(
      'clinic_id', p_clinic_id,
      'entitlement_key', p_entitlement_key,
      'before', v_before,
      'after', NULL,
      'fallback_source', v_after.effective_source,
      'fallback_effective', v_after.effective,
      'plan_key', v_after.plan_key,
      'plan_version', v_after.plan_version
    )
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_reset_clinic_entitlement(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_reset_clinic_entitlement(uuid,text) TO authenticated;

COMMIT;
