-- MEDICSPRO — Financial Exception Resolution
-- Resolves #388 coverage exceptions through one transactional, auditable boundary.
-- This migration does not alter package counters, package usage, appointment source
-- locks, clinical authorization, or the cancellation-specific resolution domain.

BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_financial_exception_dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id uuid NOT NULL REFERENCES public.appointment_financial_exceptions(id) ON DELETE RESTRICT,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  disposition text NOT NULL CHECK (disposition IN ('charge', 'waived')),
  amount integer NOT NULL CHECK (amount > 0),
  actor_id uuid NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('owner', 'admin', 'financeiro')),
  reason text,
  payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_financial_exception_dispositions_one_per_exception UNIQUE (exception_id),
  CONSTRAINT appointment_financial_exception_dispositions_one_per_appointment UNIQUE (appointment_id),
  CONSTRAINT appointment_financial_exception_dispositions_payment_unique UNIQUE (payment_id),
  CONSTRAINT appointment_financial_exception_dispositions_shape CHECK (
    (disposition = 'charge' AND payment_id IS NOT NULL)
    OR (
      disposition = 'waived'
      AND payment_id IS NULL
      AND nullif(trim(reason), '') IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS appointment_financial_exception_dispositions_clinic_created_idx
  ON public.appointment_financial_exception_dispositions (clinic_id, created_at DESC);

ALTER TABLE public.appointment_financial_exception_dispositions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_financial_exception_dispositions_read_financial
  ON public.appointment_financial_exception_dispositions;
CREATE POLICY appointment_financial_exception_dispositions_read_financial
ON public.appointment_financial_exception_dispositions
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'financeiro')
  AND public.current_clinic_entitlement_allowed('finance.access')
);

REVOKE ALL ON public.appointment_financial_exception_dispositions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.appointment_financial_exception_dispositions
  TO authenticated, service_role;

-- #388 allows service_role to materialize detection events but keeps the queue
-- read-only for browser actors. Preserve that exact boundary here.
REVOKE INSERT, UPDATE, DELETE ON public.appointment_financial_exceptions
  FROM authenticated;
REVOKE UPDATE, DELETE ON public.appointment_financial_exceptions
  FROM service_role;
GRANT INSERT, SELECT ON public.appointment_financial_exceptions
  TO service_role;

CREATE OR REPLACE FUNCTION public.guard_financial_exception_disposition_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Disposição financeira é imutável; registre um novo evento financeiro para qualquer correção futura'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_financial_exception_disposition_immutability
  ON public.appointment_financial_exception_dispositions;
CREATE TRIGGER trg_guard_financial_exception_disposition_immutability
BEFORE UPDATE OR DELETE ON public.appointment_financial_exception_dispositions
FOR EACH ROW EXECUTE FUNCTION public.guard_financial_exception_disposition_immutability();

REVOKE ALL ON FUNCTION public.guard_financial_exception_disposition_immutability()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.appointment_financial_exception_dispositions IS
  'Append-only ledger for canonical resolution of #388 uncovered finalized appointments. Exactly one immutable full-value CHARGE or WAIVE disposition exists per exception/appointment.';

COMMENT ON COLUMN public.appointment_financial_exception_dispositions.actor_id IS
  'Actor UUID snapshot intentionally retained without a destructive FK so identity offboarding cannot erase financial audit history.';

