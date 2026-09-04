BEGIN;

CREATE TABLE IF NOT EXISTS public.nexus_self_assessment_invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  scale_key text NOT NULL,
  rule_version text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','opened','submitted','processed','revoked','expired')),
  response_snapshot jsonb,
  processed_result_id uuid REFERENCES public.nexus_clinical_results(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexus_self_assessment_patient ON public.nexus_self_assessment_invites(clinic_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_self_assessment_pending ON public.nexus_self_assessment_invites(status, expires_at) WHERE status IN ('pending','opened','submitted');

ALTER TABLE public.nexus_self_assessment_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nexus_self_assessment_staff_read ON public.nexus_self_assessment_invites;
CREATE POLICY nexus_self_assessment_staff_read
ON public.nexus_self_assessment_invites
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.has_professional_capability('nexus.scales'));

REVOKE ALL ON public.nexus_self_assessment_invites FROM anon, authenticated;
GRANT SELECT ON public.nexus_self_assessment_invites TO authenticated;

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

  v_clinic_id := public.current_clinic_id();
  IF v_clinic_id IS NULL THEN RAISE EXCEPTION 'Clínica inválida'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = p_patient_id AND p.clinic_id = v_clinic_id) THEN
    RAISE EXCEPTION 'Paciente inválido para a clínica atual';
  END IF;

  IF p_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.id = p_appointment_id AND a.clinic_id = v_clinic_id AND a.paciente_id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'Atendimento inválido para paciente/clínica';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(hours => greatest(1, least(coalesce(p_expires_hours,48),168)));

  INSERT INTO public.nexus_self_assessment_invites (
    clinic_id, patient_id, professional_id, appointment_id, scale_key, rule_version, token_hash, expires_at
  ) VALUES (
    v_clinic_id, p_patient_id, auth.uid(), p_appointment_id, trim(p_scale_key), trim(p_rule_version), encode(digest(v_token, 'sha256'),'hex'), v_expires
  ) RETURNING id INTO v_invite_id;

  RETURN QUERY SELECT v_invite_id, v_token, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_nexus_self_assessment(p_token text)
RETURNS TABLE(invite_id uuid, scale_key text, rule_version text, expires_at timestamptz, status text)
LANGUAGE plpgsql
SECURITY DEFINER
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
     AND i.status IN ('pending','opened');

  RETURN QUERY
  SELECT i.id, i.scale_key, i.rule_version, i.expires_at, i.status
  FROM public.nexus_self_assessment_invites i
  WHERE i.token_hash = v_hash
    AND i.revoked_at IS NULL
    AND i.submitted_at IS NULL
    AND i.expires_at > now()
    AND i.status IN ('pending','opened')
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_nexus_self_assessment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_nexus_self_assessment(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_nexus_self_assessment(p_token text, p_response jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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
     AND i.status IN ('pending','opened');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_nexus_self_assessment(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_nexus_self_assessment(text,jsonb) TO anon, authenticated;

COMMIT;
