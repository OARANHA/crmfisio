-- MEDICSPRO — clinic module entitlements governed by Platform Admin
-- Contract: profession != capability != entitlement != clinic configuration.
-- This migration creates the SaaS control-plane only; no clinical/financial path
-- is switched to enforcement by this file alone.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_clinic_entitlements (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  starts_at timestamptz NULL,
  expires_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (clinic_id, entitlement_key),
  CONSTRAINT platform_clinic_entitlements_key_check CHECK (
    entitlement_key IN (
      'nexus.access',
      'finance.access',
      'crm.access',
      'reports.access',
      'assessments.custom',
      'whatsapp.access'
    )
  ),
  CONSTRAINT platform_clinic_entitlements_source_check CHECK (
    source IN ('manual', 'plan', 'trial', 'migration')
  ),
  CONSTRAINT platform_clinic_entitlements_window_check CHECK (
    expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at
  )
);

CREATE INDEX IF NOT EXISTS platform_clinic_entitlements_key_enabled_idx
  ON public.platform_clinic_entitlements (entitlement_key, enabled, clinic_id);

ALTER TABLE public.platform_clinic_entitlements ENABLE ROW LEVEL SECURITY;

-- SaaS-level entitlement data is intentionally deny-by-default to tenant users.
REVOKE ALL ON TABLE public.platform_clinic_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_clinic_entitlements TO service_role;

CREATE OR REPLACE FUNCTION public.platform_get_clinic_entitlements(p_clinic_id uuid)
RETURNS TABLE (
  entitlement_key text,
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
    SELECT 1 FROM public.clinics c
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
    COALESCE(e.enabled, false) AS enabled,
    COALESCE(e.source, 'manual') AS source,
    e.starts_at,
    e.expires_at,
    COALESCE(e.updated_at, to_timestamp(0)) AS updated_at
  FROM catalog
  LEFT JOIN public.platform_clinic_entitlements e
    ON e.clinic_id = p_clinic_id
   AND e.entitlement_key = catalog.entitlement_key
  ORDER BY catalog.entitlement_key;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_get_clinic_entitlements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_get_clinic_entitlements(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_set_clinic_entitlement(
  p_clinic_id uuid,
  p_entitlement_key text,
  p_enabled boolean,
  p_source text DEFAULT 'manual',
  p_starts_at timestamptz DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  entitlement_key text,
  enabled boolean,
  source text,
  starts_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'enabled_required' USING ERRCODE = '22004';
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

  IF p_source NOT IN ('manual', 'plan', 'trial', 'migration') THEN
    RAISE EXCEPTION 'invalid_entitlement_source' USING ERRCODE = '22023';
  END IF;

  IF p_expires_at IS NOT NULL AND p_starts_at IS NOT NULL AND p_expires_at <= p_starts_at THEN
    RAISE EXCEPTION 'invalid_entitlement_window' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = p_clinic_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinic_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'enabled', e.enabled,
    'source', e.source,
    'starts_at', e.starts_at,
    'expires_at', e.expires_at
  )
    INTO v_before
  FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = p_clinic_id
    AND e.entitlement_key = p_entitlement_key;

  INSERT INTO public.platform_clinic_entitlements (
    clinic_id,
    entitlement_key,
    enabled,
    source,
    starts_at,
    expires_at,
    updated_at,
    updated_by
  ) VALUES (
    p_clinic_id,
    p_entitlement_key,
    p_enabled,
    p_source,
    p_starts_at,
    p_expires_at,
    now(),
    auth.uid()
  )
  ON CONFLICT ON CONSTRAINT platform_clinic_entitlements_pkey DO UPDATE
  SET enabled = EXCLUDED.enabled,
      source = EXCLUDED.source,
      starts_at = EXCLUDED.starts_at,
      expires_at = EXCLUDED.expires_at,
      updated_at = now(),
      updated_by = auth.uid();

  INSERT INTO public.platform_audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_key,
    detail
  ) VALUES (
    auth.uid(),
    'PLATFORM_CLINIC_ENTITLEMENT_CHANGED',
    'clinic_entitlement',
    p_clinic_id::text || ':' || p_entitlement_key,
    jsonb_build_object(
      'clinic_id', p_clinic_id,
      'entitlement_key', p_entitlement_key,
      'before', v_before,
      'after', jsonb_build_object(
        'enabled', p_enabled,
        'source', p_source,
        'starts_at', p_starts_at,
        'expires_at', p_expires_at
      )
    )
  );

  RETURN QUERY
  SELECT
    e.entitlement_key,
    e.enabled,
    e.source,
    e.starts_at,
    e.expires_at,
    e.updated_at
  FROM public.platform_clinic_entitlements e
  WHERE e.clinic_id = p_clinic_id
    AND e.entitlement_key = p_entitlement_key;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_set_clinic_entitlement(uuid, text, boolean, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_set_clinic_entitlement(uuid, text, boolean, text, timestamptz, timestamptz) TO authenticated;

COMMENT ON TABLE public.platform_clinic_entitlements IS
  'SaaS-level module entitlements per clinic. Separate from profession, RBAC capability and clinic-local configuration.';

COMMIT;
