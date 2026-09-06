-- MEDICSPRO — clinic lifecycle suspension boundary
-- Suspended clinics must lose tenant runtime access server-side.

BEGIN;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.clinics'::regclass
      AND conname = 'clinics_lifecycle_status_check'
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'suspended'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS clinics_lifecycle_status_idx
  ON public.clinics (lifecycle_status, created_at DESC)
  WHERE deleted_at IS NULL;

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

CREATE OR REPLACE FUNCTION public.platform_suspend_clinic(
  p_clinic_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reason text := trim(coalesce(p_reason, ''));
  v_before text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT c.lifecycle_status
    INTO v_before
  FROM public.clinics c
  WHERE c.id = p_clinic_id
    AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_before = 'suspended' THEN
    RETURN true;
  END IF;

  UPDATE public.clinics
  SET lifecycle_status = 'suspended'
  WHERE id = p_clinic_id;

  -- Suspension must also stop clinic-local automations. Reactivation does not
  -- implicitly resume them; a tenant admin can review/re-enable intentionally.
  UPDATE public.automation_settings
  SET active = false
  WHERE clinic_id = p_clinic_id;

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, target_type, target_id,
    entity_type, entity_key, detail
  ) VALUES (
    auth.uid(), 'CLINIC_SUSPENDED', 'clinic', p_clinic_id,
    'clinic', p_clinic_id::text,
    jsonb_build_object('before', v_before, 'after', 'suspended', 'reason', v_reason)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_reactivate_clinic(
  p_clinic_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reason text := trim(coalesce(p_reason, ''));
  v_before text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT c.lifecycle_status
    INTO v_before
  FROM public.clinics c
  WHERE c.id = p_clinic_id
    AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_before = 'active' THEN
    RETURN true;
  END IF;

  UPDATE public.clinics
  SET lifecycle_status = 'active'
  WHERE id = p_clinic_id;

  INSERT INTO public.platform_audit_log (
    actor_user_id, action, target_type, target_id,
    entity_type, entity_key, detail
  ) VALUES (
    auth.uid(), 'CLINIC_REACTIVATED', 'clinic', p_clinic_id,
    'clinic', p_clinic_id::text,
    jsonb_build_object('before', v_before, 'after', 'active', 'reason', v_reason)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_suspend_clinic(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_reactivate_clinic(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_suspend_clinic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_reactivate_clinic(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.platform_list_clinics();
CREATE FUNCTION public.platform_list_clinics()
RETURNS TABLE (
  clinic_id uuid,
  clinic_name text,
  cnpj text,
  lifecycle_status text,
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
  SELECT c.id, c.name, c.cnpj, c.lifecycle_status, c.created_at
  FROM public.clinics c
  WHERE c.deleted_at IS NULL
  ORDER BY (c.lifecycle_status <> 'active'), lower(c.name), c.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_clinics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_list_clinics() TO authenticated;

COMMENT ON COLUMN public.clinics.lifecycle_status IS
  'SaaS lifecycle state. suspended removes tenant runtime identity/role resolution.';

COMMIT;
