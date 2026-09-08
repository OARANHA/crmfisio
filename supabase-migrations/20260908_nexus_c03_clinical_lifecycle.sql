-- MEDICSPRO — Nexus C-03 clinical lifecycle
-- Separates technical processing/freeze from explicit human review and clinical
-- signing without changing the legacy result status or historical immutable row.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- C-02 is a hard prerequisite and the historical finalized guard must remain
-- byte-for-byte unchanged. C-03 stores lifecycle outside nexus_clinical_results.
DO $$
DECLARE
  v_guard record;
BEGIN
  IF to_regclass('public.nexus_result_contracts') IS NULL
     OR to_regprocedure('public.resolve_nexus_result_required_capability(text,text,text,text)') IS NULL
     OR to_regprocedure('public.validate_nexus_result_context()') IS NULL THEN
    RAISE EXCEPTION 'nexus_c03_c02_prerequisite_missing';
  END IF;

  SELECT p.* INTO v_guard
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.guard_nexus_result_immutability()');

  IF NOT FOUND OR md5(v_guard.prosrc) <> 'a161bc1755b2290f07cbec5ee4c5a644' THEN
    RAISE EXCEPTION 'nexus_c03_finalized_guard_drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.nexus_clinical_results'::regclass
      AND t.tgname = 'trg_nexus_result_immutable'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'nexus_c03_finalized_trigger_missing';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.nexus_result_clinical_lifecycle (
  result_id uuid PRIMARY KEY REFERENCES public.nexus_clinical_results(id) ON DELETE RESTRICT,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  processed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  signed_at timestamptz,
  signed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nexus_result_lifecycle_nonempty CHECK (
    processed_at IS NOT NULL OR reviewed_at IS NOT NULL OR signed_at IS NOT NULL
  ),
  CONSTRAINT nexus_result_lifecycle_review_pair CHECK (
    (reviewed_at IS NULL) = (reviewed_by IS NULL)
  ),
  CONSTRAINT nexus_result_lifecycle_sign_pair CHECK (
    (signed_at IS NULL) = (signed_by IS NULL)
  ),
  CONSTRAINT nexus_result_lifecycle_sign_requires_review CHECK (
    signed_at IS NULL OR reviewed_at IS NOT NULL
  ),
  CONSTRAINT nexus_result_lifecycle_review_after_processing CHECK (
    reviewed_at IS NULL OR processed_at IS NOT NULL
  ),
  CONSTRAINT nexus_result_lifecycle_timestamp_order CHECK (
    (reviewed_at IS NULL OR reviewed_at >= processed_at)
    AND (signed_at IS NULL OR signed_at >= reviewed_at)
  )
);

ALTER TABLE public.nexus_result_clinical_lifecycle ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.nexus_result_clinical_lifecycle FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.nexus_result_clinical_lifecycle TO authenticated, service_role;

DROP POLICY IF EXISTS nexus_result_lifecycle_read_care_relationship
  ON public.nexus_result_clinical_lifecycle;
CREATE POLICY nexus_result_lifecycle_read_care_relationship
ON public.nexus_result_clinical_lifecycle
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1
    FROM public.nexus_clinical_results r
    WHERE r.id = result_id
      AND r.clinic_id = public.current_clinic_id()
      AND public.can_access_patient_clinical_record(r.patient_id)
      AND public.has_professional_capability('nexus.access')
  )
);

