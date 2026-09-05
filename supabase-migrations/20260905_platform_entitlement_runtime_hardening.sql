-- MEDICSPRO — hotfix: disambiguate entitlement upsert runtime contract

BEGIN;

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

COMMENT ON FUNCTION public.platform_set_clinic_entitlement(uuid, text, boolean, text, timestamptz, timestamptz)
IS 'Platform Admin entitlement upsert using named PK constraint to avoid PL/pgSQL output-column ambiguity.';

COMMIT;
