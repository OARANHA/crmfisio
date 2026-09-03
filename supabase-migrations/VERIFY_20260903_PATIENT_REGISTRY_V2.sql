-- Patient Registry V2 verification — read-only except no-op catalog checks.

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'patients'
  AND column_name IN ('preferred_name', 'avatar_path', 'address_line', 'insurance_number', 'administrative_notes')
ORDER BY column_name;

SELECT relname, relrowsecurity
FROM pg_class
WHERE oid = 'public.patient_guardians'::regclass;

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'patient_guardians'
ORDER BY policyname;

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'patient-avatars';

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'patient_avatars_%'
ORDER BY policyname;

-- Manual auth matrix after structural checks:
-- recep: may create/update patient + guardian and upload/read avatar in own clinic.
-- fisio: may read and update patient context + guardian, upload/read avatar in own clinic.
-- financeiro: no guardian write and no avatar write.
-- clinic A must not read/write guardian/avatar of clinic B.
-- anon must not read patient-avatars.