CREATE OR REPLACE FUNCTION public.validate_nexus_result_clinical_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_delete_forbidden';
  END IF;

  SELECT r.clinic_id, r.professional_id, r.status, r.finalized_at
  INTO v_result
  FROM public.nexus_clinical_results r
  WHERE r.id = NEW.result_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_result_missing';
  END IF;

  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := v_result.clinic_id;
  ELSIF NEW.clinic_id <> v_result.clinic_id THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_clinic_mismatch';
  END IF;

  IF NEW.processed_at IS NOT NULL
     AND (v_result.status <> 'finalized' OR v_result.finalized_at IS NULL) THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_requires_frozen_result';
  END IF;

  IF (NEW.reviewed_at IS NULL) <> (NEW.reviewed_by IS NULL) THEN
    RAISE EXCEPTION 'nexus_clinical_review_pair_required';
  END IF;

  IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by <> v_result.professional_id THEN
    RAISE EXCEPTION 'nexus_clinical_review_author_mismatch';
  END IF;

  IF (NEW.signed_at IS NULL) <> (NEW.signed_by IS NULL) THEN
    RAISE EXCEPTION 'nexus_clinical_sign_pair_required';
  END IF;

  IF NEW.signed_at IS NOT NULL AND NEW.reviewed_at IS NULL THEN
    RAISE EXCEPTION 'nexus_clinical_sign_requires_review';
  END IF;

  IF NEW.signed_by IS NOT NULL AND NEW.signed_by <> v_result.professional_id THEN
    RAISE EXCEPTION 'nexus_clinical_sign_author_mismatch';
  END IF;

  IF NEW.reviewed_at IS NOT NULL AND NEW.processed_at IS NULL THEN
    RAISE EXCEPTION 'nexus_clinical_review_requires_processing';
  END IF;

  IF NEW.reviewed_at IS NOT NULL AND NEW.reviewed_at < NEW.processed_at THEN
    RAISE EXCEPTION 'nexus_clinical_review_timestamp_invalid';
  END IF;

  IF NEW.signed_at IS NOT NULL AND NEW.signed_at < NEW.reviewed_at THEN
    RAISE EXCEPTION 'nexus_clinical_sign_timestamp_invalid';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.signed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'nexus_clinical_lifecycle_signed_immutable';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_nexus_result_clinical_lifecycle() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_nexus_result_clinical_lifecycle
  ON public.nexus_result_clinical_lifecycle;
CREATE TRIGGER trg_nexus_result_clinical_lifecycle
BEFORE INSERT OR UPDATE OR DELETE
ON public.nexus_result_clinical_lifecycle
FOR EACH ROW EXECUTE FUNCTION public.validate_nexus_result_clinical_lifecycle();

