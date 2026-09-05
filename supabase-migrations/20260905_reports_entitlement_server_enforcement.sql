-- MEDICSPRO — Reports entitlement server-side enforcement
-- Report-specific resources must obey reports.access and canonical report RBAC.
-- Shared operational tables remain untouched because Agenda/Finance/Clinical flows
-- legitimately need those rows outside the Reports module.
-- Unconfigured clinics remain allowed through clinic_entitlement_allowed().

BEGIN;

DROP POLICY IF EXISTS recovery_events_select_tenant ON public.recovery_events;
DROP POLICY IF EXISTS recovery_events_select_reports ON public.recovery_events;
CREATE POLICY recovery_events_select_reports
ON public.recovery_events
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','fisio','financeiro')
  AND public.clinic_entitlement_allowed(clinic_id, 'reports.access')
);

CREATE OR REPLACE FUNCTION public.get_recovery_roi(
  p_from date DEFAULT date_trunc('month', current_date)::date,
  p_to date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_result jsonb;
BEGIN
  IF v_clinic IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='42501';
  END IF;

  IF v_role NOT IN ('owner','admin','fisio','financeiro') THEN
    RAISE EXCEPTION 'Perfil sem acesso a relatórios' USING ERRCODE='42501';
  END IF;

  IF NOT public.clinic_entitlement_allowed(v_clinic, 'reports.access') THEN
    RAISE EXCEPTION 'Módulo Relatórios não liberado para esta clínica' USING ERRCODE='42501';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Período de relatório inválido' USING ERRCODE='22023';
  END IF;

  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'realized_amount', coalesce(sum(amount) FILTER (WHERE value_kind='realized'),0),
    'pipeline_amount', coalesce(sum(amount) FILTER (WHERE value_kind='pipeline'),0),
    'events', count(*),
    'overdue_payments', count(*) FILTER (WHERE event_type='overdue_payment_recovered'),
    'waitlist_slots', count(*) FILTER (WHERE event_type='waitlist_slot_recovered'),
    'reactivations', count(*) FILTER (WHERE event_type='reactivation_booking'),
    'package_renewals', count(*) FILTER (WHERE event_type='package_renewal')
  ) INTO v_result
  FROM public.recovery_events
  WHERE clinic_id = v_clinic
    AND occurred_at >= p_from::timestamptz
    AND occurred_at < (p_to + 1)::timestamptz;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_recovery_roi(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recovery_roi(date,date) TO authenticated;

COMMENT ON FUNCTION public.get_recovery_roi(date,date) IS
  'Report-only ROI aggregate protected by canonical report RBAC and reports.access entitlement.';

COMMIT;
