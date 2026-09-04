-- VERIFY — Platform automation observability security

-- 1) The legacy clinic-role policy must be gone.
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'automation_runs';

-- Expected: no automation_runs_select_admin policy.

-- 2) authenticated must not have direct SELECT on platform-wide telemetry.
SELECT has_table_privilege('authenticated', 'public.automation_runs', 'SELECT') AS authenticated_can_select_automation_runs;
-- Expected: false.

-- 3) RPC exists and is executable by authenticated (authorization happens inside).
SELECT to_regprocedure('public.platform_get_automation_runs(integer)') IS NOT NULL AS rpc_exists;
SELECT has_function_privilege('authenticated', 'public.platform_get_automation_runs(integer)', 'EXECUTE') AS authenticated_can_execute_rpc;
-- Expected: true / true.

-- 4) As a normal authenticated clinic user, this must fail with platform_admin_required.
-- SELECT * FROM public.platform_get_automation_runs(5);

-- 5) As an active Platform Admin, this must return at most 5 newest rows.
-- SELECT * FROM public.platform_get_automation_runs(5);
