\echo '1) report-specific recovery_events policy exists'
SELECT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public'
    AND tablename='recovery_events'
    AND policyname='recovery_events_select_reports'
) AS ok;

\echo '2) legacy tenant-only recovery_events policy is removed'
SELECT NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public'
    AND tablename='recovery_events'
    AND policyname='recovery_events_select_tenant'
) AS legacy_removed;

\echo '3) recovery_events policy requires reports entitlement'
SELECT position('reports.access' in coalesce(qual,'')) > 0 AS reports_gate
FROM pg_policies
WHERE schemaname='public'
  AND tablename='recovery_events'
  AND policyname='recovery_events_select_reports';

\echo '4) recovery_events policy matches canonical report roles'
SELECT
  position('owner' in coalesce(qual,'')) > 0
  AND position('admin' in coalesce(qual,'')) > 0
  AND position('fisio' in coalesce(qual,'')) > 0
  AND position('financeiro' in coalesce(qual,'')) > 0
  AND position('recep' in coalesce(qual,'')) = 0 AS report_roles_guarded
FROM pg_policies
WHERE schemaname='public'
  AND tablename='recovery_events'
  AND policyname='recovery_events_select_reports';

\echo '5) get_recovery_roi RPC exists'
SELECT to_regprocedure('public.get_recovery_roi(date,date)') IS NOT NULL AS ok;

\echo '6) get_recovery_roi enforces reports entitlement'
SELECT position('reports.access' in pg_get_functiondef('public.get_recovery_roi(date,date)'::regprocedure)) > 0 AS reports_gate;

\echo '7) get_recovery_roi enforces canonical report RBAC'
SELECT
  position('owner' in pg_get_functiondef('public.get_recovery_roi(date,date)'::regprocedure)) > 0
  AND position('admin' in pg_get_functiondef('public.get_recovery_roi(date,date)'::regprocedure)) > 0
  AND position('fisio' in pg_get_functiondef('public.get_recovery_roi(date,date)'::regprocedure)) > 0
  AND position('financeiro' in pg_get_functiondef('public.get_recovery_roi(date,date)'::regprocedure)) > 0
  AND position('recep' in pg_get_functiondef('public.get_recovery_roi(date,date)'::regprocedure)) = 0 AS report_roles_guarded;

\echo '8) get_recovery_roi validates report date range'
SELECT position('p_to < p_from' in pg_get_functiondef('public.get_recovery_roi(date,date)'::regprocedure)) > 0 AS range_guarded;

\echo '9) authenticated can execute ROI RPC and anon cannot'
SELECT
  has_function_privilege('authenticated','public.get_recovery_roi(date,date)','EXECUTE') AS authenticated_allowed,
  NOT has_function_privilege('anon','public.get_recovery_roi(date,date)','EXECUTE') AS anon_denied;

\echo '10) shared operational tables were not entitlement-gated by this slice'
SELECT
  NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname IN (
      'trg_guard_reports_appointments_entitlement',
      'trg_guard_reports_payments_entitlement',
      'trg_guard_reports_patients_entitlement'
    )
  ) AS shared_tables_untouched;
