\echo '1) 1/1 fully reserved package transfers its reservation through canonical reschedule'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', false);
DO $$
DECLARE
  v_new public.appointments;
BEGIN
  SELECT * INTO v_new
  FROM public.reschedule_appointment(
    '45000000-0000-0000-0000-000000000001',
    current_date + 2, '09:00', '09:30',
    '10000000-0000-0000-0000-000000000001', NULL,
    'Ajuste de horário', false
  );

  IF v_new.id IS NULL
     OR v_new.status <> 'agendado'
     OR v_new.pacote_id IS DISTINCT FROM '61000000-0000-0000-0000-000000000006'::uuid
     OR v_new.rescheduled_from_id IS DISTINCT FROM '45000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'reschedule_replacement_contract_invalid';
  END IF;
END $$;
RESET ROLE;

DO $$
DECLARE
  v_source_status text;
  v_source_reason text;
  v_active_reservations integer;
  v_used integer;
  v_usage integer;
  v_exception integer;
  v_replacements integer;
BEGIN
  SELECT status, cancellation_reason
  INTO v_source_status, v_source_reason
  FROM public.appointments
  WHERE id = '45000000-0000-0000-0000-000000000001';

  SELECT count(*) INTO v_active_reservations
  FROM public.appointments
  WHERE pacote_id = '61000000-0000-0000-0000-000000000006'
    AND status IN ('agendado','confirmado','em_atendimento');

  SELECT sessoes_usadas INTO v_used
  FROM public.patient_packages
  WHERE id = '61000000-0000-0000-0000-000000000006';

  SELECT count(*) INTO v_usage
  FROM public.package_session_usage
  WHERE patient_package_id = '61000000-0000-0000-0000-000000000006';

  SELECT count(*) INTO v_exception
  FROM public.appointment_financial_exceptions e
  JOIN public.appointments a ON a.id = e.appointment_id
  WHERE a.pacote_id = '61000000-0000-0000-0000-000000000006';

  SELECT count(*) INTO v_replacements
  FROM public.appointments
  WHERE rescheduled_from_id = '45000000-0000-0000-0000-000000000001'
    AND status = 'agendado'
    AND pacote_id = '61000000-0000-0000-0000-000000000006';

  IF v_source_status <> 'cancelado'
     OR nullif(trim(coalesce(v_source_reason, '')), '') IS NULL
     OR v_active_reservations <> 1
     OR v_replacements <> 1
     OR v_used <> 0
     OR v_usage <> 0
     OR v_exception <> 0 THEN
    RAISE EXCEPTION 'reschedule_1_of_1_contract_failed';
  END IF;
END $$;

\echo '2) arbitrary rescheduled_from_id cannot bypass package reservation capacity'
DO $$
DECLARE
  v_message text;
BEGIN
  BEGIN
    INSERT INTO public.appointments(
      id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
      status, tipo, valor, pacote_id, rescheduled_from_id
    ) VALUES (
      '45000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      current_date + 2, '10:00', '10:30', 'agendado', 'Bypass inválido', 10000,
      '61000000-0000-0000-0000-000000000006',
      '45000000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'arbitrary_rescheduled_from_bypassed_capacity';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Pacote sem cobertura disponível para reservar este atendimento' THEN
      RAISE;
    END IF;
  END;
END $$;

\echo '3) replacement conflict rolls source cancellation back and preserves reservation'
INSERT INTO public.patient_packages(
  id, clinic_id, patient_id, package_id, sessoes_totais, sessoes_usadas,
  compra_data, validade_ate, valor_pago, status
) VALUES (
  '61000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  1, 0, current_date, current_date + 30, 10000, 'ativo'
);

INSERT INTO public.appointments(
  id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
  status, tipo, valor, pacote_id, notas
) VALUES
  (
    '45000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    current_date + 4, '08:00', '08:30', 'agendado', 'Origem rollback', 10000,
    '61000000-0000-0000-0000-000000000007', 'must survive failed reschedule'
  ),
  (
    '45000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    current_date + 4, '09:00', '09:30', 'agendado', 'Conflito alvo', 10000,
    NULL, 'occupies target slot'
  );

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', false);
DO $$
DECLARE
  v_message text;
BEGIN
  BEGIN
    PERFORM public.reschedule_appointment(
      '45000000-0000-0000-0000-000000000003',
      current_date + 4, '09:00', '09:30',
      '10000000-0000-0000-0000-000000000001', NULL,
      'Tentativa conflitante', false
    );
    RAISE EXCEPTION 'conflicting_reschedule_unexpectedly_succeeded';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message NOT LIKE '[AGENDA_CONFLICT_%' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM public.appointments
      WHERE id = '45000000-0000-0000-0000-000000000003') <> 'agendado' THEN
    RAISE EXCEPTION 'failed_reschedule_cancelled_source';
  END IF;
  IF (SELECT count(*) FROM public.appointments
      WHERE pacote_id = '61000000-0000-0000-0000-000000000007'
        AND status IN ('agendado','confirmado','em_atendimento')) <> 1 THEN
    RAISE EXCEPTION 'failed_reschedule_lost_source_reservation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE rescheduled_from_id = '45000000-0000-0000-0000-000000000003'
  ) THEN
    RAISE EXCEPTION 'failed_reschedule_left_replacement';
  END IF;
  IF (SELECT sessoes_usadas FROM public.patient_packages
      WHERE id = '61000000-0000-0000-0000-000000000007') <> 0
     OR EXISTS (SELECT 1 FROM public.package_session_usage
                WHERE patient_package_id = '61000000-0000-0000-0000-000000000007')
     OR EXISTS (
       SELECT 1 FROM public.appointment_financial_exceptions e
       JOIN public.appointments a ON a.id = e.appointment_id
       WHERE a.pacote_id = '61000000-0000-0000-0000-000000000007'
     ) THEN
    RAISE EXCEPTION 'failed_reschedule_changed_financial_materialization';
  END IF;
END $$;

\echo '4) finance exception cannot be generically marked resolved by service role'
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$
BEGIN
  BEGIN
    UPDATE public.appointment_financial_exceptions
    SET status = 'resolved', resolved_at = now(), resolution_note = 'not a materialized disposition'
    WHERE appointment_id = '41000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'service_role_generic_resolution_update_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM public.appointment_financial_exceptions
      WHERE appointment_id = '41000000-0000-0000-0000-000000000002') <> 'pending' THEN
    RAISE EXCEPTION 'financial_exception_was_marked_resolved_without_disposition';
  END IF;
END $$;
