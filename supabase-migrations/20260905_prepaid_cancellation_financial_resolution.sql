-- MedicsPro — prepaid appointment cancellation financial resolution
-- Prevents a paid appointment from being silently cancelled without an explicit,
-- auditable financial disposition. The original paid payment remains immutable.

BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_payment_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  resolution_type text NOT NULL CHECK (resolution_type IN ('refund_due', 'credit_due', 'retained')),
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('pending', 'settled')),
  reason text NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  settled_at timestamptz,
  CONSTRAINT appointment_payment_resolutions_one_per_appointment UNIQUE (appointment_id),
  CONSTRAINT appointment_payment_resolutions_settlement_consistency CHECK (
    (status = 'pending' AND settled_at IS NULL)
    OR (status = 'settled' AND settled_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS appointment_payment_resolutions_clinic_status_idx
  ON public.appointment_payment_resolutions (clinic_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS appointment_payment_resolutions_payment_idx
  ON public.appointment_payment_resolutions (payment_id);

ALTER TABLE public.appointment_payment_resolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_payment_resolutions_read_financial
  ON public.appointment_payment_resolutions;
CREATE POLICY appointment_payment_resolutions_read_financial
ON public.appointment_payment_resolutions
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_clinic_entitlement_allowed('finance.access')
  AND public.current_app_role() IN ('owner', 'admin', 'recep', 'financeiro')
);

REVOKE ALL ON public.appointment_payment_resolutions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.appointment_payment_resolutions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.appointment_payment_resolutions TO service_role;

CREATE OR REPLACE FUNCTION public.get_appointment_cancellation_context(p_appointment_id uuid)
RETURNS TABLE (
  appointment_id uuid,
  has_paid_payment boolean,
  payment_id uuid,
  amount integer,
  resolution_exists boolean,
  resolution_type text,
  resolution_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_clinic_id uuid := public.current_clinic_id();
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'recep', 'fisio') OR v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Perfil sem permissão para consultar contexto de cancelamento'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_clinic_entitlement_allowed('finance.access') THEN
    RAISE EXCEPTION 'Módulo financeiro não liberado para esta clínica'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND a.clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'Atendimento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    p_appointment_id,
    (p.id IS NOT NULL),
    p.id,
    p.valor,
    (r.id IS NOT NULL),
    r.resolution_type,
    r.status
  FROM (SELECT 1) seed
  LEFT JOIN LATERAL (
    SELECT x.id, x.valor
    FROM public.payments x
    WHERE x.clinic_id = v_clinic_id
      AND x.appointment_id = p_appointment_id
      AND x.tipo = 'receber'
      AND x.status = 'pago'
    ORDER BY x.paid_at DESC NULLS LAST, x.updated_at DESC NULLS LAST
    LIMIT 1
  ) p ON true
  LEFT JOIN public.appointment_payment_resolutions r
    ON r.appointment_id = p_appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_appointment_cancellation_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_appointment_cancellation_context(uuid) TO authenticated;

-- Existing cancellation RPC remains compatible for unpaid appointments, but paid
-- appointments now fail closed until an explicit financial resolution is recorded.
CREATE OR REPLACE FUNCTION public.cancel_appointment_with_reason(
  p_appointment_id uuid,
  p_reason text
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app public.appointments;
  app_role text;
  v_paid_payment_id uuid;
BEGIN
  app_role := public.current_app_role();
  IF app_role NOT IN ('owner', 'admin', 'recep', 'fisio') THEN
    RAISE EXCEPTION 'Perfil sem permissão para cancelar atendimento' USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO app
  FROM public.appointments
  WHERE id = p_appointment_id
    AND clinic_id = public.current_clinic_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF app.status NOT IN ('agendado', 'confirmado') THEN
    RAISE EXCEPTION 'Somente atendimentos agendados ou confirmados podem ser cancelados' USING ERRCODE = '22023';
  END IF;

  SELECT p.id INTO v_paid_payment_id
  FROM public.payments p
  WHERE p.clinic_id = app.clinic_id
    AND p.appointment_id = app.id
    AND p.tipo = 'receber'
    AND p.status = 'pago'
  LIMIT 1;

  IF v_paid_payment_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.appointment_payment_resolutions r
       WHERE r.appointment_id = app.id
         AND r.payment_id = v_paid_payment_id
     ) THEN
    RAISE EXCEPTION 'Atendimento possui pagamento liquidado; registre a resolução financeira antes de cancelar'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelado',
      cancellation_reason = trim(p_reason),
      updated_at = now()
  WHERE id = p_appointment_id
  RETURNING * INTO app;

  RETURN app;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_appointment_with_reason(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_with_reason(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_prepaid_appointment_with_resolution(
  p_appointment_id uuid,
  p_reason text,
  p_resolution_type text,
  p_note text DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app public.appointments;
  app_role text := public.current_app_role();
  v_payment public.payments%ROWTYPE;
  v_status text;
BEGIN
  IF app_role NOT IN ('owner', 'admin', 'recep') THEN
    RAISE EXCEPTION 'A resolução financeira do cancelamento exige administração ou recepção'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_clinic_entitlement_allowed('finance.access') THEN
    RAISE EXCEPTION 'Módulo financeiro não liberado para esta clínica'
      USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento' USING ERRCODE = '22023';
  END IF;

  IF p_resolution_type NOT IN ('refund_due', 'credit_due', 'retained') THEN
    RAISE EXCEPTION 'Resolução financeira inválida' USING ERRCODE = '22023';
  END IF;

  IF p_resolution_type = 'retained' AND app_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Somente proprietário ou administrador pode registrar valor retido'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO app
  FROM public.appointments
  WHERE id = p_appointment_id
    AND clinic_id = public.current_clinic_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF app.status NOT IN ('agendado', 'confirmado') THEN
    RAISE EXCEPTION 'Somente atendimentos agendados ou confirmados podem ser cancelados' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.clinic_id = app.clinic_id
    AND p.appointment_id = app.id
    AND p.tipo = 'receber'
    AND p.status = 'pago'
  ORDER BY p.paid_at DESC NULLS LAST, p.updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não possui pagamento liquidado vinculado; use o cancelamento comum'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointment_payment_resolutions r
    WHERE r.appointment_id = app.id
  ) THEN
    RAISE EXCEPTION 'Atendimento já possui resolução financeira registrada'
      USING ERRCODE = '23505';
  END IF;

  v_status := CASE WHEN p_resolution_type = 'retained' THEN 'settled' ELSE 'pending' END;

  INSERT INTO public.appointment_payment_resolutions (
    clinic_id,
    appointment_id,
    payment_id,
    patient_id,
    resolution_type,
    amount,
    status,
    reason,
    note,
    created_by,
    settled_by,
    settled_at
  ) VALUES (
    app.clinic_id,
    app.id,
    v_payment.id,
    app.paciente_id,
    p_resolution_type,
    v_payment.valor,
    v_status,
    trim(p_reason),
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid(),
    CASE WHEN v_status = 'settled' THEN auth.uid() ELSE NULL END,
    CASE WHEN v_status = 'settled' THEN now() ELSE NULL END
  );

  UPDATE public.appointments
  SET status = 'cancelado',
      cancellation_reason = trim(p_reason),
      updated_at = now()
  WHERE id = app.id
  RETURNING * INTO app;

  RETURN app;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_prepaid_appointment_with_resolution(uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_prepaid_appointment_with_resolution(uuid, text, text, text)
  TO authenticated;

COMMIT;
