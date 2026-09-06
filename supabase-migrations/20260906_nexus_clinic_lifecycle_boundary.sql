BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_nexus_self_assessment(p_token text)
RETURNS TABLE(invite_id uuid, scale_key text, rule_version text, expires_at timestamptz, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_hash text;
BEGIN
  v_hash := encode(digest(coalesce(p_token,''), 'sha256'),'hex');
  UPDATE public.nexus_self_assessment_invites i
     SET opened_at = coalesce(i.opened_at, now()),
         status = CASE WHEN i.status = 'pending' THEN 'opened' ELSE i.status END,
         updated_at = now()
   WHERE i.token_hash = v_hash
     AND i.revoked_at IS NULL
     AND i.submitted_at IS NULL
     AND i.expires_at > now()
     AND i.status IN ('pending','opened')
     AND EXISTS (
       SELECT 1 FROM public.clinics c
       WHERE c.id = i.clinic_id
         AND c.lifecycle_status = 'active'
         AND c.deleted_at IS NULL
     );

  RETURN QUERY
  SELECT i.id, i.scale_key, i.rule_version, i.expires_at, i.status
  FROM public.nexus_self_assessment_invites i
  JOIN public.clinics c ON c.id = i.clinic_id
  WHERE i.token_hash = v_hash
    AND i.revoked_at IS NULL
    AND i.submitted_at IS NULL
    AND i.expires_at > now()
    AND i.status IN ('pending','opened')
    AND c.lifecycle_status = 'active'
    AND c.deleted_at IS NULL
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_nexus_self_assessment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_nexus_self_assessment(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_nexus_self_assessment(p_token text, p_response jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_hash text; v_count integer;
BEGIN
  IF p_response IS NULL OR jsonb_typeof(p_response) <> 'object' THEN
    RAISE EXCEPTION 'Resposta inválida';
  END IF;
  IF pg_column_size(p_response) > 65536 THEN
    RAISE EXCEPTION 'Resposta excede tamanho permitido';
  END IF;
  v_hash := encode(digest(coalesce(p_token,''), 'sha256'),'hex');
  UPDATE public.nexus_self_assessment_invites i
     SET response_snapshot = p_response,
         submitted_at = now(),
         status = 'submitted',
         updated_at = now()
   WHERE i.token_hash = v_hash
     AND i.revoked_at IS NULL
     AND i.submitted_at IS NULL
     AND i.expires_at > now()
     AND i.status IN ('pending','opened')
     AND EXISTS (
       SELECT 1 FROM public.clinics c
       WHERE c.id = i.clinic_id
         AND c.lifecycle_status = 'active'
         AND c.deleted_at IS NULL
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_nexus_self_assessment(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_nexus_self_assessment(text,jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_nexus_self_assessment_invites(
  p_scale_key text, p_rule_version text, p_limit integer DEFAULT 20
)
RETURNS TABLE(
  invite_id uuid, clinic_id uuid, patient_id uuid, professional_id uuid,
  appointment_id uuid, scale_key text, rule_version text, response_snapshot jsonb
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF nullif(trim(coalesce(p_scale_key, '')), '') IS NULL
     OR nullif(trim(coalesce(p_rule_version, '')), '') IS NULL THEN
    RAISE EXCEPTION 'scale_key/rule_version obrigatórios';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT i.id
    FROM public.nexus_self_assessment_invites i
    JOIN public.clinics c ON c.id = i.clinic_id
    WHERE i.status = 'submitted'
      AND i.processed_result_id IS NULL
      AND i.submitted_at IS NOT NULL
      AND i.scale_key = trim(p_scale_key)
      AND i.rule_version = trim(p_rule_version)
      AND c.lifecycle_status = 'active'
      AND c.deleted_at IS NULL
      AND (i.processing_started_at IS NULL OR i.processing_started_at < now() - interval '10 minutes')
    ORDER BY i.submitted_at, i.id
    FOR UPDATE OF i SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 20), 100))
  ), claimed AS (
    UPDATE public.nexus_self_assessment_invites i
       SET processing_started_at = now(),
           processing_attempts = i.processing_attempts + 1,
           last_processing_error = NULL,
           updated_at = now()
      FROM picked
     WHERE i.id = picked.id
    RETURNING i.*
  )
  SELECT c.id, c.clinic_id, c.patient_id, c.professional_id, c.appointment_id,
         c.scale_key, c.rule_version, c.response_snapshot
  FROM claimed c;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_nexus_self_assessment_invites(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_nexus_self_assessment_invites(text,text,integer) TO service_role;

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

  UPDATE public.nexus_clinical_results SET status = 'finalized', finalized_at = now()
   WHERE id = v_result_id AND status = 'draft';
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

UPDATE public.nexus_self_assessment_invites i
   SET processing_started_at = NULL,
       last_processing_error = 'clinic_not_active',
       updated_at = now()
  FROM public.clinics c
 WHERE c.id = i.clinic_id
   AND (c.lifecycle_status <> 'active' OR c.deleted_at IS NOT NULL)
   AND i.status = 'submitted'
   AND i.processed_result_id IS NULL
   AND i.processing_started_at IS NOT NULL;

COMMIT;
