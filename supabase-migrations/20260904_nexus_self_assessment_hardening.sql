BEGIN;

ALTER TABLE public.nexus_self_assessment_invites
  DROP CONSTRAINT IF EXISTS nexus_self_assessment_scale_key_nonempty,
  DROP CONSTRAINT IF EXISTS nexus_self_assessment_rule_version_nonempty;

ALTER TABLE public.nexus_self_assessment_invites
  ADD CONSTRAINT nexus_self_assessment_scale_key_nonempty CHECK (length(trim(scale_key)) > 0),
  ADD CONSTRAINT nexus_self_assessment_rule_version_nonempty CHECK (length(trim(rule_version)) > 0);

CREATE OR REPLACE FUNCTION public.create_nexus_self_assessment_invite(
  p_patient_id uuid,
  p_scale_key text,
  p_rule_version text,
  p_appointment_id uuid DEFAULT NULL,
  p_expires_hours integer DEFAULT 48
)
RETURNS TABLE(invite_id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clinic_id uuid;
  v_token text;
  v_invite_id uuid;
  v_expires timestamptz;
BEGIN
  IF NOT public.has_professional_capability('nexus.scales') THEN
    RAISE EXCEPTION 'Sem capability nexus.scales';
  END IF;

  IF nullif(trim(coalesce(p_scale_key, '')), '') IS NULL
     OR nullif(trim(coalesce(p_rule_version, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Instrumento e versão são obrigatórios';
  END IF;

  v_clinic_id := public.current_clinic_id();
  IF v_clinic_id IS NULL THEN RAISE EXCEPTION 'Clínica inválida'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = p_patient_id
      AND p.clinic_id = v_clinic_id
      AND p.deleted_at IS NULL
      AND coalesce(p.anonimizado, false) IS FALSE
  ) THEN
    RAISE EXCEPTION 'Paciente inválido para a clínica atual';
  END IF;

  IF p_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND a.clinic_id = v_clinic_id
      AND a.paciente_id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'Atendimento inválido para paciente/clínica';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(hours => greatest(1, least(coalesce(p_expires_hours,48),168)));

  INSERT INTO public.nexus_self_assessment_invites (
    clinic_id, patient_id, professional_id, appointment_id, scale_key, rule_version, token_hash, expires_at
  ) VALUES (
    v_clinic_id, p_patient_id, auth.uid(), p_appointment_id,
    trim(p_scale_key), trim(p_rule_version), encode(digest(v_token, 'sha256'),'hex'), v_expires
  ) RETURNING id INTO v_invite_id;

  RETURN QUERY SELECT v_invite_id, v_token, v_expires;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_nexus_self_assessment(p_token text, p_response jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_count integer;
  v_invite public.nexus_self_assessment_invites%ROWTYPE;
BEGIN
  IF p_response IS NULL OR jsonb_typeof(p_response) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Resposta inválida';
  END IF;
  IF pg_column_size(p_response) > 65536 THEN
    RAISE EXCEPTION 'Resposta excede tamanho permitido';
  END IF;
  IF jsonb_typeof(p_response->'answers') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_response->'selectedOptions') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Estrutura de resposta inválida';
  END IF;

  v_hash := encode(digest(coalesce(p_token,''), 'sha256'),'hex');

  SELECT * INTO v_invite
  FROM public.nexus_self_assessment_invites i
  WHERE i.token_hash = v_hash
    AND i.revoked_at IS NULL
    AND i.submitted_at IS NULL
    AND i.expires_at > now()
    AND i.status IN ('pending','opened')
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RETURN false;
  END IF;

  IF nullif(p_response->>'scaleKey', '') IS DISTINCT FROM v_invite.scale_key
     OR nullif(p_response->>'ruleVersion', '') IS DISTINCT FROM v_invite.rule_version THEN
    RAISE EXCEPTION 'Instrumento/versão não correspondem ao convite';
  END IF;

  UPDATE public.nexus_self_assessment_invites
  SET response_snapshot = p_response,
      submitted_at = now(),
      status = 'submitted',
      updated_at = now()
  WHERE id = v_invite.id
    AND submitted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

-- Em stacks Supabase self-hosted, default privileges podem conceder EXECUTE
-- diretamente a anon/authenticated/service_role. Revogar PUBLIC não remove ACLs
-- explícitas, portanto o criador do convite deve revogar anon nominalmente.
REVOKE ALL ON FUNCTION public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_nexus_self_assessment(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_nexus_self_assessment(text,jsonb) TO anon, authenticated;

COMMIT;
