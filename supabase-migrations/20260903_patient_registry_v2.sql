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

DROP TRIGGER IF EXISTS trg_patient_guardians_updated_at ON public.patient_guardians;
CREATE TRIGGER trg_patient_guardians_updated_at
BEFORE UPDATE ON public.patient_guardians
FOR EACH ROW EXECUTE FUNCTION public.assessment_set_updated_at();

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

-- Private bucket. Supabase Storage stores only object metadata in Postgres;
-- object bytes remain under the configured storage backend.
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
