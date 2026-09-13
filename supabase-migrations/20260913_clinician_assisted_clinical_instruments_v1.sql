-- MedicsPro — Clinician-Assisted Administration V1
-- Neutral Encounter-scoped persistence over #399. Nexus remains the versioned
-- calculation engine; nexus.scales is not an authorization requirement here.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF to_regclass('public.clinical_instrument_catalog') IS NULL
     OR to_regclass('public.clinic_clinical_instrument_settings') IS NULL
     OR to_regclass('public.appointments') IS NULL
     OR to_regclass('public.patients') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regprocedure('public.can_apply_clinical_instrument_in_encounter(uuid,text)') IS NULL
     OR to_regprocedure('public.current_clinic_id()') IS NULL THEN
    RAISE EXCEPTION 'clinician_assisted_instrument_prerequisite_missing';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.clinical_instrument_administrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  instrument_key text NOT NULL REFERENCES public.clinical_instrument_catalog(instrument_key) ON UPDATE RESTRICT ON DELETE RESTRICT,
  engine_source text NOT NULL,
  engine_module_key text NOT NULL,
  engine_tool_key text NOT NULL,
  engine_rule_key text NOT NULL,
  engine_rule_version text NOT NULL,
  provenance text NOT NULL DEFAULT 'clinician_assisted',
  request_id uuid NOT NULL,
  answers_snapshot jsonb NOT NULL,
  output_snapshot jsonb NOT NULL,
  total_score numeric NOT NULL,
  max_score numeric NOT NULL,
  classification text NOT NULL,
  severity text NOT NULL,
  interpretation text NOT NULL,
  soap_text text NOT NULL,
  evidence_snapshot jsonb NOT NULL,
  safety_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_instrument_administrations_provenance_check CHECK (provenance = 'clinician_assisted'),
  CONSTRAINT clinical_instrument_administrations_engine_source_check CHECK (engine_source = 'nexus'),
  CONSTRAINT clinical_instrument_administrations_answers_object_check CHECK (jsonb_typeof(answers_snapshot) = 'object'),
  CONSTRAINT clinical_instrument_administrations_output_object_check CHECK (jsonb_typeof(output_snapshot) = 'object'),
  CONSTRAINT clinical_instrument_administrations_evidence_array_check CHECK (jsonb_typeof(evidence_snapshot) = 'array'),
  CONSTRAINT clinical_instrument_administrations_safety_array_check CHECK (jsonb_typeof(safety_signals) = 'array'),
  CONSTRAINT clinical_instrument_administrations_score_range_check CHECK (total_score >= 0 AND max_score > 0 AND total_score <= max_score),
  CONSTRAINT clinical_instrument_administrations_request_unique UNIQUE (professional_id, appointment_id, request_id)
);

COMMENT ON TABLE public.clinical_instrument_administrations IS
  'Immutable clinician-assisted neutral instrument administrations linked to the actor own active Encounter. Nexus provides engine identity/version/scoring only.';

