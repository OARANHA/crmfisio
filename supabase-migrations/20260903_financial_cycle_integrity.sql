-- MEDICSPRO — Financial cycle integrity
-- Finalized care -> package consumption or receivable -> settlement/overdue -> audit.

BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_appointment_receivable_uidx
  ON public.payments (clinic_id, appointment_id)
  WHERE tipo = 'receber' AND appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_open_due_idx
  ON public.payments (clinic_id, vencimento)
  WHERE status IN ('pendente', 'atrasado');

CREATE TABLE IF NOT EXISTS public.payment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  method text,
  amount integer NOT NULL
);

CREATE INDEX IF NOT EXISTS payment_status_history_payment_idx
  ON public.payment_status_history (payment_id, changed_at DESC);

ALTER TABLE public.payment_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_status_history_select_financial ON public.payment_status_history;
CREATE POLICY payment_status_history_select_financial
ON public.payment_status_history FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','recep','financeiro')
);
REVOKE ALL ON public.payment_status_history FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.payment_status_history FROM service_role;
GRANT SELECT ON public.payment_status_history TO authenticated, service_role;

-- Replace the broad ALL policy: browser clients may not delete financial records.
DROP POLICY IF EXISTS payments_write_financial ON public.payments;
DROP POLICY IF EXISTS payments_insert_financial ON public.payments;
CREATE POLICY payments_insert_financial
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner','admin','financeiro')
    OR (public.current_app_role() = 'recep' AND tipo = 'receber')
  )
);
DROP POLICY IF EXISTS payments_update_financial ON public.payments;
CREATE POLICY payments_update_financial
ON public.payments FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner','admin','financeiro')
    OR (public.current_app_role() = 'recep' AND tipo = 'receber')
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND (
    public.current_app_role() IN ('owner','admin','financeiro')
    OR (public.current_app_role() = 'recep' AND tipo = 'receber')
  )
);
REVOKE DELETE ON public.payments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_payment_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.current_app_role();
BEGIN
  IF NEW.valor <= 0 THEN RAISE EXCEPTION 'Valor financeiro deve ser positivo'; END IF;
  IF NEW.status = 'pago' AND NEW.metodo IS NULL THEN
    RAISE EXCEPTION 'Método é obrigatório para liquidar um lançamento';
  END IF;
  IF NEW.appointment_id IS NOT NULL AND (
    NEW.tipo <> 'receber'
    OR NEW.patient_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = NEW.appointment_id
        AND a.clinic_id = NEW.clinic_id
        AND a.paciente_id = NEW.patient_id
    )
  ) THEN
    RAISE EXCEPTION 'Atendimento incompatível com o lançamento financeiro';
  END IF;

  -- Internal service operations have no clinic profile and remain allowed.
  IF TG_OP = 'UPDATE' AND v_role IS NOT NULL THEN
    IF OLD.status = 'pago' AND (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.valor IS DISTINCT FROM OLD.valor
      OR NEW.tipo IS DISTINCT FROM OLD.tipo
      OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
      OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
    ) THEN
      RAISE EXCEPTION 'Lançamento liquidado é imutável; registre uma correção auditável'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payment_integrity ON public.payments;
