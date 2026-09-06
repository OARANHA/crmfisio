-- VERIFY — MedicsPro P0 patient clinical read boundary
-- Read-only checks. Expected values are all true.

SELECT to_regprocedure('public.list_patient_clinical_snapshot()') IS NOT NULL
  AS clinical_snapshot_function_exists;

SELECT has_function_privilege('authenticated', 'public.list_patient_clinical_snapshot()', 'EXECUTE')
  AS authenticated_can_execute_clinical_snapshot;

SELECT NOT has_function_privilege('anon', 'public.list_patient_clinical_snapshot()', 'EXECUTE')
  AS anon_cannot_execute_clinical_snapshot;

SELECT position(
  'clinical_access_required'
  IN pg_get_functiondef('public.list_patient_clinical_snapshot()'::regprocedure)
) > 0 AS clinical_role_guard_present;

SELECT position(
  'current_clinic_id'
  IN pg_get_functiondef('public.list_patient_clinical_snapshot()'::regprocedure)
) > 0 AS canonical_tenant_guard_present;
