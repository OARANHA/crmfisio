-- Patient Registry V2 verification — structural/read-only checks.

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

SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_patient_registry_v2', 'set_patient_avatar_path', 'get_medicspro_storage_status')
ORDER BY p.proname;

-- Expected RPC privileges:
-- anon_execute = false
-- authenticated_execute = true

-- Manual auth matrix after structural checks:
-- owner/admin: can consult storage status without seeing credentials.
-- recep: may create patient + guardian and upload/read avatar in own clinic.
-- fisio: may create/read patient context + guardian and upload/read avatar in own clinic.
-- financeiro: cannot create patient through V2 RPC, cannot write guardian/avatar.
-- clinic A must not read/write guardian/avatar of clinic B.
-- minor patient without guardian must be rejected atomically.
-- anon must not read patient-avatars or execute V2 RPCs.