CREATE TRIGGER trg_guard_payment_integrity
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_integrity();
REVOKE ALL ON FUNCTION public.guard_payment_integrity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_payment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_status_history (
      clinic_id, payment_id, from_status, to_status, changed_by, method, amount
    ) VALUES (
      NEW.clinic_id, NEW.id, NULL, NEW.status, auth.uid(), NEW.metodo, NEW.valor
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.payment_status_history (
      clinic_id, payment_id, from_status, to_status, changed_by, method, amount
    ) VALUES (
      NEW.clinic_id, NEW.id, OLD.status, NEW.status, auth.uid(), NEW.metodo, NEW.valor
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_payment_status_change ON public.payments;
CREATE TRIGGER trg_audit_payment_status_change
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.audit_payment_status_change();
REVOKE ALL ON FUNCTION public.audit_payment_status_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_finalized_appointment_receivable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finalizado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.valor > 0
     AND NEW.pacote_id IS NULL THEN
    INSERT INTO public.payments (
      clinic_id, patient_id, appointment_id, tipo, descricao, categoria,
      valor, vencimento, status, metodo
    ) VALUES (
      NEW.clinic_id, NEW.paciente_id, NEW.id, 'receber',
      'Atendimento: ' || NEW.tipo, 'Atendimento avulso',
      NEW.valor, NEW.data, 'pendente', NULL
    ) ON CONFLICT (clinic_id, appointment_id)
      WHERE tipo = 'receber' AND appointment_id IS NOT NULL
      DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_finalized_appointment_receivable ON public.appointments;
CREATE TRIGGER trg_create_finalized_appointment_receivable
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.create_finalized_appointment_receivable();
REVOKE ALL ON FUNCTION public.create_finalized_appointment_receivable() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_overdue_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.payments
  SET status = 'atrasado', updated_at = now()
  WHERE status = 'pendente' AND vencimento < current_date;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_overdue_payments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_payments() TO service_role;

-- Only the assigned care professional can start/finalize clinical care.
CREATE OR REPLACE FUNCTION public.guard_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_role text := public.current_app_role();
  allowed boolean := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF app_role IS NULL THEN RETURN NEW; END IF;

  IF app_role IN ('owner','admin','recep') THEN
    allowed :=
      (OLD.status = 'agendado' AND NEW.status IN ('confirmado','faltou','cancelado'))
      OR (OLD.status = 'confirmado' AND NEW.status IN ('faltou','cancelado'));
  ELSIF app_role = 'fisio' AND NEW.fisio_id = auth.uid() THEN
    allowed :=
      (OLD.status = 'agendado' AND NEW.status IN ('confirmado','em_atendimento','faltou','cancelado'))
      OR (OLD.status = 'confirmado' AND NEW.status IN ('em_atendimento','faltou','cancelado'))
      OR (OLD.status = 'em_atendimento' AND NEW.status = 'finalizado');
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Transição de status não permitida para o perfil atual: % -> %', OLD.status, NEW.status
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_appointment_status_transition() FROM PUBLIC, anon, authenticated;

-- Serialize package consumption and reject expired/exhausted or foreign packages.
CREATE OR REPLACE FUNCTION public.sync_appointment_package_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_package uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.pacote_id ELSE NULL END;
  v_new_package uuid := NEW.pacote_id;
  v_usage_id uuid;
  v_package public.patient_packages%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'finalizado'
     AND NEW.status = 'finalizado'
     AND OLD.pacote_id IS NOT DISTINCT FROM NEW.pacote_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'finalizado'
     AND (NEW.status <> 'finalizado' OR OLD.pacote_id IS DISTINCT FROM NEW.pacote_id)
     AND v_old_package IS NOT NULL THEN
    PERFORM 1 FROM public.patient_packages WHERE id = v_old_package FOR UPDATE;
    DELETE FROM public.package_session_usage
    WHERE appointment_id = OLD.id AND patient_package_id = v_old_package
    RETURNING id INTO v_usage_id;
    IF v_usage_id IS NOT NULL THEN
      UPDATE public.patient_packages
      SET sessoes_usadas = greatest(0, sessoes_usadas - 1), updated_at = now()
      WHERE id = v_old_package;
      PERFORM public.refresh_patient_package_status(v_old_package);
    END IF;
  END IF;

  IF NEW.status = 'finalizado' AND v_new_package IS NOT NULL THEN
    SELECT * INTO v_package
    FROM public.patient_packages
    WHERE id = v_new_package
      AND clinic_id = NEW.clinic_id
      AND patient_id = NEW.paciente_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Pacote do paciente inválido'; END IF;
    IF v_package.status <> 'ativo'
       OR (v_package.validade_ate IS NOT NULL AND v_package.validade_ate < NEW.data)
       OR v_package.sessoes_usadas >= v_package.sessoes_totais THEN
      RAISE EXCEPTION 'Pacote sem saldo ou fora da validade';
    END IF;

    v_usage_id := NULL;
    INSERT INTO public.package_session_usage (clinic_id, patient_package_id, appointment_id)
    VALUES (NEW.clinic_id, v_new_package, NEW.id)
    ON CONFLICT (appointment_id) DO NOTHING
    RETURNING id INTO v_usage_id;

    IF v_usage_id IS NOT NULL THEN
      UPDATE public.patient_packages
      SET sessoes_usadas = sessoes_usadas + 1, updated_at = now()
      WHERE id = v_new_package;
      PERFORM public.refresh_patient_package_status(v_new_package);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_appointment_package_usage() FROM PUBLIC, anon, authenticated;

COMMIT;