CREATE OR REPLACE FUNCTION public.list_pending_appointment_financial_exceptions()
RETURNS TABLE (
  exception_id uuid,
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  appointment_date date,
  appointment_start time without time zone,
  reason_code text,
  amount integer,
  source_package_id uuid,
  package_name text,
  detected_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_actor
  FROM public.profiles
  WHERE id = auth.uid()
    AND ativo = true;

  IF v_actor.id IS NULL
     OR v_actor.role::text NOT IN ('owner', 'admin', 'financeiro') THEN
    RAISE EXCEPTION 'Perfil sem permissão para consultar pendências de cobertura'
      USING ERRCODE = '42501';
  END IF;

  IF public.current_clinic_entitlement_allowed('finance.access') IS NOT TRUE THEN
    RAISE EXCEPTION 'Módulo financeiro não liberado para esta clínica'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.appointment_id,
    e.patient_id,
    p.nome,
    a.data,
    a.inicio,
    e.reason_code,
    a.valor,
    e.source_package_id,
    sp.nome,
    e.detected_at
  FROM public.appointment_financial_exceptions e
  JOIN public.appointments a
    ON a.id = e.appointment_id
   AND a.clinic_id = e.clinic_id
   AND a.paciente_id = e.patient_id
  JOIN public.patients p
    ON p.id = e.patient_id
   AND p.clinic_id = e.clinic_id
  LEFT JOIN public.patient_packages pp
    ON pp.id = e.source_package_id
   AND pp.clinic_id = e.clinic_id
   AND pp.patient_id = e.patient_id
  LEFT JOIN public.session_packages sp
    ON sp.id = pp.package_id
   AND sp.clinic_id = pp.clinic_id
  WHERE e.clinic_id = v_actor.clinic_id
    AND e.status = 'pending'
  ORDER BY e.detected_at ASC, e.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_pending_appointment_financial_exceptions()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_pending_appointment_financial_exceptions()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_appointment_financial_exception(
  p_exception_id uuid,
  p_disposition text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  exception_id uuid,
  appointment_id uuid,
  disposition text,
  amount integer,
  payment_id uuid,
  resolved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_exception public.appointment_financial_exceptions%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_existing_disposition public.appointment_financial_exception_dispositions%ROWTYPE;
  v_existing_payment public.payments%ROWTYPE;
  v_disposition text := lower(trim(coalesce(p_disposition, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_payment_id uuid;
  v_resolved_at timestamptz;
BEGIN
  SELECT * INTO v_actor
  FROM public.profiles
  WHERE id = auth.uid()
    AND ativo = true;

  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'Perfil ativo necessário para resolver pendência financeira'
      USING ERRCODE = '42501';
  END IF;

  IF public.current_clinic_entitlement_allowed('finance.access') IS NOT TRUE THEN
    RAISE EXCEPTION 'Módulo financeiro não liberado para esta clínica'
      USING ERRCODE = '42501';
  END IF;

  IF v_disposition NOT IN ('charge', 'waived') THEN
    RAISE EXCEPTION 'Disposição financeira inválida'
      USING ERRCODE = '22023';
  END IF;

  IF v_disposition = 'charge'
     AND v_actor.role::text NOT IN ('owner', 'admin', 'financeiro') THEN
    RAISE EXCEPTION 'Perfil sem permissão para gerar cobrança desta pendência'
      USING ERRCODE = '42501';
  END IF;

  IF v_disposition = 'waived'
     AND v_actor.role::text NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Perfil sem permissão para conceder cortesia desta pendência'
      USING ERRCODE = '42501';
  END IF;

  IF v_disposition = 'waived' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da cortesia'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_exception
  FROM public.appointment_financial_exceptions
  WHERE id = p_exception_id
    AND clinic_id = v_actor.clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pendência financeira não encontrada'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_existing_disposition
  FROM public.appointment_financial_exception_dispositions d
  WHERE d.exception_id = v_exception.id;

  IF v_exception.status = 'resolved' THEN
    IF v_existing_disposition.id IS NULL THEN
      RAISE EXCEPTION 'Integridade financeira inválida: pendência resolvida sem disposição'
        USING ERRCODE = '23514';
    END IF;

    IF v_existing_disposition.disposition IS DISTINCT FROM v_disposition THEN
      RAISE EXCEPTION 'Pendência financeira já possui disposição imutável'
        USING ERRCODE = '23514';
    END IF;

    IF v_existing_disposition.disposition = 'waived'
       AND v_existing_disposition.reason IS DISTINCT FROM v_reason THEN
      RAISE EXCEPTION 'Pendência financeira já possui cortesia com motivo imutável'
        USING ERRCODE = '23514';
    END IF;

    IF v_existing_disposition.disposition = 'charge' THEN
      IF v_existing_disposition.payment_id IS NULL THEN
        RAISE EXCEPTION 'Integridade financeira inválida: cobrança sem recebível'
          USING ERRCODE = '23514';
      END IF;

      SELECT * INTO v_existing_payment
      FROM public.payments p
      WHERE p.id = v_existing_disposition.payment_id;

      IF v_existing_payment.id IS NULL
         OR v_existing_payment.clinic_id IS DISTINCT FROM v_existing_disposition.clinic_id
         OR v_existing_payment.appointment_id IS DISTINCT FROM v_existing_disposition.appointment_id
         OR v_existing_payment.tipo IS DISTINCT FROM 'receber'
         OR v_existing_payment.valor IS DISTINCT FROM v_existing_disposition.amount THEN
        RAISE EXCEPTION 'Integridade financeira inválida: recebível da disposição divergente'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    RETURN QUERY
    SELECT
      v_existing_disposition.exception_id,
      v_existing_disposition.appointment_id,
      v_existing_disposition.disposition,
      v_existing_disposition.amount,
      v_existing_disposition.payment_id,
      v_exception.resolved_at;
    RETURN;
  END IF;

  IF v_exception.status <> 'pending' THEN
    RAISE EXCEPTION 'Estado de pendência financeira inválido'
      USING ERRCODE = '23514';
  END IF;

  IF v_existing_disposition.id IS NOT NULL THEN
    RAISE EXCEPTION 'Integridade financeira inválida: disposição materializada para pendência aberta'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_appointment
  FROM public.appointments a
  WHERE a.id = v_exception.appointment_id
    AND a.clinic_id = v_exception.clinic_id
    AND a.paciente_id = v_exception.patient_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integridade financeira inválida: atendimento da pendência divergente'
      USING ERRCODE = '23514';
  END IF;

  IF v_appointment.status <> 'finalizado' THEN
    RAISE EXCEPTION 'Somente atendimento finalizado pode ter pendência de cobertura resolvida'
      USING ERRCODE = '23514';
  END IF;

  IF v_appointment.pacote_id IS DISTINCT FROM v_exception.source_package_id THEN
    RAISE EXCEPTION 'Integridade financeira inválida: origem financeira do atendimento divergente'
      USING ERRCODE = '23514';
  END IF;

  IF v_appointment.valor <= 0 THEN
    RAISE EXCEPTION 'Integridade financeira inválida: atendimento sem valor positivo'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.package_session_usage u
    WHERE u.appointment_id = v_appointment.id
  ) THEN
    RAISE EXCEPTION 'Atendimento possui consumo de pacote e não pode ser tratado como sem cobertura'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_existing_payment
  FROM public.payments p
  WHERE p.clinic_id = v_appointment.clinic_id
    AND p.appointment_id = v_appointment.id
    AND p.tipo = 'receber'
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'Atendimento já possui recebível; reconciliação financeira explícita necessária'
      USING ERRCODE = '23514';
  END IF;

  IF v_disposition = 'charge' THEN
    INSERT INTO public.payments (
      clinic_id,
      patient_id,
      appointment_id,
      tipo,
      descricao,
      categoria,
      valor,
      vencimento,
      status,
      metodo
    ) VALUES (
      v_appointment.clinic_id,
      v_appointment.paciente_id,
      v_appointment.id,
      'receber',
      'Atendimento sem cobertura de pacote',
      'Atendimento sem cobertura',
      v_appointment.valor,
      v_appointment.data,
      'pendente',
      NULL
    )
    RETURNING id INTO v_payment_id;
  ELSE
    v_payment_id := NULL;
  END IF;

  INSERT INTO public.appointment_financial_exception_dispositions (
    exception_id,
    clinic_id,
    appointment_id,
    disposition,
    amount,
    actor_id,
    actor_role,
    reason,
    payment_id
  ) VALUES (
    v_exception.id,
    v_exception.clinic_id,
    v_exception.appointment_id,
    v_disposition,
    v_appointment.valor,
    v_actor.id,
    v_actor.role::text,
    CASE WHEN v_disposition = 'waived' THEN v_reason ELSE NULL END,
    v_payment_id
  )
  RETURNING created_at INTO v_resolved_at;

  UPDATE public.appointment_financial_exceptions
  SET status = 'resolved',
      resolved_at = v_resolved_at,
      resolved_by = v_actor.id,
      resolution_note = CASE
        WHEN v_disposition = 'waived' THEN v_reason
        ELSE 'Cobrança integral gerada'
      END
  WHERE id = v_exception.id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integridade financeira concorrente ao concluir resolução'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY
  SELECT
    v_exception.id,
    v_exception.appointment_id,
    v_disposition,
    v_appointment.valor,
    v_payment_id,
    v_resolved_at;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_appointment_financial_exception(uuid, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_appointment_financial_exception(uuid, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.resolve_appointment_financial_exception(uuid, text, text) IS
  'Canonical transactional CHARGE/WAIVE resolution for #388 coverage exceptions. Server authorization is active profile + same tenant + finance.access + role-specific disposition.';

COMMIT;
