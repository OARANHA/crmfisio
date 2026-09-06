-- MedicsPro / Nexus — appointment authorship boundary
-- Ensures Nexus records cannot be linked to another professional's appointment.

BEGIN;

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
SET search_path = public, extensions, pg_temp
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
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica ativa não identificada';
  END IF;

  IF nullif(trim(coalesce(p_scale_key, '')), '') IS NULL
     OR nullif(trim(coalesce(p_rule_version, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Instrumento e versão clínica são obrigatórios';
  END IF;

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
      AND a.fisio_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Atendimento incompatível com paciente, clínica ou profissional';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(hours => greatest(1, least(coalesce(p_expires_hours, 48), 168)));

  INSERT INTO public.nexus_self_assessment_invites (
    clinic_id,
    patient_id,
    professional_id,
    appointment_id,
    scale_key,
    rule_version,
    token_hash,
    expires_at
  ) VALUES (
    v_clinic_id,
    p_patient_id,
    auth.uid(),
    p_appointment_id,
    trim(p_scale_key),
    trim(p_rule_version),
    encode(digest(v_token, 'sha256'), 'hex'),
    v_expires
  )
  RETURNING id INTO v_invite_id;

  RETURN QUERY SELECT v_invite_id, v_token, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_nexus_self_assessment_invite(uuid,text,text,uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_nexus_result_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic_id uuid := public.current_clinic_id();
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica ativa não identificada';
  END IF;

  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := v_clinic_id;
  ELSIF NEW.clinic_id <> v_clinic_id THEN
    RAISE EXCEPTION 'clinic_id incompatível com o usuário autenticado';
  END IF;

  IF NEW.professional_id <> auth.uid() THEN
    RAISE EXCEPTION 'professional_id deve ser o profissional autenticado';
  END IF;

  IF NOT public.has_professional_capability(NEW.required_capability) THEN
    RAISE EXCEPTION 'Profissional sem capability para esta ferramenta Nexus';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = NEW.patient_id
      AND p.clinic_id = v_clinic_id
      AND p.deleted_at IS NULL
      AND coalesce(p.anonimizado, false) IS FALSE
  ) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.professional_id
      AND p.clinic_id = v_clinic_id
      AND p.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para esta clínica';
  END IF;

  IF NEW.appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id
      AND a.clinic_id = v_clinic_id
      AND a.paciente_id = NEW.patient_id
      AND a.fisio_id = NEW.professional_id
  ) THEN
    RAISE EXCEPTION 'Atendimento incompatível com paciente, clínica ou profissional';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexus_result_context ON public.nexus_clinical_results;
CREATE TRIGGER trg_nexus_result_context
BEFORE INSERT OR UPDATE OF clinic_id, patient_id, professional_id, appointment_id, required_capability
ON public.nexus_clinical_results
FOR EACH ROW EXECUTE FUNCTION public.validate_nexus_result_context();

COMMIT;
