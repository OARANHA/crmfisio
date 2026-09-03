BEGIN;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS preferred_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_path TEXT,
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS insurance_number TEXT,
  ADD COLUMN IF NOT EXISTS administrative_notes TEXT;

CREATE TABLE IF NOT EXISTS public.patient_guardians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  is_legal_guardian BOOLEAN NOT NULL DEFAULT false,
  is_financial_responsible BOOLEAN NOT NULL DEFAULT false,
  is_primary_contact BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_guardians_patient
  ON public.patient_guardians(patient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_patient_guardians_clinic
  ON public.patient_guardians(clinic_id, patient_id);

CREATE OR REPLACE FUNCTION public.patient_registry_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_guardians_updated_at ON public.patient_guardians;
CREATE TRIGGER trg_patient_guardians_updated_at
BEFORE UPDATE ON public.patient_guardians
FOR EACH ROW EXECUTE FUNCTION public.patient_registry_set_updated_at();

ALTER TABLE public.patient_guardians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_guardians_select_tenant ON public.patient_guardians;
CREATE POLICY patient_guardians_select_tenant ON public.patient_guardians
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = patient_guardians.clinic_id
  )
);

DROP POLICY IF EXISTS patient_guardians_insert_tenant ON public.patient_guardians;
CREATE POLICY patient_guardians_insert_tenant ON public.patient_guardians
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'fisio', 'recep')
  AND EXISTS (
    SELECT 1 FROM public.patients pt
    WHERE pt.id = patient_guardians.patient_id
      AND pt.clinic_id = patient_guardians.clinic_id
      AND pt.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS patient_guardians_update_tenant ON public.patient_guardians;
CREATE POLICY patient_guardians_update_tenant ON public.patient_guardians
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'fisio', 'recep')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1 FROM public.patients pt
    WHERE pt.id = patient_guardians.patient_id
      AND pt.clinic_id = patient_guardians.clinic_id
      AND pt.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS patient_guardians_delete_tenant ON public.patient_guardians;
CREATE POLICY patient_guardians_delete_tenant ON public.patient_guardians
FOR DELETE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'recep')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_guardians TO authenticated;

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
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid() AND ativo = true;

  IF v_profile.id IS NULL OR v_profile.role NOT IN ('owner', 'admin', 'fisio', 'recep') THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar paciente';
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

  INSERT INTO public.patients (
    clinic_id, nome, preferred_name, nascimento, telefone, email, cpf,
    convenio, insurance_number, address_line, administrative_notes,
    queixa_principal, cid10, funil_stage, status, ultima_visita,
    opt_in_whats, anonimizado, anamnese
  ) VALUES (
    v_profile.clinic_id,
    trim(p_patient->>'name'),
    nullif(trim(p_patient->>'preferred_name'), ''),
    v_birth,
    nullif(trim(p_patient->>'phone'), ''),
    nullif(trim(p_patient->>'email'), ''),
    nullif(trim(p_patient->>'cpf'), ''),
    nullif(trim(p_patient->>'insurance'), ''),
    nullif(trim(p_patient->>'insurance_number'), ''),
    nullif(trim(p_patient->>'address_line'), ''),
    nullif(trim(p_patient->>'administrative_notes'), ''),
    nullif(trim(p_patient->>'chief_complaint'), ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_patient->'cid10', '[]'::jsonb))), ARRAY[]::text[]),
    'lead', 'ativo', NULL,
    COALESCE((p_patient->>'whatsapp_opt_in')::boolean, false),
    false,
    '{}'::jsonb
  )
  RETURNING id INTO v_patient_id;

  IF jsonb_typeof(p_guardians) = 'array' THEN
    FOR v_guardian IN SELECT value FROM jsonb_array_elements(p_guardians)
    LOOP
      IF nullif(trim(v_guardian->>'name'), '') IS NULL OR nullif(trim(v_guardian->>'relationship'), '') IS NULL THEN
        RAISE EXCEPTION 'Nome e vínculo do responsável são obrigatórios';
      END IF;

      INSERT INTO public.patient_guardians (
        clinic_id, patient_id, name, relationship, cpf, phone, email,
        is_legal_guardian, is_financial_responsible, is_primary_contact
      ) VALUES (
        v_profile.clinic_id,
        v_patient_id,
        trim(v_guardian->>'name'),
        trim(v_guardian->>'relationship'),
        nullif(trim(v_guardian->>'cpf'), ''),
        nullif(trim(v_guardian->>'phone'), ''),
        nullif(trim(v_guardian->>'email'), ''),
        COALESCE((v_guardian->>'is_legal_guardian')::boolean, false),
        COALESCE((v_guardian->>'is_financial_responsible')::boolean, false),
        COALESCE((v_guardian->>'is_primary_contact')::boolean, false)
      );
    END LOOP;
  END IF;

  RETURN v_patient_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_patient_registry_v2(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_patient_registry_v2(JSONB, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_patient_registry_v2(JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_patient_avatar_path(
  p_patient_id UUID,
  p_avatar_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid() AND ativo = true;

  IF v_profile.id IS NULL OR v_profile.role NOT IN ('owner', 'admin', 'fisio', 'recep') THEN
    RAISE EXCEPTION 'Sem permissão para atualizar avatar';
  END IF;

  IF p_avatar_path IS NOT NULL
     AND split_part(p_avatar_path, '/', 1) <> v_profile.clinic_id::text THEN
    RAISE EXCEPTION 'Caminho de avatar fora da clínica autenticada';
  END IF;

  UPDATE public.patients
  SET avatar_path = nullif(trim(p_avatar_path), '')
  WHERE id = p_patient_id
    AND clinic_id = v_profile.clinic_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paciente não encontrado na clínica autenticada';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_patient_avatar_path(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_patient_avatar_path(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_patient_avatar_path(UUID, TEXT) TO authenticated;

-- Private bucket. Supabase Storage stores object metadata in Postgres while
-- the binary content remains in the configured storage backend.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-avatars',
  'patient-avatars',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS patient_avatars_select_tenant ON storage.objects;
CREATE POLICY patient_avatars_select_tenant ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
);

DROP POLICY IF EXISTS patient_avatars_insert_tenant ON storage.objects;
CREATE POLICY patient_avatars_insert_tenant ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
  AND public.current_app_role() IN ('owner', 'admin', 'fisio', 'recep')
);

DROP POLICY IF EXISTS patient_avatars_update_tenant ON storage.objects;
CREATE POLICY patient_avatars_update_tenant ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
)
WITH CHECK (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
  AND public.current_app_role() IN ('owner', 'admin', 'fisio', 'recep')
);

DROP POLICY IF EXISTS patient_avatars_delete_tenant ON storage.objects;
CREATE POLICY patient_avatars_delete_tenant ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
  AND public.current_app_role() IN ('owner', 'admin', 'recep')
);

COMMIT;