CREATE INDEX IF NOT EXISTS idx_clinical_instrument_administrations_encounter
  ON public.clinical_instrument_administrations(clinic_id, appointment_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_instrument_administrations_patient
  ON public.clinical_instrument_administrations(clinic_id, patient_id, completed_at DESC);

CREATE OR REPLACE FUNCTION public.guard_clinical_instrument_administration_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'clinical_instrument_administration_immutable' USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_clinical_instrument_administration_immutable()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_clinical_instrument_administration_immutable ON public.clinical_instrument_administrations;
CREATE TRIGGER trg_clinical_instrument_administration_immutable
BEFORE UPDATE OR DELETE ON public.clinical_instrument_administrations
FOR EACH ROW EXECUTE FUNCTION public.guard_clinical_instrument_administration_immutable();

ALTER TABLE public.clinical_instrument_administrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clinical_instrument_administrations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.clinical_instrument_administrations TO service_role;

CREATE OR REPLACE FUNCTION public.record_clinician_assisted_clinical_instrument(
  p_actor_user_id uuid,
  p_appointment_id uuid,
  p_instrument_key text,
  p_request_id uuid,
  p_answers jsonb,
  p_result jsonb,
  p_safety_signals jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_previous_sub text := current_setting('request.jwt.claim.sub', true);
  v_previous_claims text := current_setting('request.jwt.claims', true);
  v_key text := lower(btrim(coalesce(p_instrument_key, '')));
  v_clinic uuid;
  v_patient uuid;
  v_catalog public.clinical_instrument_catalog%ROWTYPE;
  v_existing public.clinical_instrument_administrations%ROWTYPE;
  v_created public.clinical_instrument_administrations%ROWTYPE;
  v_total numeric;
  v_max numeric;
BEGIN
  IF p_actor_user_id IS NULL OR p_appointment_id IS NULL OR p_request_id IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'clinical_instrument_administration_invalid_request' USING ERRCODE = '22023';
  END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'clinical_instrument_administration_invalid_answers' USING ERRCODE = '22023';
  END IF;
  IF p_result IS NULL OR jsonb_typeof(p_result) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_result->'outputSnapshot') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_result->'evidenceSnapshot') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'clinical_instrument_administration_invalid_result' USING ERRCODE = '22023';
  END IF;
  IF p_safety_signals IS NULL OR jsonb_typeof(p_safety_signals) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'clinical_instrument_administration_invalid_safety_signals' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_total := nullif(p_result->>'totalScore', '')::numeric;
    v_max := nullif(p_result->>'maxScore', '')::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'clinical_instrument_administration_invalid_score' USING ERRCODE = '22023';
  END;

  IF v_total IS NULL OR v_max IS NULL OR v_total < 0 OR v_max <= 0 OR v_total > v_max
     OR nullif(p_result->>'classification', '') IS NULL
     OR nullif(p_result->>'severity', '') IS NULL
     OR nullif(p_result->>'interpretation', '') IS NULL
     OR nullif(p_result->>'soapText', '') IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_administration_invalid_result_contract' USING ERRCODE = '22023';
  END IF;

  -- Service-role-only writer. Reinstall the already-authenticated Edge caller as
  -- transaction-local auth context and reuse the canonical #399 act boundary.
  PERFORM set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_actor_user_id::text, 'role', 'authenticated')::text, true);

  IF public.can_apply_clinical_instrument_in_encounter(p_appointment_id, v_key) IS NOT TRUE THEN
    RAISE EXCEPTION 'clinical_instrument_administration_not_authorized' USING ERRCODE = '42501';
  END IF;

  v_clinic := public.current_clinic_id();
  SELECT a.paciente_id INTO v_patient
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.clinic_id = v_clinic
    AND a.professional_id = p_actor_user_id
    AND a.status = 'em_atendimento'
  LIMIT 1;
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'clinical_instrument_administration_encounter_invalid' USING ERRCODE = '42501';
  END IF;

  SELECT c.* INTO v_catalog
  FROM public.clinical_instrument_catalog c
  WHERE c.instrument_key = v_key AND c.active IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'clinical_instrument_administration_unknown_instrument' USING ERRCODE = '22023';
  END IF;

  IF nullif(p_result->>'engineSource', '') IS DISTINCT FROM v_catalog.engine_source
     OR nullif(p_result->>'engineModuleKey', '') IS DISTINCT FROM v_catalog.engine_module_key
     OR nullif(p_result->>'engineToolKey', '') IS DISTINCT FROM v_catalog.engine_tool_key
     OR nullif(p_result->>'engineRuleKey', '') IS DISTINCT FROM v_catalog.engine_rule_key
     OR nullif(p_result->>'engineRuleVersion', '') IS DISTINCT FROM v_catalog.engine_rule_version THEN
    RAISE EXCEPTION 'clinical_instrument_administration_engine_contract_mismatch' USING ERRCODE = '22023';
  END IF;

  SELECT a.* INTO v_existing
  FROM public.clinical_instrument_administrations a
  WHERE a.professional_id = p_actor_user_id
    AND a.appointment_id = p_appointment_id
    AND a.request_id = p_request_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.instrument_key IS DISTINCT FROM v_key OR v_existing.answers_snapshot IS DISTINCT FROM p_answers THEN
      RAISE EXCEPTION 'clinical_instrument_administration_idempotency_conflict' USING ERRCODE = '23505';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
    PERFORM set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
    RETURN jsonb_build_object(
      'id', v_existing.id, 'appointmentId', v_existing.appointment_id, 'patientId', v_existing.patient_id,
      'instrumentKey', v_existing.instrument_key, 'provenance', v_existing.provenance,
      'engineRuleKey', v_existing.engine_rule_key, 'engineRuleVersion', v_existing.engine_rule_version,
      'totalScore', v_existing.total_score, 'maxScore', v_existing.max_score,
      'classification', v_existing.classification, 'severity', v_existing.severity,
      'interpretation', v_existing.interpretation, 'outputSnapshot', v_existing.output_snapshot,
      'safetySignals', v_existing.safety_signals, 'completedAt', v_existing.completed_at, 'replayed', true
    );
  END IF;

  INSERT INTO public.clinical_instrument_administrations(
    clinic_id, patient_id, appointment_id, professional_id, instrument_key,
    engine_source, engine_module_key, engine_tool_key, engine_rule_key, engine_rule_version,
    provenance, request_id, answers_snapshot, output_snapshot, total_score, max_score,
    classification, severity, interpretation, soap_text, evidence_snapshot, safety_signals
  ) VALUES (
    v_clinic, v_patient, p_appointment_id, p_actor_user_id, v_key,
    v_catalog.engine_source, v_catalog.engine_module_key, v_catalog.engine_tool_key,
    v_catalog.engine_rule_key, v_catalog.engine_rule_version,
    'clinician_assisted', p_request_id, p_answers, p_result->'outputSnapshot', v_total, v_max,
    p_result->>'classification', p_result->>'severity', p_result->>'interpretation',
    p_result->>'soapText', p_result->'evidenceSnapshot', p_safety_signals
  ) RETURNING * INTO v_created;

  PERFORM set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
  PERFORM set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
  RETURN jsonb_build_object(
    'id', v_created.id, 'appointmentId', v_created.appointment_id, 'patientId', v_created.patient_id,
    'instrumentKey', v_created.instrument_key, 'provenance', v_created.provenance,
    'engineRuleKey', v_created.engine_rule_key, 'engineRuleVersion', v_created.engine_rule_version,
    'totalScore', v_created.total_score, 'maxScore', v_created.max_score,
    'classification', v_created.classification, 'severity', v_created.severity,
    'interpretation', v_created.interpretation, 'outputSnapshot', v_created.output_snapshot,
    'safetySignals', v_created.safety_signals, 'completedAt', v_created.completed_at, 'replayed', false
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
  PERFORM set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb)
  TO service_role;

COMMENT ON FUNCTION public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb) IS
  'Service-only clinician-assisted writer: reuses #399 authorization, derives tenant/patient server-side, pins engine mapping to clinical_instrument_catalog and provides immutable idempotent persistence.';

COMMIT;
