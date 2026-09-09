-- Reproduces the #388 pre-fix regression using the effective main reschedule RPC
-- plus the reservation-capacity guard introduced by the previous PR head.

CREATE OR REPLACE FUNCTION public.guard_appointment_package_reservation_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_package public.patient_packages%ROWTYPE;
  v_reserved integer := 0;
  v_old_reserved boolean := false;
  v_new_reserved boolean := false;
BEGIN
  v_new_reserved := NEW.pacote_id IS NOT NULL
    AND NEW.status IN ('agendado','confirmado','em_atendimento');

  IF NOT v_new_reserved THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_reserved := OLD.pacote_id IS NOT NULL
      AND OLD.status IN ('agendado','confirmado','em_atendimento');
    IF v_old_reserved AND OLD.pacote_id IS NOT DISTINCT FROM NEW.pacote_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT * INTO v_package
  FROM public.patient_packages
  WHERE id = NEW.pacote_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_package.clinic_id IS DISTINCT FROM NEW.clinic_id
     OR v_package.patient_id IS DISTINCT FROM NEW.paciente_id THEN
    RAISE EXCEPTION 'Pacote não elegível para este paciente e clínica'
      USING ERRCODE = '23514';
  END IF;

  IF v_package.sessoes_totais <= 0
     OR v_package.sessoes_usadas < 0
     OR v_package.sessoes_usadas > v_package.sessoes_totais THEN
    RAISE EXCEPTION 'Integridade financeira inválida no saldo do pacote'
      USING ERRCODE = '23514';
  END IF;

  IF v_package.status <> 'ativo'
     OR (v_package.validade_ate IS NOT NULL AND v_package.validade_ate < NEW.data)
     OR v_package.sessoes_usadas >= v_package.sessoes_totais THEN
    RAISE EXCEPTION 'Pacote sem cobertura disponível para reservar este atendimento'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer INTO v_reserved
  FROM public.appointments a
  WHERE a.pacote_id = NEW.pacote_id
    AND a.status IN ('agendado','confirmado','em_atendimento')
    AND a.id IS DISTINCT FROM NEW.id;

  IF v_package.sessoes_usadas + v_reserved >= v_package.sessoes_totais THEN
    RAISE EXCEPTION 'Pacote sem cobertura disponível para reservar este atendimento'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_appointment_package_reservation_capacity ON public.appointments;
CREATE TRIGGER trg_guard_appointment_package_reservation_capacity
BEFORE INSERT OR UPDATE OF pacote_id, status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_package_reservation_capacity();
REVOKE ALL ON FUNCTION public.guard_appointment_package_reservation_capacity()
  FROM PUBLIC, anon, authenticated;

INSERT INTO public.patient_packages(
  id, clinic_id, patient_id, package_id, sessoes_totais, sessoes_usadas,
  compra_data, validade_ate, valor_pago, status
) VALUES (
  '61000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  1, 0, current_date, current_date + 30, 10000, 'ativo'
);

INSERT INTO public.appointments(
  id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
  status, tipo, valor, pacote_id, notas
) VALUES (
  '45000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  current_date + 2, '08:00', '08:30', 'agendado', 'Remarcação 1/1', 10000,
  '61000000-0000-0000-0000-000000000006', 'source reservation'
);

\echo 'precondition: old insert-first reschedule fails on a fully reserved 1/1 package'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', false);
DO $$
DECLARE
  v_message text;
BEGIN
  BEGIN
    PERFORM public.reschedule_appointment(
      '45000000-0000-0000-0000-000000000001',
      current_date + 2, '09:00', '09:30',
      '10000000-0000-0000-0000-000000000001', NULL,
      'Ajuste de horário', false
    );
    RAISE EXCEPTION 'precondition_reschedule_unexpectedly_succeeded';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Pacote sem cobertura disponível para reservar este atendimento' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM public.appointments
      WHERE id = '45000000-0000-0000-0000-000000000001') <> 'agendado' THEN
    RAISE EXCEPTION 'precondition_source_not_preserved_after_failed_reschedule';
  END IF;
  IF (SELECT count(*) FROM public.appointments
      WHERE rescheduled_from_id = '45000000-0000-0000-0000-000000000001') <> 0 THEN
    RAISE EXCEPTION 'precondition_failed_reschedule_left_replacement';
  END IF;
  IF (SELECT count(*) FROM public.appointments
      WHERE pacote_id = '61000000-0000-0000-0000-000000000006'
        AND status IN ('agendado','confirmado','em_atendimento')) <> 1 THEN
    RAISE EXCEPTION 'precondition_source_reservation_not_preserved';
  END IF;
  IF (SELECT sessoes_usadas FROM public.patient_packages
      WHERE id = '61000000-0000-0000-0000-000000000006') <> 0 THEN
    RAISE EXCEPTION 'precondition_reschedule_changed_consumption';
  END IF;
END $$;
