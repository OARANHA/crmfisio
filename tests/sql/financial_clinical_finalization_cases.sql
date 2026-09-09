\echo '1) exhausted legacy-linked package no longer blocks clinically valid finalization'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

UPDATE public.appointments
SET status = 'finalizado'
WHERE id = '41000000-0000-0000-0000-000000000002';

DO $$
DECLARE
  v_status text;
  v_used integer;
  v_total integer;
  v_usage_a integer;
  v_usage_b integer;
  v_pending_b integer;
  v_reason text;
BEGIN
  SELECT status INTO v_status FROM public.appointments
  WHERE id = '41000000-0000-0000-0000-000000000002';
  SELECT sessoes_usadas, sessoes_totais INTO v_used, v_total
  FROM public.patient_packages
  WHERE id = '61000000-0000-0000-0000-000000000001';
  SELECT count(*) INTO v_usage_a FROM public.package_session_usage
  WHERE appointment_id = '41000000-0000-0000-0000-000000000001';
  SELECT count(*) INTO v_usage_b FROM public.package_session_usage
  WHERE appointment_id = '41000000-0000-0000-0000-000000000002';
  SELECT count(*), max(reason_code) INTO v_pending_b, v_reason
  FROM public.appointment_financial_exceptions
  WHERE appointment_id = '41000000-0000-0000-0000-000000000002';

  IF v_status <> 'finalizado'
     OR v_used <> 1 OR v_total <> 1
     OR v_usage_a <> 1 OR v_usage_b <> 0
     OR v_pending_b <> 1 OR v_reason <> 'package_exhausted' THEN
    RAISE EXCEPTION 'exhausted_package_finalization_contract_failed';
  END IF;
END $$;

\echo '2) repeated final status processing is idempotent and does not duplicate pending'
UPDATE public.appointments
SET status = 'finalizado'
WHERE id = '41000000-0000-0000-0000-000000000002';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.appointment_financial_exceptions
      WHERE appointment_id = '41000000-0000-0000-0000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'financial_exception_not_idempotent';
  END IF;
  IF (SELECT count(*) FROM public.package_session_usage
      WHERE appointment_id = '41000000-0000-0000-0000-000000000002') <> 0 THEN
    RAISE EXCEPTION 'idempotent_retry_invented_package_usage';
  END IF;
END $$;

\echo '3) valid package still consumes exactly one session'
UPDATE public.appointments
SET status = 'finalizado'
WHERE id = '41000000-0000-0000-0000-000000000003';

DO $$
DECLARE v_used integer; v_usage integer; v_pending integer;
BEGIN
  SELECT sessoes_usadas INTO v_used FROM public.patient_packages
  WHERE id = '61000000-0000-0000-0000-000000000002';
  SELECT count(*) INTO v_usage FROM public.package_session_usage
  WHERE appointment_id = '41000000-0000-0000-0000-000000000003';
  SELECT count(*) INTO v_pending FROM public.appointment_financial_exceptions
  WHERE appointment_id = '41000000-0000-0000-0000-000000000003';
  IF v_used <> 1 OR v_usage <> 1 OR v_pending <> 0 THEN
    RAISE EXCEPTION 'valid_package_consumption_regressed';
  END IF;
END $$;

\echo '4) appointment without package still materializes one standalone receivable'
UPDATE public.appointments
SET status = 'finalizado'
WHERE id = '41000000-0000-0000-0000-000000000004';

DO $$
DECLARE v_count integer; v_amount integer; v_category text;
BEGIN
  SELECT count(*), max(valor), max(categoria)
    INTO v_count, v_amount, v_category
  FROM public.payments
  WHERE appointment_id = '41000000-0000-0000-0000-000000000004'
    AND tipo = 'receber';
  IF v_count <> 1 OR v_amount <> 15000 OR v_category <> 'Atendimento avulso' THEN
    RAISE EXCEPTION 'standalone_receivable_regressed';
  END IF;
END $$;

\echo '5) expired package creates pending exception without blocking clinical truth'
UPDATE public.appointments
SET status = 'finalizado'
WHERE id = '41000000-0000-0000-0000-000000000005';

DO $$
DECLARE v_status text; v_reason text; v_usage integer;
BEGIN
  SELECT status INTO v_status FROM public.appointments
  WHERE id = '41000000-0000-0000-0000-000000000005';
  SELECT reason_code INTO v_reason FROM public.appointment_financial_exceptions
  WHERE appointment_id = '41000000-0000-0000-0000-000000000005';
  SELECT count(*) INTO v_usage FROM public.package_session_usage
  WHERE appointment_id = '41000000-0000-0000-0000-000000000005';
  IF v_status <> 'finalizado' OR v_reason <> 'package_expired' OR v_usage <> 0 THEN
    RAISE EXCEPTION 'expired_package_boundary_failed';
  END IF;
END $$;

\echo '6) foreign patient/tenant package never becomes legitimate consumption'
UPDATE public.appointments
SET status = 'finalizado'
WHERE id = '41000000-0000-0000-0000-000000000006';

DO $$
DECLARE v_status text; v_reason text; v_usage integer; v_foreign_used integer;
BEGIN
  SELECT status INTO v_status FROM public.appointments
  WHERE id = '41000000-0000-0000-0000-000000000006';
  SELECT reason_code INTO v_reason FROM public.appointment_financial_exceptions
  WHERE appointment_id = '41000000-0000-0000-0000-000000000006';
  SELECT count(*) INTO v_usage FROM public.package_session_usage
  WHERE appointment_id = '41000000-0000-0000-0000-000000000006';
  SELECT sessoes_usadas INTO v_foreign_used FROM public.patient_packages
  WHERE id = '62000000-0000-0000-0000-000000000001';
  IF v_status <> 'finalizado' OR v_reason <> 'package_not_eligible'
     OR v_usage <> 0 OR v_foreign_used <> 0 THEN
    RAISE EXCEPTION 'foreign_package_was_treated_as_coverage';
  END IF;
