-- MedicsPro — Clinic Referral Authoring Policy V1
-- Adds a clinic-level institutional switch for referral authoring without
-- changing individual clinical authorization, historical documents or D2-E4.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.clinic_clinical_flow_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  referral_authoring_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinic_clinical_flow_settings IS
  'Clinic-owned operational clinical-flow configuration. Configuration can deny an action but never grants user authorization.';
COMMENT ON COLUMN public.clinic_clinical_flow_settings.referral_authoring_enabled IS
  'When false, authenticated clinical actors cannot create, edit or issue referral drafts. Existing issued referral history remains untouched.';

INSERT INTO public.clinic_clinical_flow_settings (clinic_id, referral_authoring_enabled)
SELECT c.id, true
FROM public.clinics c
ON CONFLICT (clinic_id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_clinic_clinical_flow_settings_updated_at
  ON public.clinic_clinical_flow_settings;
CREATE TRIGGER trg_clinic_clinical_flow_settings_updated_at
BEFORE UPDATE ON public.clinic_clinical_flow_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clinic_clinical_flow_settings ENABLE ROW LEVEL SECURITY;

-- No direct browser table access. Settings are read/written only through narrow
-- tenant-aware RPCs below.
REVOKE ALL ON TABLE public.clinic_clinical_flow_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.clinic_clinical_flow_settings TO service_role;

CREATE OR REPLACE FUNCTION public.get_current_clinic_clinical_flow_settings()
RETURNS TABLE (
  referral_authoring_enabled boolean,
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
  v_clinic_id := public.current_clinic_id();
  IF auth.uid() IS NULL OR v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'active clinic access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    coalesce(s.referral_authoring_enabled, true),
    s.updated_at
  FROM (SELECT v_clinic_id AS clinic_id) current_scope
  LEFT JOIN public.clinic_clinical_flow_settings s
    ON s.clinic_id = current_scope.clinic_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_current_clinic_clinical_flow_settings(
  p_referral_authoring_enabled boolean
)
RETURNS TABLE (
  referral_authoring_enabled boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_role text;
BEGIN
  v_clinic_id := public.current_clinic_id();
  v_role := public.current_app_role();

  IF auth.uid() IS NULL
     OR v_clinic_id IS NULL
     OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'clinic owner/admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_referral_authoring_enabled IS NULL THEN
    RAISE EXCEPTION 'referral authoring policy value required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.clinic_clinical_flow_settings (
    clinic_id,
    referral_authoring_enabled,
    updated_by
  ) VALUES (
    v_clinic_id,
    p_referral_authoring_enabled,
    auth.uid()
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    referral_authoring_enabled = EXCLUDED.referral_authoring_enabled,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  RETURN QUERY
  SELECT s.referral_authoring_enabled, s.updated_at
  FROM public.clinic_clinical_flow_settings s
  WHERE s.clinic_id = v_clinic_id;
END;
$$;

-- Internal helper for server-side enforcement. Missing rows intentionally resolve
-- to TRUE so newly provisioned clinics preserve the pre-existing behavior until
-- they explicitly configure the policy.
CREATE OR REPLACE FUNCTION public.clinic_referral_authoring_enabled(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (
      SELECT s.referral_authoring_enabled
      FROM public.clinic_clinical_flow_settings s
      WHERE s.clinic_id = p_clinic_id
    ),
    true
  )
$$;

-- The institutional policy gates authoring only. It deliberately does NOT alter
-- read/history access and does NOT block issued -> canceled lifecycle changes.
CREATE OR REPLACE FUNCTION public.guard_clinical_referral_authoring_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.document_type IS DISTINCT FROM 'referral' THEN
    RETURN NEW;
  END IF;

  -- System/service operations remain governed by their existing boundaries.
  -- Browser-side unauthenticated writes are already denied by table/RPC ACLs.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR (
       TG_OP = 'UPDATE'
       AND OLD.status = 'draft'
       AND NEW.status IN ('draft', 'issued')
       AND NEW IS DISTINCT FROM OLD
     ) THEN
    IF public.clinic_referral_authoring_enabled(NEW.clinic_id) IS NOT TRUE THEN
      RAISE EXCEPTION 'clinical_referral_authoring_disabled' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_referral_authoring_policy
  ON public.clinical_documents;
CREATE TRIGGER trg_clinical_referral_authoring_policy
BEFORE INSERT OR UPDATE ON public.clinical_documents
FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_referral_authoring_policy();

REVOKE ALL ON FUNCTION public.get_current_clinic_clinical_flow_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_current_clinic_clinical_flow_settings(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clinic_referral_authoring_enabled(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_clinical_referral_authoring_policy() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_current_clinic_clinical_flow_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_current_clinic_clinical_flow_settings(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clinic_referral_authoring_enabled(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_clinical_referral_authoring_policy() TO service_role;

COMMIT;
