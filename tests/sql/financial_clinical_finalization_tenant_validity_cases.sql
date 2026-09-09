\echo '14) foreign package exception never snapshots another tenant financial metadata'
DO $$
DECLARE
  v_reason text;
  v_package_status text;
  v_total integer;
  v_used integer;
  v_valid_until date;
BEGIN
  SELECT
    reason_code,
    package_status_snapshot,
    sessions_total_snapshot,
    sessions_used_snapshot,
    valid_until_snapshot
  INTO
    v_reason,
    v_package_status,
    v_total,
    v_used,
    v_valid_until
  FROM public.appointment_financial_exceptions
  WHERE appointment_id = '41000000-0000-0000-0000-000000000006';

  IF v_reason IS DISTINCT FROM 'package_not_eligible'
     OR v_package_status IS NOT NULL
     OR v_total IS NOT NULL
     OR v_used IS NOT NULL
     OR v_valid_until IS NOT NULL THEN
    RAISE EXCEPTION 'foreign_package_financial_snapshot_leaked';
  END IF;

  IF (SELECT count(*) FROM public.package_session_usage
      WHERE appointment_id = '41000000-0000-0000-0000-000000000006') <> 0 THEN
    RAISE EXCEPTION 'foreign_package_created_usage';
  END IF;
END $$;

\echo '15) delayed finalization uses appointment date even after package status materializes as vencido'
INSERT INTO public.patient_packages(
  id,
  clinic_id,
  patient_id,
  package_id,
  sessoes_totais,
  sessoes_usadas,
  compra_data,
  validade_ate,
  valor_pago,
  status
) VALUES (
  '6f100000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000002',
  1,
  0,
  current_date - 10,
  current_date - 1,
  10000,
  'ativo'
);

-- The appointment is reserved while the package is still operationally active.
-- Its service date is exactly the last covered day.
INSERT INTO public.appointments(
  id,
  clinic_id,
  paciente_id,
  professional_id,
  fisio_id,
  data,
  inicio,
  fim,
  status,
  tipo,
  valor,
  pacote_id
) VALUES (
  '4f100000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  current_date - 1,
  '08:00',
  '08:30',
  'em_atendimento',
  'Finalização tardia na validade histórica',
  10000,
  '6f100000-0000-0000-0000-000000000001'
);

INSERT INTO public.physiotherapy_evolutions(
  id,
  clinic_id,
  patient_id,
  professional_id,
  session_id,
  texto
) VALUES (
  '7f100000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '4f100000-0000-0000-0000-000000000001',
  'Evolução de sessão ocorrida no último dia de validade'
);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.appointments
      WHERE pacote_id = '6f100000-0000-0000-0000-000000000001'
        AND status IN ('agendado','confirmado','em_atendimento')) <> 1
     OR (SELECT sessoes_usadas FROM public.patient_packages
         WHERE id = '6f100000-0000-0000-0000-000000000001') <> 0 THEN
    RAISE EXCEPTION 'historical_validity_reservation_precondition_failed';
  END IF;
END $$;

-- Simulate the ordinary lifecycle refresh happening after D. It legitimately
-- materializes the current package status as vencido because current_date > D.
SELECT public.refresh_patient_package_status(
  '6f100000-0000-0000-0000-000000000001'
);

DO $$
BEGIN
  IF (SELECT status FROM public.patient_packages
      WHERE id = '6f100000-0000-0000-0000-000000000001') <> 'vencido' THEN
    RAISE EXCEPTION 'package_was_not_materialized_as_vencido_for_regression';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
UPDATE public.appointments
SET status = 'finalizado'
WHERE id = '4f100000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT set_config('request.jwt.claim.role', '', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DO $$
BEGIN
  IF (SELECT status FROM public.appointments
      WHERE id = '4f100000-0000-0000-0000-000000000001') <> 'finalizado'
     OR (SELECT sessoes_usadas FROM public.patient_packages
         WHERE id = '6f100000-0000-0000-0000-000000000001') <> 1
     OR (SELECT count(*) FROM public.package_session_usage
         WHERE appointment_id = '4f100000-0000-0000-0000-000000000001'
           AND patient_package_id = '6f100000-0000-0000-0000-000000000001') <> 1
     OR (SELECT count(*) FROM public.appointment_financial_exceptions
         WHERE appointment_id = '4f100000-0000-0000-0000-000000000001') <> 0 THEN
    RAISE EXCEPTION 'historical_service_date_package_eligibility_regressed';
  END IF;

  IF (SELECT status FROM public.patient_packages
      WHERE id = '6f100000-0000-0000-0000-000000000001') <> 'vencido' THEN
    RAISE EXCEPTION 'current_package_status_materialization_changed_unexpectedly';
  END IF;
END $$;
