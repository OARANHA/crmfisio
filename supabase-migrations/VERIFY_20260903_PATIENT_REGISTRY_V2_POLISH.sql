-- Patient Registry V2 polish verification — structural/read-only checks.

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'patient_guardians'
  AND column_name = 'is_emergency_contact';

SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_patient_registry_v2', 'update_patient_registry_v2')
ORDER BY p.proname;

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'patient_guardians'
ORDER BY policyname;

-- Expected:
-- is_emergency_contact boolean default false
-- anon_execute = false for both registry RPCs
-- authenticated_execute = true for both registry RPCs
-- existing guardian tenant policies preserved
-- manual: editing a minor without contacts must fail atomically
-- manual: clinic A must not edit clinic B patient