-- Technical completion/freezing for the generic writer. This deliberately does
-- not create human-review or clinical-signature metadata.
CREATE OR REPLACE FUNCTION public.complete_nexus_result_processing(p_result_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result public.nexus_clinical_results%ROWTYPE;
  v_clinic_id uuid := public.current_clinic_id();
  v_finalized_at timestamptz;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica ativa não identificada';
  END IF;

  SELECT * INTO v_result
  FROM public.nexus_clinical_results r
  WHERE r.id = p_result_id
  FOR UPDATE;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Resultado Nexus inexistente';
  END IF;
  IF v_result.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'nexus_result_tenant_mismatch';
  END IF;
  IF v_result.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'nexus_result_author_mismatch';
  END IF;
  IF NOT public.can_access_patient_clinical_record(v_result.patient_id) THEN
    RAISE EXCEPTION 'nexus_result_care_relationship_required';
  END IF;
  IF NOT public.has_professional_capability(v_result.required_capability) THEN
    RAISE EXCEPTION 'Profissional sem capability para esta ferramenta Nexus';
  END IF;

  IF v_result.status = 'draft' THEN
    UPDATE public.nexus_clinical_results
       SET status = 'finalized'
     WHERE id = v_result.id
       AND status = 'draft'
    RETURNING finalized_at INTO v_finalized_at;
  ELSIF v_result.status = 'finalized' AND v_result.finalized_at IS NOT NULL THEN
    v_finalized_at := v_result.finalized_at;
  ELSE
    RAISE EXCEPTION 'nexus_result_processing_state_invalid';
  END IF;

  INSERT INTO public.nexus_result_clinical_lifecycle(
    result_id, clinic_id, processed_at
  ) VALUES (
    v_result.id, v_result.clinic_id, v_finalized_at
  )
  ON CONFLICT (result_id) DO UPDATE
     SET processed_at = coalesce(public.nexus_result_clinical_lifecycle.processed_at, EXCLUDED.processed_at)
   WHERE public.nexus_result_clinical_lifecycle.processed_at IS NULL;

  RETURN v_result.id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_nexus_result_processing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_nexus_result_processing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_nexus_result(p_result_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result public.nexus_clinical_results%ROWTYPE;
  v_lifecycle public.nexus_result_clinical_lifecycle%ROWTYPE;
  v_clinic_id uuid := public.current_clinic_id();
  v_now timestamptz := now();
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica ativa não identificada';
  END IF;

  SELECT * INTO v_result
  FROM public.nexus_clinical_results r
  WHERE r.id = p_result_id;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Resultado Nexus inexistente';
  END IF;
  IF v_result.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'nexus_result_tenant_mismatch';
  END IF;
  IF v_result.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'nexus_result_author_mismatch';
  END IF;
  IF v_result.status <> 'finalized' OR v_result.finalized_at IS NULL THEN
    RAISE EXCEPTION 'nexus_result_must_be_processed_before_review';
  END IF;
  IF NOT public.can_access_patient_clinical_record(v_result.patient_id) THEN
    RAISE EXCEPTION 'nexus_result_care_relationship_required';
  END IF;
  IF NOT public.has_professional_capability(v_result.required_capability) THEN
    RAISE EXCEPTION 'Profissional sem capability para esta ferramenta Nexus';
  END IF;

  SELECT * INTO v_lifecycle
  FROM public.nexus_result_clinical_lifecycle l
  WHERE l.result_id = v_result.id
  FOR UPDATE;

  IF v_lifecycle.signed_at IS NOT NULL OR v_lifecycle.reviewed_at IS NOT NULL THEN
    RETURN v_result.id;
  END IF;

  IF v_lifecycle.result_id IS NULL THEN
    INSERT INTO public.nexus_result_clinical_lifecycle(
      result_id, clinic_id, processed_at, reviewed_at, reviewed_by
    ) VALUES (
      v_result.id, v_result.clinic_id, v_result.finalized_at, v_now, auth.uid()
    );
  ELSE
    UPDATE public.nexus_result_clinical_lifecycle
       SET processed_at = coalesce(processed_at, v_result.finalized_at),
           reviewed_at = v_now,
           reviewed_by = auth.uid()
     WHERE result_id = v_result.id;
  END IF;

  RETURN v_result.id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_nexus_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_nexus_result(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sign_nexus_result(p_result_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result public.nexus_clinical_results%ROWTYPE;
  v_lifecycle public.nexus_result_clinical_lifecycle%ROWTYPE;
  v_clinic_id uuid := public.current_clinic_id();
  v_now timestamptz := now();
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica ativa não identificada';
  END IF;

  SELECT * INTO v_result
  FROM public.nexus_clinical_results r
  WHERE r.id = p_result_id;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Resultado Nexus inexistente';
  END IF;
  IF v_result.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'nexus_result_tenant_mismatch';
  END IF;
  IF v_result.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'nexus_result_author_mismatch';
  END IF;
  IF v_result.status <> 'finalized' OR v_result.finalized_at IS NULL THEN
    RAISE EXCEPTION 'nexus_result_must_be_processed_before_sign';
  END IF;
  IF NOT public.can_access_patient_clinical_record(v_result.patient_id) THEN
    RAISE EXCEPTION 'nexus_result_care_relationship_required';
  END IF;
  IF NOT public.has_professional_capability(v_result.required_capability) THEN
    RAISE EXCEPTION 'Profissional sem capability para esta ferramenta Nexus';
  END IF;

  SELECT * INTO v_lifecycle
  FROM public.nexus_result_clinical_lifecycle l
  WHERE l.result_id = v_result.id
  FOR UPDATE;

  IF v_lifecycle.result_id IS NULL
     OR v_lifecycle.reviewed_at IS NULL
     OR v_lifecycle.reviewed_by <> auth.uid() THEN
    RAISE EXCEPTION 'nexus_result_review_required_before_sign';
  END IF;

  IF v_lifecycle.signed_at IS NOT NULL THEN
    RETURN v_result.id;
  END IF;

  UPDATE public.nexus_result_clinical_lifecycle
     SET signed_at = v_now,
         signed_by = auth.uid()
   WHERE result_id = v_result.id;

  RETURN v_result.id;
END;
$$;

REVOKE ALL ON FUNCTION public.sign_nexus_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_nexus_result(uuid) TO authenticated;

-- Effective self-assessment writer: technical processing creates only processed_at.
CREATE OR REPLACE FUNCTION public.complete_nexus_self_assessment_processing(
  p_invite_id uuid, p_result jsonb, p_red_flags jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite public.nexus_self_assessment_invites%ROWTYPE;
  v_result_id uuid;
  v_flag jsonb;
  v_previous_claims text;
  v_processed_at timestamptz;
BEGIN
  IF p_result IS NULL OR jsonb_typeof(p_result) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Resultado processado inválido';
  END IF;
  IF p_red_flags IS NULL OR jsonb_typeof(p_red_flags) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Red flags processadas inválidas';
  END IF;

  SELECT * INTO v_invite FROM public.nexus_self_assessment_invites i
   WHERE i.id = p_invite_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Convite inexistente'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = v_invite.clinic_id
      AND c.lifecycle_status = 'active'
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'clinic_not_active' USING ERRCODE = '42501';
  END IF;

  IF v_invite.processed_result_id IS NOT NULL OR v_invite.status = 'processed' THEN
    RETURN v_invite.processed_result_id;
  END IF;
  IF v_invite.status <> 'submitted' OR v_invite.submitted_at IS NULL OR v_invite.processing_started_at IS NULL THEN
    RAISE EXCEPTION 'Convite não reservado para processamento';
  END IF;
  IF nullif(p_result->>'toolKey', '') IS DISTINCT FROM v_invite.scale_key
     OR nullif(p_result->>'ruleVersion', '') IS DISTINCT FROM v_invite.rule_version THEN
    RAISE EXCEPTION 'Instrumento/versão processados não correspondem ao convite';
  END IF;
  IF nullif(p_result->>'moduleKey', '') IS NULL
     OR nullif(p_result->>'ruleKey', '') IS NULL
     OR nullif(p_result->>'requiredCapability', '') IS NULL THEN
    RAISE EXCEPTION 'Contrato clínico processado incompleto';
  END IF;
  IF jsonb_typeof(p_result->'inputSnapshot') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_result->'outputSnapshot') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_result->'evidenceSnapshot') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Snapshots processados inválidos';
  END IF;

  v_previous_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_invite.professional_id::text, 'role', 'authenticated')::text, true);

  INSERT INTO public.nexus_clinical_results (
    clinic_id, patient_id, professional_id, appointment_id, module_key, tool_key,
    rule_key, rule_version, required_capability, status, input_snapshot, output_snapshot,
    total_score, max_score, classification, severity, interpretation, soap_text, evidence_snapshot
  ) VALUES (
    v_invite.clinic_id, v_invite.patient_id, v_invite.professional_id, v_invite.appointment_id,
    p_result->>'moduleKey', p_result->>'toolKey', p_result->>'ruleKey', p_result->>'ruleVersion',
    p_result->>'requiredCapability', 'draft', p_result->'inputSnapshot', p_result->'outputSnapshot',
    nullif(p_result->>'totalScore', '')::numeric, nullif(p_result->>'maxScore', '')::numeric,
    nullif(p_result->>'classification', ''), nullif(p_result->>'severity', ''),
    nullif(p_result->>'interpretation', ''), nullif(p_result->>'soapText', ''), p_result->'evidenceSnapshot'
  ) RETURNING id INTO v_result_id;

  FOR v_flag IN SELECT value FROM jsonb_array_elements(p_red_flags) LOOP
    IF jsonb_typeof(v_flag) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Red flag inválida'; END IF;
    INSERT INTO public.nexus_red_flags (
      clinic_id, patient_id, result_id, flag_code, severity, title, message, required_action
    ) VALUES (
      v_invite.clinic_id, v_invite.patient_id, v_result_id, v_flag->>'flagCode',
      v_flag->>'severity', v_flag->>'title', v_flag->>'message', nullif(v_flag->>'requiredAction', '')
    );
  END LOOP;

  UPDATE public.nexus_clinical_results
     SET status = 'finalized', finalized_at = now()
   WHERE id = v_result_id AND status = 'draft'
   RETURNING finalized_at INTO v_processed_at;

  INSERT INTO public.nexus_result_clinical_lifecycle(
    result_id, clinic_id, processed_at
  ) VALUES (
    v_result_id, v_invite.clinic_id, v_processed_at
  );

  UPDATE public.nexus_self_assessment_invites
     SET processed_result_id = v_result_id, status = 'processed', processing_started_at = NULL,
         last_processing_error = NULL, updated_at = now()
   WHERE id = v_invite.id AND processed_result_id IS NULL;

  IF v_previous_claims IS NULL THEN
    PERFORM set_config('request.jwt.claims', '', true);
  ELSE
    PERFORM set_config('request.jwt.claims', v_previous_claims, true);
  END IF;
  RETURN v_result_id;
EXCEPTION WHEN OTHERS THEN
  IF v_previous_claims IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', v_previous_claims, true);
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb) TO service_role;

