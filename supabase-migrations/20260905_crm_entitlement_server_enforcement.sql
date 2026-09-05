-- MEDICSPRO — CRM entitlement server-side enforcement
-- CRM uses clinical base tables that must remain readable by other modules.
-- Therefore we enforce the CRM-specific mutation (patients.funil_stage) instead
-- of gating all patient reads/writes.
-- Unconfigured clinics remain allowed through current_clinic_entitlement_allowed().

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_patient_crm_stage_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Internal/service/database maintenance without an authenticated user must not
  -- be blocked by a SaaS UI entitlement.
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

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_patient_crm_stage_entitlement() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_guard_patient_crm_stage_entitlement ON public.patients;
CREATE TRIGGER trg_guard_patient_crm_stage_entitlement
BEFORE UPDATE OF funil_stage ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.guard_patient_crm_stage_entitlement();

COMMENT ON FUNCTION public.guard_patient_crm_stage_entitlement() IS
  'Blocks authenticated CRM funnel-stage changes when crm.access is explicitly not effective; preserves non-CRM patient operations.';

COMMIT;
