\pset pager off

SELECT '1) lifecycle column exists' AS check,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='clinics' AND column_name='lifecycle_status'
       ) AS ok;

SELECT '2) lifecycle constraint exists' AS check,
       EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid='public.clinics'::regclass
           AND conname='clinics_lifecycle_status_check'
       ) AS ok;

SELECT '3) tenant clinic resolver requires active clinic' AS check,
       position('lifecycle_status = ''active''' in pg_get_functiondef('public.current_clinic_id()'::regprocedure)) > 0 AS ok;

SELECT '4) tenant role resolver requires active clinic' AS check,
       position('lifecycle_status = ''active''' in pg_get_functiondef('public.current_app_role()'::regprocedure)) > 0 AS ok;

SELECT '5) tenant resolvers reject deleted clinics' AS check,
       position('deleted_at IS NULL' in pg_get_functiondef('public.current_clinic_id()'::regprocedure)) > 0
       AND position('deleted_at IS NULL' in pg_get_functiondef('public.current_app_role()'::regprocedure)) > 0 AS ok;

SELECT '6) suspend RPC exists' AS check,
       to_regprocedure('public.platform_suspend_clinic(uuid,text)') IS NOT NULL AS ok;

SELECT '7) reactivate RPC exists' AS check,
       to_regprocedure('public.platform_reactivate_clinic(uuid,text)') IS NOT NULL AS ok;

SELECT '8) lifecycle RPCs require Platform Admin and reason' AS check,
       position('is_platform_admin' in pg_get_functiondef('public.platform_suspend_clinic(uuid,text)'::regprocedure)) > 0
       AND position('reason_required' in pg_get_functiondef('public.platform_suspend_clinic(uuid,text)'::regprocedure)) > 0
       AND position('is_platform_admin' in pg_get_functiondef('public.platform_reactivate_clinic(uuid,text)'::regprocedure)) > 0
       AND position('reason_required' in pg_get_functiondef('public.platform_reactivate_clinic(uuid,text)'::regprocedure)) > 0 AS ok;

SELECT '9) suspension stops clinic automations and lifecycle changes are audited' AS check,
       position('automation_settings' in pg_get_functiondef('public.platform_suspend_clinic(uuid,text)'::regprocedure)) > 0
       AND position('CLINIC_SUSPENDED' in pg_get_functiondef('public.platform_suspend_clinic(uuid,text)'::regprocedure)) > 0
       AND position('CLINIC_REACTIVATED' in pg_get_functiondef('public.platform_reactivate_clinic(uuid,text)'::regprocedure)) > 0 AS ok;

SELECT '10) authenticated can execute lifecycle RPCs, anon cannot, and clinic catalog exposes status' AS check,
       has_function_privilege('authenticated', 'public.platform_suspend_clinic(uuid,text)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.platform_reactivate_clinic(uuid,text)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.platform_suspend_clinic(uuid,text)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.platform_reactivate_clinic(uuid,text)', 'EXECUTE')
       AND position('lifecycle_status' in pg_get_functiondef('public.platform_list_clinics()'::regprocedure)) > 0 AS ok;