END $$;

\echo '7) valid consumption reversal returns exactly one session'
UPDATE public.appointments
SET status = 'finalizado'
WHERE id = '41000000-0000-0000-0000-000000000007';

DO $$
BEGIN
  IF (SELECT sessoes_usadas FROM public.patient_packages
      WHERE id = '61000000-0000-0000-0000-000000000005') <> 1
     OR (SELECT count(*) FROM public.package_session_usage
         WHERE appointment_id = '41000000-0000-0000-0000-000000000007') <> 1 THEN
    RAISE EXCEPTION 'reversal_precondition_consumption_missing';
  END IF;
END $$;

RESET ROLE;
UPDATE public.appointments
SET status = 'cancelado'
WHERE id = '41000000-0000-0000-0000-000000000007';

DO $$
BEGIN
  IF (SELECT sessoes_usadas FROM public.patient_packages
      WHERE id = '61000000-0000-0000-0000-000000000005') <> 0
     OR (SELECT status FROM public.patient_packages
         WHERE id = '61000000-0000-0000-0000-000000000005') <> 'ativo'
     OR (SELECT count(*) FROM public.package_session_usage
         WHERE appointment_id = '41000000-0000-0000-0000-000000000007') <> 0 THEN
    RAISE EXCEPTION 'legitimate_consumption_reversal_regressed';
  END IF;
END $$;

\echo '8) server-side reservation rejects a second uncovered appointment even if UI is stale'
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
  status, tipo, valor, pacote_id
) VALUES (
  '43000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  current_date, '16:00', '16:30', 'agendado', 'Reserva válida', 10000,
  '61000000-0000-0000-0000-000000000005'
);

DO $$
DECLARE v_message text;
BEGIN
  BEGIN
    INSERT INTO public.appointments(
      id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
      status, tipo, valor, pacote_id
    ) VALUES (
      '43000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      current_date, '17:00', '17:30', 'agendado', 'Reserva excedente', 10000,
      '61000000-0000-0000-0000-000000000005'
    );
    RAISE EXCEPTION 'second_uncovered_reservation_was_allowed';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message NOT LIKE 'Pacote sem cobertura disponível%' THEN RAISE; END IF;
  END;
END $$;

\echo '9) new cross-tenant package assignment is rejected at scheduling boundary'
DO $$
BEGIN
  BEGIN
    INSERT INTO public.appointments(
      id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
      status, tipo, valor, pacote_id
    ) VALUES (
      '43000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      current_date, '18:00', '18:30', 'agendado', 'Pacote estrangeiro novo', 10000,
      '62000000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'cross_tenant_package_reservation_was_allowed';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

\echo '10) unexpected package integrity corruption still fails closed'
UPDATE public.patient_packages
SET sessoes_usadas = 2, status = 'esgotado'
WHERE id = '61000000-0000-0000-0000-000000000005';

UPDATE public.appointments
SET status = 'em_atendimento'
WHERE id = '41000000-0000-0000-0000-000000000007';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE v_message text;
BEGIN
  BEGIN
    UPDATE public.appointments
    SET status = 'finalizado'
    WHERE id = '41000000-0000-0000-0000-000000000007';
    RAISE EXCEPTION 'corrupt_package_was_silently_accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message NOT LIKE 'Integridade financeira inválida%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

UPDATE public.patient_packages
SET sessoes_usadas = 0, status = 'ativo'
WHERE id = '61000000-0000-0000-0000-000000000005';
UPDATE public.appointments
SET status = 'cancelado'
WHERE id = '41000000-0000-0000-0000-000000000007';

\echo '11) authenticated browser cannot mutate consumption ledger or finance exception queue'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000007', false);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.package_session_usage(clinic_id, patient_package_id, appointment_id)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      '61000000-0000-0000-0000-000000000005',
      '41000000-0000-0000-0000-000000000004'
    );
    RAISE EXCEPTION 'browser_package_ledger_write_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.appointment_financial_exceptions
    SET status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
    WHERE appointment_id = '41000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'browser_financial_exception_write_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

\echo '12) service role can use the controlled queue write/update grant, but not delete'
INSERT INTO public.appointments(
  id, clinic_id, paciente_id, professional_id, fisio_id, data, inicio, fim,
  status, tipo, valor, pacote_id
) VALUES (
  '43000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  current_date, '19:00', '19:30', 'cancelado', 'Controle service role', 10000, NULL
);

SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
INSERT INTO public.appointment_financial_exceptions(
  clinic_id, appointment_id, patient_id, source_package_id, reason_code
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '43000000-0000-0000-0000-000000000004',
  '31000000-0000-0000-0000-000000000001',
  NULL,
  'package_not_eligible'
);
UPDATE public.appointment_financial_exceptions
SET status = 'resolved', resolved_at = now(), resolution_note = 'controlled test'
WHERE appointment_id = '43000000-0000-0000-0000-000000000004';
DO $$
BEGIN
  BEGIN
    DELETE FROM public.appointment_financial_exceptions
    WHERE appointment_id = '43000000-0000-0000-0000-000000000004';
    RAISE EXCEPTION 'service_role_delete_grant_should_not_exist';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

\echo '13) package balances never exceed their totals after all scenarios'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.patient_packages
    WHERE sessoes_usadas < 0 OR sessoes_usadas > sessoes_totais
  ) THEN
    RAISE EXCEPTION 'package_overconsumption_after_cases';
  END IF;
END $$;
