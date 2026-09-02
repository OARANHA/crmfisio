-- MEDICSPRO — fechamento e pagamento persistente de repasses profissionais
BEGIN;

CREATE TABLE IF NOT EXISTS public.commission_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  period date NOT NULL CHECK (period = date_trunc('month', period)::date),
  base_amount integer NOT NULL CHECK (base_amount > 0),
  percentage numeric(5,2) NOT NULL DEFAULT 40 CHECK (percentage > 0 AND percentage <= 100),
  commission_amount integer NOT NULL CHECK (commission_amount >= 0),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','pago')),
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, professional_id, period)
);

CREATE INDEX IF NOT EXISTS commission_settlements_period_idx
  ON public.commission_settlements (clinic_id, period DESC, professional_id);

ALTER TABLE public.commission_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_settlements_select ON public.commission_settlements;
CREATE POLICY commission_settlements_select
ON public.commission_settlements
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner','admin','financeiro')
    OR (public.current_app_role() = 'fisio' AND professional_id = auth.uid())
  )
);

REVOKE ALL ON public.commission_settlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.commission_settlements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.commission_settlements TO service_role;

CREATE OR REPLACE FUNCTION public.close_monthly_commissions(p_period text)
RETURNS SETOF public.commission_settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_period date;
  v_inserted integer := 0;
BEGIN
  IF v_clinic IS NULL OR v_role NOT IN ('owner','admin','financeiro') THEN
    RAISE EXCEPTION 'Perfil sem permissão para fechar repasses' USING ERRCODE = '42501';
  END IF;

  IF p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida. Use YYYY-MM' USING ERRCODE = '22023';
  END IF;
  v_period := (p_period || '-01')::date;

  INSERT INTO public.commission_settlements (
    clinic_id, professional_id, period, base_amount, percentage,
    commission_amount, status, created_by
  )
  SELECT
    v_clinic,
    a.fisio_id,
    v_period,
    sum(a.valor)::integer,
    40,
    round(sum(a.valor) * 0.40)::integer,
    'aberto',
    auth.uid()
  FROM public.appointments a
  WHERE a.clinic_id = v_clinic
    AND a.status = 'finalizado'
    AND a.data >= v_period
    AND a.data < (v_period + interval '1 month')::date
  GROUP BY a.fisio_id
  HAVING sum(a.valor) > 0
  ON CONFLICT (clinic_id, professional_id, period) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted > 0 THEN
    INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
    VALUES (v_clinic, auth.uid(), 'FECHAR_REPASSES',
      format('competencia=%s; repasses=%s', p_period, v_inserted));
  END IF;

  RETURN QUERY
  SELECT c.*
  FROM public.commission_settlements c
  WHERE c.clinic_id = v_clinic AND c.period = v_period
  ORDER BY c.created_at, c.professional_id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_monthly_commissions(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_monthly_commissions(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_commission_paid(p_commission_id uuid)
RETURNS public.commission_settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_result public.commission_settlements;
BEGIN
  IF v_clinic IS NULL OR v_role NOT IN ('owner','admin','financeiro') THEN
    RAISE EXCEPTION 'Perfil sem permissão para pagar repasses' USING ERRCODE = '42501';
  END IF;

  UPDATE public.commission_settlements
  SET status = 'pago', paid_at = coalesce(paid_at, now()),
      paid_by = coalesce(paid_by, auth.uid()), updated_at = now()
  WHERE id = p_commission_id AND clinic_id = v_clinic AND status = 'aberto'
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Repasse aberto não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (v_clinic, auth.uid(), 'PAGAR_REPASSE',
    format('repasse_id=%s; profissional_id=%s; competencia=%s',
      v_result.id, v_result.professional_id, to_char(v_result.period, 'YYYY-MM')));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_commission_paid(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_commission_paid(uuid) TO authenticated;

COMMIT;
