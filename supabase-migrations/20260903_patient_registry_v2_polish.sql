BEGIN;

ALTER TABLE public.patient_guardians
  ADD COLUMN IF NOT EXISTS is_emergency_contact BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.update_patient_registry_v2(
  p_patient_id UUID,
  p_patient JSONB,
  p_guardians JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_birth DATE;
  v_guardian JSONB;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid() AND ativo = true;

  IF v_profile.id IS NULL OR v_profile.role NOT IN ('owner', 'admin', 'fisio', 'recep') THEN
    RAISE EXCEPTION 'Sem permissão para editar paciente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id
      AND clinic_id = v_profile.clinic_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Paciente não encontrado na clínica autenticada';
  END IF;

  IF nullif(trim(p_patient->>'name'), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do paciente é obrigatório';
  END IF;

  BEGIN
    v_birth := (p_patient->>'birth_date')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Data de nascimento inválida';
  END;

  IF v_birth > current_date THEN
    RAISE EXCEPTION 'Data de nascimento não pode estar no futuro';
  END IF;

  IF v_birth > (current_date - interval '18 years')::date
     AND (jsonb_typeof(p_guardians) <> 'array' OR jsonb_array_length(p_guardians) = 0) THEN
    RAISE EXCEPTION 'Paciente menor de idade exige ao menos um responsável';
  END IF;

  UPDATE public.patients
  SET nome = trim(p_patient->>'name'),
      preferred_name = nullif(trim(p_patient->>'preferred_name'), ''),
      nascimento = v_birth,
      telefone = nullif(trim(p_patient->>'phone'), ''),
      email = nullif(trim(p_patient->>'email'), ''),
      cpf = nullif(trim(p_patient->>'cpf'), ''),
      convenio = nullif(trim(p_patient->>'insurance'), ''),
      insurance_number = nullif(trim(p_patient->>'insurance_number'), ''),
      address_line = nullif(trim(p_patient->>'address_line'), ''),
      administrative_notes = nullif(trim(p_patient->>'administrative_notes'), ''),
      queixa_principal = nullif(trim(p_patient->>'chief_complaint'), ''),
      cid10 = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_patient->'cid10', '[]'::jsonb))), ARRAY[]::text[]),
      opt_in_whats = COALESCE((p_patient->>'whatsapp_opt_in')::boolean, false)
  WHERE id = p_patient_id
    AND clinic_id = v_profile.clinic_id;

  DELETE FROM public.patient_guardians
  WHERE patient_id = p_patient_id
    AND clinic_id = v_profile.clinic_id;

  IF jsonb_typeof(p_guardians) = 'array' THEN
    FOR v_guardian IN SELECT value FROM jsonb_array_elements(p_guardians)
    LOOP
      IF nullif(trim(v_guardian->>'name'), '') IS NULL OR nullif(trim(v_guardian->>'relationship'), '') IS NULL THEN
        RAISE EXCEPTION 'Nome e vínculo do responsável são obrigatórios';
      END IF;

      INSERT INTO public.patient_guardians (
        clinic_id, patient_id, name, relationship, cpf, phone, email,
        is_legal_guardian, is_financial_responsible, is_primary_contact, is_emergency_contact
      ) VALUES (
        v_profile.clinic_id,
        p_patient_id,
        trim(v_guardian->>'name'),
        trim(v_guardian->>'relationship'),
        nullif(trim(v_guardian->>'cpf'), ''),
        nullif(trim(v_guardian->>'phone'), ''),
        nullif(trim(v_guardian->>'email'), ''),
        COALESCE((v_guardian->>'is_legal_guardian')::boolean, false),
        COALESCE((v_guardian->>'is_financial_responsible')::boolean, false),
        COALESCE((v_guardian->>'is_primary_contact')::boolean, false),
        COALESCE((v_guardian->>'is_emergency_contact')::boolean, false)
      );
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_patient_registry_v2(UUID, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_patient_registry_v2(UUID, JSONB, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_patient_registry_v2(UUID, JSONB, JSONB) TO authenticated;

-- Extend creation so emergency-contact semantics are persisted for new records too.
CREATE OR REPLACE FUNCTION public.create_patient_registry_v2(
  p_patient JSONB,
  p_guardians JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_patient_id UUID;
  v_birth DATE;
  v_guardian JSONB;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid() AND ativo = true;
  IF v_profile.id IS NULL OR v_profile.role NOT IN ('owner', 'admin', 'fisio', 'recep') THEN RAISE EXCEPTION 'Sem permissão para cadastrar paciente'; END IF;
  IF nullif(trim(p_patient->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Nome do paciente é obrigatório'; END IF;
  BEGIN v_birth := (p_patient->>'birth_date')::date; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Data de nascimento inválida'; END;
  IF v_birth > current_date THEN RAISE EXCEPTION 'Data de nascimento não pode estar no futuro'; END IF;
  IF v_birth > (current_date - interval '18 years')::date AND (jsonb_typeof(p_guardians) <> 'array' OR jsonb_array_length(p_guardians) = 0) THEN RAISE EXCEPTION 'Paciente menor de idade exige ao menos um responsável'; END IF;

  INSERT INTO public.patients (
    clinic_id, nome, preferred_name, nascimento, telefone, email, cpf,
    convenio, insurance_number, address_line, administrative_notes,
    queixa_principal, cid10, funil_stage, status, ultima_visita,
    opt_in_whats, anonimizado, anamnese
  ) VALUES (
    v_profile.clinic_id, trim(p_patient->>'name'), nullif(trim(p_patient->>'preferred_name'), ''), v_birth,
    nullif(trim(p_patient->>'phone'), ''), nullif(trim(p_patient->>'email'), ''), nullif(trim(p_patient->>'cpf'), ''),
    nullif(trim(p_patient->>'insurance'), ''), nullif(trim(p_patient->>'insurance_number'), ''), nullif(trim(p_patient->>'address_line'), ''),
    nullif(trim(p_patient->>'administrative_notes'), ''), nullif(trim(p_patient->>'chief_complaint'), ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_patient->'cid10', '[]'::jsonb))), ARRAY[]::text[]),
    'lead', 'ativo', NULL, COALESCE((p_patient->>'whatsapp_opt_in')::boolean, false), false, '{}'::jsonb
  ) RETURNING id INTO v_patient_id;

  IF jsonb_typeof(p_guardians) = 'array' THEN
    FOR v_guardian IN SELECT value FROM jsonb_array_elements(p_guardians)
    LOOP
      IF nullif(trim(v_guardian->>'name'), '') IS NULL OR nullif(trim(v_guardian->>'relationship'), '') IS NULL THEN RAISE EXCEPTION 'Nome e vínculo do responsável são obrigatórios'; END IF;
      INSERT INTO public.patient_guardians (
        clinic_id, patient_id, name, relationship, cpf, phone, email,
        is_legal_guardian, is_financial_responsible, is_primary_contact, is_emergency_contact
      ) VALUES (
        v_profile.clinic_id, v_patient_id, trim(v_guardian->>'name'), trim(v_guardian->>'relationship'),
        nullif(trim(v_guardian->>'cpf'), ''), nullif(trim(v_guardian->>'phone'), ''), nullif(trim(v_guardian->>'email'), ''),
        COALESCE((v_guardian->>'is_legal_guardian')::boolean, false),
        COALESCE((v_guardian->>'is_financial_responsible')::boolean, false),
        COALESCE((v_guardian->>'is_primary_contact')::boolean, false),
        COALESCE((v_guardian->>'is_emergency_contact')::boolean, false)
      );
    END LOOP;
  END IF;
  RETURN v_patient_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_patient_registry_v2(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_patient_registry_v2(JSONB, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_patient_registry_v2(JSONB, JSONB) TO authenticated;

COMMIT;
