-- MedicsPro — fail closed assessment-template authoring
-- This deliberately changes only assessments.custom. Other entitlement rollout
-- semantics remain owned by clinic_entitlement_allowed().

BEGIN;

CREATE OR REPLACE FUNCTION public.assessment_custom_authoring_allowed(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_clinic_entitlements e
    WHERE e.clinic_id = p_clinic_id
      AND e.entitlement_key = 'assessments.custom'
      AND e.enabled = true
      AND (e.starts_at IS NULL OR e.starts_at <= now())
      AND (e.expires_at IS NULL OR e.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.assessment_custom_authoring_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assessment_custom_authoring_allowed(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.require_assessment_template_manager()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT p.clinic_id INTO v_clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.ativo = true AND p.role IN ('owner', 'admin')
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Gerenciamento de modelos exige owner/admin ativo' USING ERRCODE = '42501';
  END IF;
  IF NOT public.assessment_custom_authoring_allowed(v_clinic_id) THEN
    RAISE EXCEPTION 'Avaliações customizadas não liberadas para esta clínica' USING ERRCODE = '42501';
  END IF;
  RETURN v_clinic_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_custom_assessment_template_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_type text := CASE WHEN TG_OP = 'DELETE' THEN OLD.owner_type ELSE NEW.owner_type END;
  v_clinic_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.clinic_id ELSE NEW.clinic_id END;
BEGIN
  IF auth.uid() IS NOT NULL AND v_owner_type = 'clinic'
     AND NOT public.assessment_custom_authoring_allowed(v_clinic_id) THEN
    RAISE EXCEPTION 'Avaliações customizadas não liberadas para esta clínica' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_custom_assessment_version_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_template_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.template_id ELSE NEW.template_id END;
  v_clinic_id uuid;
  v_owner_type text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT t.clinic_id, t.owner_type INTO v_clinic_id, v_owner_type
    FROM public.assessment_templates t WHERE t.id = v_template_id;
    IF v_owner_type = 'clinic' AND NOT public.assessment_custom_authoring_allowed(v_clinic_id) THEN
      RAISE EXCEPTION 'Avaliações customizadas não liberadas para esta clínica' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

COMMIT;
