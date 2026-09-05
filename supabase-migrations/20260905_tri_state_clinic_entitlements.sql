-- MEDICSPRO — tri-state clinic entitlement governance
-- Adds an explicit Platform Admin contract for configured vs inherited/unconfigured
-- entitlements and a safe, audited way to return an entitlement to rollout defaults.

BEGIN;

CREATE OR REPLACE FUNCTION public.platform_get_clinic_entitlements_v2(p_clinic_id uuid)
RETURNS TABLE (
  entitlement_key text,
  configured boolean,
  enabled boolean,
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
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.id = p_clinic_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH catalog(entitlement_key) AS (
    VALUES
      ('nexus.access'::text),
      ('finance.access'::text),
      ('crm.access'::text),
      ('reports.access'::text),
      ('assessments.custom'::text),
      ('whatsapp.access'::text)
  )
  SELECT
    catalog.entitlement_key,
    (e.clinic_id IS NOT NULL) AS configured,
    COALESCE(e.enabled, false) AS enabled,
    e.source,
    e.starts_at,
    e.expires_at,
    e.updated_at
  FROM catalog
  LEFT JOIN public.platform_clinic_entitlements e
    ON e.clinic_id = p_clinic_id
   AND e.entitlement_key = catalog.entitlement_key
  ORDER BY catalog.entitlement_key;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_get_clinic_entitlements_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_get_clinic_entitlements_v2(uuid) TO authenticated;

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
  v_deleted boolean := false;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_entitlement_key NOT IN (
    'nexus.access',
    'finance.access',
    'crm.access',
    'reports.access',
    'assessments.custom',
    'whatsapp.access'
  ) THEN
    RAISE EXCEPTION 'unknown_clinic_entitlement' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.id = p_clinic_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'enabled', e.enabled,
    'source', e.source,
    'starts_at', e.starts_at,
    'expires_at', e.expires_at,
    'updated_at', e.updated_at,
    'updated_by', e.updated_by
  )
  INTO v_before
  FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = p_clinic_id
    AND e.entitlement_key = p_entitlement_key
  FOR UPDATE;

  IF v_before IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = p_clinic_id
    AND e.entitlement_key = p_entitlement_key;

  v_deleted := FOUND;

  IF v_deleted THEN
    INSERT INTO public.platform_audit_log (
      actor_user_id,
      action,
      entity_type,
      entity_key,
      detail
    ) VALUES (
      auth.uid(),
      'PLATFORM_CLINIC_ENTITLEMENT_RESET',
      'clinic_entitlement',
      p_clinic_id::text || ':' || p_entitlement_key,
      jsonb_build_object(
        'clinic_id', p_clinic_id,
        'entitlement_key', p_entitlement_key,
        'before', v_before,
        'after', NULL,
        'rollout_semantics', CASE
          WHEN p_entitlement_key = 'nexus.access' THEN 'fail_closed_until_explicitly_enabled'
          ELSE 'backward_compatible_when_unconfigured'
        END
      )
    );
  END IF;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_reset_clinic_entitlement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_reset_clinic_entitlement(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.platform_get_clinic_entitlements_v2(uuid) IS
  'Platform Admin entitlement catalog with explicit configured state; missing rows are returned as configured=false.';

COMMENT ON FUNCTION public.platform_reset_clinic_entitlement(uuid, text) IS
  'Platform Admin audited reset to unconfigured rollout semantics. Nexus remains fail-closed when unconfigured.';

COMMIT;
