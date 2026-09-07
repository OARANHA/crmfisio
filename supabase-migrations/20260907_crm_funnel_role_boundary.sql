-- MEDICSPRO — CRM funnel role boundary
-- Aligns the server mutation contract with the canonical UI matrix:
-- owner/admin/recep may move patients in the CRM funnel;
-- fisio/financeiro remain read-only for CRM.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_patient_crm_stage_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app_role text;
BEGIN
  -- Internal/service/database maintenance without an authenticated user must not
  -- be blocked by a SaaS UI authorization boundary.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.funil_stage IS NOT DISTINCT FROM OLD.funil_stage THEN
    RETURN NEW;
  END IF;

  IF public.current_clinic_id() IS NULL
     OR NEW.clinic_id IS DISTINCT FROM public.current_clinic_id()
     OR NOT public.current_clinic_entitlement_allowed('crm.access') THEN
    RAISE EXCEPTION 'Módulo CRM não liberado para esta clínica' USING ERRCODE = '42501';
  END IF;

  app_role := public.current_app_role();
  IF app_role IS NULL OR app_role NOT IN ('owner', 'admin', 'recep') THEN
    RAISE EXCEPTION 'Sem permissão para alterar o funil do CRM' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_patient_crm_stage_entitlement() FROM PUBLIC, anon;

COMMENT ON FUNCTION public.guard_patient_crm_stage_entitlement() IS
  'Guards patients.funil_stage by tenant, crm.access entitlement and the canonical owner/admin/recep CRM write roles.';

COMMIT;
