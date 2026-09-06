-- MedicsPro / Nexus — atomic clinician EEM finalization
-- Prevents partial persistence (draft/result + only some red flags) by committing
-- the finalized EEM and its red flags in one database transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.finalize_nexus_eem_result(
  p_patient_id uuid,
  p_appointment_id uuid DEFAULT NULL,
  p_rule_version text DEFAULT NULL,
  p_input_snapshot jsonb DEFAULT '{}'::jsonb,
  p_output_snapshot jsonb DEFAULT '{}'::jsonb,
  p_classification text DEFAULT NULL,
  p_severity text DEFAULT NULL,
  p_interpretation text DEFAULT NULL,
  p_soap_text text DEFAULT NULL,
  p_evidence_snapshot jsonb DEFAULT '[]'::jsonb,
  p_red_flags jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid;
  v_result_id uuid;
  v_flag jsonb;
BEGIN
  v_clinic_id := public.current_clinic_id();
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica ativa não identificada';
  END IF;

  IF NOT public.has_professional_capability('nexus.eem') THEN
    RAISE EXCEPTION 'Profissional sem capability nexus.eem';
  END IF;

  IF nullif(trim(coalesce(p_rule_version, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Versão clínica do EEM é obrigatória';
  END IF;

  IF p_input_snapshot IS NULL OR jsonb_typeof(p_input_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'Snapshot de entrada do EEM inválido';
  END IF;
  IF p_output_snapshot IS NULL OR jsonb_typeof(p_output_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'Snapshot de saída do EEM inválido';
  END IF;
  IF p_evidence_snapshot IS NULL OR jsonb_typeof(p_evidence_snapshot) <> 'array' THEN
    RAISE EXCEPTION 'Snapshot de evidências do EEM inválido';
  END IF;
  IF p_red_flags IS NULL OR jsonb_typeof(p_red_flags) <> 'array' THEN
    RAISE EXCEPTION 'Red flags do EEM inválidas';
  END IF;

  IF p_severity IS NOT NULL AND p_severity NOT IN ('low','moderate','high','severe') THEN
    RAISE EXCEPTION 'Severidade Nexus inválida';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = p_patient_id
      AND p.clinic_id = v_clinic_id
      AND p.deleted_at IS NULL
      AND coalesce(p.anonimizado, false) IS FALSE
  ) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica';
  END IF;

  IF p_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND a.clinic_id = v_clinic_id
      AND a.paciente_id = p_patient_id
      AND a.fisio_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Atendimento incompatível com paciente, clínica ou profissional';
  END IF;

  INSERT INTO public.nexus_clinical_results (
    clinic_id,
    patient_id,
    professional_id,
    appointment_id,
    module_key,
    tool_key,
    rule_key,
    rule_version,
    required_capability,
    status,
    input_snapshot,
    output_snapshot,
    classification,
    severity,
    interpretation,
    soap_text,
    evidence_snapshot,
    finalized_at
  ) VALUES (
    v_clinic_id,
    p_patient_id,
    auth.uid(),
    p_appointment_id,
    'eem',
    'eem',
    'nexus.eem',
    trim(p_rule_version),
    'nexus.eem',
    'finalized',
    p_input_snapshot,
    p_output_snapshot,
    p_classification,
    p_severity,
    p_interpretation,
    p_soap_text,
    p_evidence_snapshot,
    now()
  )
  RETURNING id INTO v_result_id;

  FOR v_flag IN SELECT value FROM jsonb_array_elements(p_red_flags)
  LOOP
    IF jsonb_typeof(v_flag) <> 'object'
       OR nullif(trim(coalesce(v_flag->>'flagCode', '')), '') IS NULL
       OR (v_flag->>'severity') NOT IN ('warning','critical')
       OR nullif(trim(coalesce(v_flag->>'title', '')), '') IS NULL
       OR nullif(trim(coalesce(v_flag->>'message', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Red flag Nexus inválida';
    END IF;

    INSERT INTO public.nexus_red_flags (
      clinic_id,
      patient_id,
      result_id,
      flag_code,
      severity,
      title,
      message,
      required_action
    ) VALUES (
      v_clinic_id,
      p_patient_id,
      v_result_id,
      trim(v_flag->>'flagCode'),
      v_flag->>'severity',
      trim(v_flag->>'title'),
      trim(v_flag->>'message'),
      nullif(trim(coalesce(v_flag->>'requiredAction', '')), '')
    );
  END LOOP;

  RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) TO authenticated;

COMMIT;
