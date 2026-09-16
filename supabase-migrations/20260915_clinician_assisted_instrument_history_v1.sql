-- MedicsPro — Neutral Clinician-Assisted Instrument History V1
-- Clinical timeline projection only. The immutable administration ledger remains
-- service-role-only and Nexus remains engine provenance, not read authorization.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF to_regclass('public.clinical_instrument_administrations') IS NULL
     OR to_regprocedure('public.can_access_patient_clinical_record(uuid)') IS NULL
     OR to_regprocedure('public.current_clinic_id()') IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_history_prerequisite_missing';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_patient_clinician_assisted_instrument_history(
  p_patient_id uuid
)
RETURNS TABLE (
  id uuid,
  appointment_id uuid,
  professional_id uuid,
  instrument_key text,
  engine_rule_version text,
  provenance text,
  total_score numeric,
  max_score numeric,
  classification text,
  severity text,
  interpretation text,
  has_safety_signal boolean,
  has_critical_safety_signal boolean,
  completed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
BEGIN
  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_history_patient_required' USING ERRCODE = '22023';
  END IF;

  IF v_clinic IS NULL
     OR public.can_access_patient_clinical_record(p_patient_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_instrument_history_not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.appointment_id,
    a.professional_id,
    a.instrument_key,
    a.engine_rule_version,
    a.provenance,
    a.total_score,
    a.max_score,
    a.classification,
    a.severity,
    a.interpretation,
    jsonb_array_length(a.safety_signals) > 0,
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(a.safety_signals) AS signal(value)
      WHERE lower(coalesce(signal.value->>'severity', '')) = 'critical'
    ),
    a.completed_at
  FROM public.clinical_instrument_administrations a
  WHERE a.clinic_id = v_clinic
    AND a.patient_id = p_patient_id
    AND a.provenance = 'clinician_assisted'
  ORDER BY a.completed_at DESC, a.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_patient_clinician_assisted_instrument_history(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_patient_clinician_assisted_instrument_history(uuid)
  TO authenticated, service_role;
COMMENT ON FUNCTION public.list_patient_clinician_assisted_instrument_history(uuid) IS
  'Neutral clinician-assisted history projection for authorized chart readers. Uses can_access_patient_clinical_record and never exposes answers, output/evidence snapshots, SOAP or Nexus authorization internals.';

COMMIT;
