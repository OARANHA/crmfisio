-- MEDICSPRO — Platform automation observability security
-- Moves automation-run visibility out of clinic RBAC and into the Platform Admin domain.

BEGIN;

-- automation_runs is platform-wide operational telemetry. It is not tenant data and
-- must not be readable merely because a user is owner/admin of any clinic.
REVOKE SELECT ON TABLE public.automation_runs FROM authenticated;
DROP POLICY IF EXISTS automation_runs_select_admin ON public.automation_runs;

CREATE OR REPLACE FUNCTION public.platform_get_automation_runs(p_limit integer DEFAULT 30)
RETURNS TABLE (
  id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  trigger_source text,
  queued_confirmations integer,
  queued_nps integer,
  expired_waitlist_offers integer,
  worker_processed integer,
  worker_sent integer,
  worker_failed integer,
  clinics_processed integer,
  status text,
  error_message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.started_at,
    r.finished_at,
    r.trigger_source,
    r.queued_confirmations,
    r.queued_nps,
    r.expired_waitlist_offers,
    r.worker_processed,
    r.worker_sent,
    r.worker_failed,
    r.clinics_processed,
    r.status,
    r.error_message
  FROM public.automation_runs r
  ORDER BY r.started_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_get_automation_runs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_get_automation_runs(integer) TO authenticated;

COMMENT ON FUNCTION public.platform_get_automation_runs(integer) IS
  'Platform-admin-only operational telemetry for recent MedicsPro automation runs.';

COMMIT;
