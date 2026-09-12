-- MedicsPro — reconcile clinical patient read after the professional cutover.
-- Read-only boundary only: no write policy, capability catalog or schema change.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.can_access_patient_clinical_record(p_patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR v_role IS NULL OR p_patient_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id=p_patient_id AND p.clinic_id=v_clinic AND p.deleted_at IS NULL) THEN RETURN false; END IF;
  IF v_role IN ('owner','admin') THEN RETURN true; END IF;
  IF v_role <> 'professional'
     OR public.current_user_has_valid_clinical_identity() IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.timeline.read') IS NOT TRUE THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.appointments a WHERE a.clinic_id=v_clinic AND a.paciente_id=p_patient_id AND a.fisio_id=v_uid)
      OR EXISTS (SELECT 1 FROM public.physiotherapy_evaluations e WHERE e.clinic_id=v_clinic AND e.patient_id=p_patient_id AND e.professional_id=v_uid)
      OR EXISTS (SELECT 1 FROM public.physiotherapy_evolutions e WHERE e.clinic_id=v_clinic AND e.patient_id=p_patient_id AND e.professional_id=v_uid AND e.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.clinical_assessments a WHERE a.clinic_id=v_clinic AND a.patient_id=p_patient_id AND a.professional_id=v_uid)
      OR EXISTS (SELECT 1 FROM public.nexus_clinical_results n WHERE n.clinic_id=v_clinic AND n.patient_id=p_patient_id AND n.professional_id=v_uid)
      OR EXISTS (SELECT 1 FROM public.nexus_self_assessment_invites i WHERE i.clinic_id=v_clinic AND i.patient_id=p_patient_id AND i.professional_id=v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_patient_clinical_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_patient_clinical_record(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_patient_clinical_snapshot()
RETURNS TABLE (patient_id uuid, queixa_principal text, cid10 text[], anamnese jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_clinic uuid := public.current_clinic_id();
BEGIN
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'tenant_context_required' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT p.id,p.queixa_principal,p.cid10,p.anamnese FROM public.patients p
  WHERE p.clinic_id=v_clinic AND p.deleted_at IS NULL AND public.can_access_patient_clinical_record(p.id)
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_patient_clinical_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_patient_clinical_snapshot() TO authenticated, service_role;
COMMENT ON FUNCTION public.can_access_patient_clinical_record(uuid) IS 'Clinical read: active owner/admin tenant managers, or professional with valid identity, clinical.timeline.read and concrete care relationship.';
COMMIT;
