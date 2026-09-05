-- MEDICSPRO — read-only runtime contract for clinic entitlements
-- This migration does NOT enforce entitlements in any feature by itself.
-- It exposes the effective state for the current tenant so each module can be
-- connected deliberately after rollout/seed verification.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_clinic_entitlement_state(
  p_entitlement_key text
)
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
  v_clinic_id uuid;
BEGIN
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

  v_clinic_id := public.current_clinic_id();
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_context_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    v_clinic_id,
    p_entitlement_key,
    (e.clinic_id IS NOT NULL) AS configured,
    COALESCE(e.enabled, false) AS enabled,
    (
      e.clinic_id IS NOT NULL
      AND e.enabled = true
      AND (e.starts_at IS NULL OR e.starts_at <= now())
      AND (e.expires_at IS NULL OR e.expires_at > now())
    ) AS effective,
    e.source,
    e.starts_at,
    e.expires_at,
    e.updated_at
  FROM (SELECT 1) AS one
  LEFT JOIN public.platform_clinic_entitlements e
    ON e.clinic_id = v_clinic_id
   AND e.entitlement_key = p_entitlement_key;
END;
$$;

REVOKE ALL ON FUNCTION public.current_clinic_entitlement_state(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_clinic_entitlement_state(text) TO authenticated;

COMMENT ON FUNCTION public.current_clinic_entitlement_state(text) IS
  'Read-only current-tenant entitlement state. No feature enforcement is activated merely by installing this function.';

COMMIT;
