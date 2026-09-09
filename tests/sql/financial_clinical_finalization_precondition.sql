\echo '1) precondition: appointment A consumes the only package session'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

UPDATE public.appointments
SET status = 'finalizado'
WHERE id = '41000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  v_status text;
  v_used integer;
  v_usage integer;
BEGIN
  SELECT status INTO v_status FROM public.appointments
  WHERE id = '41000000-0000-0000-0000-000000000001';
  SELECT sessoes_usadas INTO v_used FROM public.patient_packages
  WHERE id = '61000000-0000-0000-0000-000000000001';
  SELECT count(*) INTO v_usage FROM public.package_session_usage
  WHERE appointment_id = '41000000-0000-0000-0000-000000000001';

  IF v_status <> 'finalizado' OR v_used <> 1 OR v_usage <> 1 THEN
    RAISE EXCEPTION 'precondition_A_did_not_consume_exactly_one_session';
  END IF;
END $$;

\echo '2) precondition: clinically valid B is rolled back by exhausted package'
DO $$
DECLARE
  v_message text;
  v_status text;
BEGIN
  BEGIN
    UPDATE public.appointments
    SET status = 'finalizado'
    WHERE id = '41000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'precondition_old_package_blocker_missing';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Pacote sem saldo ou fora da validade' THEN
      RAISE EXCEPTION 'unexpected_precondition_error: %', v_message;
    END IF;
  END;

  SELECT status INTO v_status FROM public.appointments
  WHERE id = '41000000-0000-0000-0000-000000000002';
  IF v_status <> 'em_atendimento' THEN
    RAISE EXCEPTION 'precondition_B_clinical_status_was_not_rolled_back';
  END IF;
END $$;

\echo '3) precondition: package remains exactly 1/1 and only A has usage'
DO $$
DECLARE
  v_used integer;
  v_total integer;
  v_a integer;
  v_b integer;
BEGIN
  SELECT sessoes_usadas, sessoes_totais INTO v_used, v_total
  FROM public.patient_packages
  WHERE id = '61000000-0000-0000-0000-000000000001';
  SELECT count(*) INTO v_a FROM public.package_session_usage
  WHERE appointment_id = '41000000-0000-0000-0000-000000000001';
  SELECT count(*) INTO v_b FROM public.package_session_usage
  WHERE appointment_id = '41000000-0000-0000-0000-000000000002';

  IF v_used <> 1 OR v_total <> 1 OR v_a <> 1 OR v_b <> 0 THEN
    RAISE EXCEPTION 'precondition_package_ledger_not_1_of_1';
  END IF;
END $$;

RESET ROLE;
