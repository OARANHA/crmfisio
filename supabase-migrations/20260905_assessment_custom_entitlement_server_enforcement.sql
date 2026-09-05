-- MEDICSPRO — custom assessment entitlement server-side enforcement
-- `assessments.custom` governs tenant-owned template authoring only.
-- Platform standard templates and clinical assessment usage remain available.
-- Unconfigured clinics remain allowed during controlled rollout through
-- public.clinic_entitlement_allowed(uuid,text).

BEGIN;

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
  SELECT p.clinic_id
    INTO v_clinic_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.ativo = true
    AND p.role IN ('owner', 'admin')
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Gerenciamento de modelos exige owner/admin ativo' USING ERRCODE = '42501';
  END IF;

  IF NOT public.clinic_entitlement_allowed(v_clinic_id, 'assessments.custom') THEN
    RAISE EXCEPTION 'Avaliações customizadas não liberadas para esta clínica' USING ERRCODE = '42501';
  END IF;

  RETURN v_clinic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.require_assessment_template_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_assessment_template_manager() TO authenticated;

-- Direct table mutations are still used by the current template editor for
-- metadata, archive state and draft schema. Guard them independently from RPCs.
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
  -- Database/service maintenance and platform-owned template management are not
  -- tenant custom-template actions.
  IF auth.uid() IS NULL OR v_owner_type <> 'clinic' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF NOT public.clinic_entitlement_allowed(v_clinic_id, 'assessments.custom') THEN
    RAISE EXCEPTION 'Avaliações customizadas não liberadas para esta clínica' USING ERRCODE = '42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_custom_assessment_template_entitlement() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_guard_custom_assessment_template_entitlement ON public.assessment_templates;
CREATE TRIGGER trg_guard_custom_assessment_template_entitlement
BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_templates
FOR EACH ROW
EXECUTE FUNCTION public.guard_custom_assessment_template_entitlement();

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
  IF auth.uid() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT t.clinic_id, t.owner_type
    INTO v_clinic_id, v_owner_type
  FROM public.assessment_templates t
  WHERE t.id = v_template_id;

  IF v_owner_type = 'clinic'
     AND NOT public.clinic_entitlement_allowed(v_clinic_id, 'assessments.custom') THEN
    RAISE EXCEPTION 'Avaliações customizadas não liberadas para esta clínica' USING ERRCODE = '42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_custom_assessment_version_entitlement() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_guard_custom_assessment_version_entitlement ON public.assessment_template_versions;
CREATE TRIGGER trg_guard_custom_assessment_version_entitlement
BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_template_versions
FOR EACH ROW
EXECUTE FUNCTION public.guard_custom_assessment_version_entitlement();

COMMIT;