-- EEM remains a specific atomic clinician writer. Its explicit human action now
-- proves processing, review and application-level clinical finalization separately.
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
  v_now timestamptz := now();
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
    SELECT 1 FROM public.patients p
    WHERE p.id = p_patient_id
      AND p.clinic_id = v_clinic_id
      AND p.deleted_at IS NULL
      AND coalesce(p.anonimizado, false) IS FALSE
  ) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica';
  END IF;

  IF p_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND a.clinic_id = v_clinic_id
      AND a.paciente_id = p_patient_id
      AND a.fisio_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Atendimento incompatível com paciente, clínica ou profissional';
  END IF;

  INSERT INTO public.nexus_clinical_results (
    clinic_id, patient_id, professional_id, appointment_id,
    module_key, tool_key, rule_key, rule_version, required_capability, status,
    input_snapshot, output_snapshot, classification, severity, interpretation,
    soap_text, evidence_snapshot, finalized_at
  ) VALUES (
    v_clinic_id, p_patient_id, auth.uid(), p_appointment_id,
    'eem', 'eem', 'nexus.eem', trim(p_rule_version), 'nexus.eem', 'finalized',
    p_input_snapshot, p_output_snapshot, p_classification, p_severity, p_interpretation,
    p_soap_text, p_evidence_snapshot, v_now
  ) RETURNING id INTO v_result_id;

  FOR v_flag IN SELECT value FROM jsonb_array_elements(p_red_flags) LOOP
    IF jsonb_typeof(v_flag) <> 'object'
       OR nullif(trim(coalesce(v_flag->>'flagCode', '')), '') IS NULL
       OR (v_flag->>'severity') NOT IN ('warning','critical')
       OR nullif(trim(coalesce(v_flag->>'title', '')), '') IS NULL
       OR nullif(trim(coalesce(v_flag->>'message', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Red flag Nexus inválida';
    END IF;

    INSERT INTO public.nexus_red_flags(
      clinic_id, patient_id, result_id, flag_code, severity, title, message, required_action
    ) VALUES (
      v_clinic_id, p_patient_id, v_result_id, trim(v_flag->>'flagCode'),
      v_flag->>'severity', trim(v_flag->>'title'), trim(v_flag->>'message'),
      nullif(trim(coalesce(v_flag->>'requiredAction', '')), '')
    );
  END LOOP;

  INSERT INTO public.nexus_result_clinical_lifecycle(
    result_id, clinic_id, processed_at,
    reviewed_at, reviewed_by, signed_at, signed_by
  ) VALUES (
    v_result_id, v_clinic_id, v_now,
    v_now, auth.uid(), v_now, auth.uid()
  );

  RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) TO authenticated;

COMMENT ON TABLE public.nexus_result_clinical_lifecycle IS
  'C-03 lifecycle metadata. Legacy nexus_clinical_results.status=finalized proves technical freeze only; human review/signing require explicit reviewed_*/signed_* evidence here.';
COMMENT ON COLUMN public.nexus_result_clinical_lifecycle.signed_at IS
  'Application-level clinical finalization timestamp; not a cryptographic or legal digital-signature primitive.';

COMMIT;