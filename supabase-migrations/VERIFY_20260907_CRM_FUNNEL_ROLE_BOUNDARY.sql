\echo '1) CRM stage guard trigger exists'
SELECT EXISTS (
  SELECT 1
  FROM pg_trigger
  WHERE tgrelid = 'public.patients'::regclass
    AND tgname = 'trg_guard_patient_crm_stage_entitlement'
    AND NOT tgisinternal
) AS ok;

\echo '2) guard checks CRM entitlement'
SELECT position(
  'current_clinic_entitlement_allowed(''crm.access'')'
  IN pg_get_functiondef('public.guard_patient_crm_stage_entitlement()'::regprocedure)
) > 0 AS ok;

\echo '3) guard checks canonical CRM write roles'
SELECT
  position('current_app_role()' IN pg_get_functiondef('public.guard_patient_crm_stage_entitlement()'::regprocedure)) > 0
  AND position('owner' IN pg_get_functiondef('public.guard_patient_crm_stage_entitlement()'::regprocedure)) > 0
  AND position('admin' IN pg_get_functiondef('public.guard_patient_crm_stage_entitlement()'::regprocedure)) > 0
  AND position('recep' IN pg_get_functiondef('public.guard_patient_crm_stage_entitlement()'::regprocedure)) > 0
  AS ok;

\echo '4) guard remains fail-closed with SQLSTATE 42501'
SELECT position(
  '42501'
  IN pg_get_functiondef('public.guard_patient_crm_stage_entitlement()'::regprocedure)
) > 0 AS ok;

\echo '5) trigger function is not executable by anon or PUBLIC'
SELECT
  NOT has_function_privilege('anon', 'public.guard_patient_crm_stage_entitlement()', 'EXECUTE')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
    WHERE p.oid = 'public.guard_patient_crm_stage_entitlement()'::regprocedure
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) AS ok;
