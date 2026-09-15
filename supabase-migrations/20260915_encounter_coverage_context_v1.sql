-- MEDICSPRO — Encounter Coverage Context V1
-- Narrow, appointment-scoped coverage read for Consultório.
-- This is not Finance module access and never grants financial mutation.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.get_encounter_coverage_context(
  p_appointment_id uuid
)
RETURNS TABLE (
  appointment_id uuid,
  coverage_kind text,
  coverage_state text,
  package_name text,
  administrative_attention boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic uuid := public.current_clinic_id();
  v_appointment public.appointments%ROWTYPE;
  v_package public.patient_packages%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_payment_count integer := 0;
  v_package_name text;
BEGIN
  IF v_uid IS NULL OR v_clinic IS NULL OR p_appointment_id IS NULL THEN
    RAISE EXCEPTION 'encounter_coverage_context_unavailable'
      USING ERRCODE = '42501';
  END IF;

  IF public.current_user_has_valid_clinical_identity() IS NOT TRUE
     OR public.current_user_has_clinical_capability('clinical.attend') IS NOT TRUE THEN
    RAISE EXCEPTION 'encounter_coverage_context_unavailable'
      USING ERRCODE = '42501';
  END IF;

  SELECT a.* INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.clinic_id = v_clinic
    AND a.professional_id = v_uid
    AND a.status = 'em_atendimento'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'encounter_coverage_context_unavailable'
      USING ERRCODE = '42501';
  END IF;

  -- Particular: expose only the state of this appointment's receivable.
  -- No amount, payment id, patient finance history or unrelated receivable is returned.
  IF v_appointment.pacote_id IS NULL THEN
    SELECT count(*)::integer INTO v_payment_count
    FROM public.payments p
    WHERE p.clinic_id = v_clinic
      AND p.appointment_id = v_appointment.id
      AND p.tipo = 'receber';

    IF v_payment_count > 1 THEN
      RAISE EXCEPTION 'encounter_coverage_payment_integrity_invalid'
        USING ERRCODE = '23514';
    END IF;

    IF v_payment_count = 0 THEN
      RETURN QUERY SELECT
        v_appointment.id,
        'private'::text,
        CASE WHEN v_appointment.valor > 0
          THEN 'private_planned'::text
          ELSE 'private_no_charge'::text
        END,
        NULL::text,
        false;
      RETURN;
    END IF;

    SELECT p.* INTO v_payment
    FROM public.payments p
    WHERE p.clinic_id = v_clinic
      AND p.appointment_id = v_appointment.id
      AND p.tipo = 'receber'
    LIMIT 1;

    IF v_payment.patient_id IS DISTINCT FROM v_appointment.paciente_id
       OR v_payment.status NOT IN ('pendente','pago','atrasado') THEN
      RAISE EXCEPTION 'encounter_coverage_payment_integrity_invalid'
        USING ERRCODE = '23514';
    END IF;

    RETURN QUERY SELECT
      v_appointment.id,
      'private'::text,
      CASE v_payment.status
        WHEN 'pago' THEN 'private_paid'::text
        WHEN 'atrasado' THEN 'private_overdue'::text
        ELSE 'private_pending'::text
      END,
      NULL::text,
      (v_payment.status = 'atrasado');
    RETURN;
  END IF;

  -- Package: the appointment itself is the reservation record. Read only the
  -- linked patient package and normalize expected coverage failures to attention.
  SELECT pp.* INTO v_package
  FROM public.patient_packages pp
  WHERE pp.id = v_appointment.pacote_id
    AND pp.clinic_id = v_clinic
    AND pp.patient_id = v_appointment.paciente_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      v_appointment.id,
      'package'::text,
      'package_attention'::text,
      NULL::text,
      true;
    RETURN;
  END IF;

  IF v_package.sessoes_totais <= 0
     OR v_package.sessoes_usadas < 0
     OR v_package.sessoes_usadas > v_package.sessoes_totais THEN
    RAISE EXCEPTION 'encounter_coverage_package_integrity_invalid'
      USING ERRCODE = '23514';
  END IF;

  SELECT sp.nome INTO v_package_name
  FROM public.session_packages sp
  WHERE sp.id = v_package.package_id
    AND sp.clinic_id = v_clinic
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'encounter_coverage_package_integrity_invalid'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.package_session_usage u
    WHERE u.appointment_id = v_appointment.id
      AND u.clinic_id = v_clinic
  ) THEN
    RAISE EXCEPTION 'encounter_coverage_package_integrity_invalid'
      USING ERRCODE = '23514';
  END IF;

  -- A reopened legacy row may already carry an administrative exception. Do not
  -- leak disposition details; keep the clinical actor on a neutral attention state.
  IF EXISTS (
    SELECT 1
    FROM public.appointment_financial_exceptions e
    WHERE e.appointment_id = v_appointment.id
      AND e.clinic_id = v_clinic
      AND e.patient_id = v_appointment.paciente_id
  ) THEN
    RETURN QUERY SELECT
      v_appointment.id,
      'package'::text,
      'package_attention'::text,
      v_package_name,
      true;
    RETURN;
  END IF;

  IF v_package.validade_ate IS NOT NULL
     AND v_package.validade_ate < v_appointment.data THEN
    RETURN QUERY SELECT
      v_appointment.id,
      'package'::text,
      'package_attention'::text,
      v_package_name,
      true;
    RETURN;
  END IF;

  IF v_package.sessoes_usadas >= v_package.sessoes_totais THEN
    RETURN QUERY SELECT
      v_appointment.id,
      'package'::text,
      'package_attention'::text,
      v_package_name,
      true;
    RETURN;
  END IF;

  IF v_package.status = 'esgotado'
     AND v_package.sessoes_usadas < v_package.sessoes_totais THEN
    RAISE EXCEPTION 'encounter_coverage_package_integrity_invalid'
      USING ERRCODE = '23514';
  END IF;

  IF v_package.status NOT IN ('ativo','vencido','esgotado') THEN
    RAISE EXCEPTION 'encounter_coverage_package_integrity_invalid'
      USING ERRCODE = '23514';
  END IF;

  -- Legacy over-reservation must never be presented as guaranteed coverage.
  IF (
    SELECT count(*)
    FROM public.appointments a
    WHERE a.pacote_id = v_appointment.pacote_id
      AND a.clinic_id = v_clinic
      AND a.status IN ('agendado','confirmado','em_atendimento')
  ) > (v_package.sessoes_totais - v_package.sessoes_usadas) THEN
    RETURN QUERY SELECT
      v_appointment.id,
      'package'::text,
      'package_attention'::text,
      v_package_name,
      true;
    RETURN;
  END IF;
  RETURN QUERY SELECT
    v_appointment.id,
    'package'::text,
    'package_reserved'::text,
    v_package_name,
    false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_encounter_coverage_context(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_encounter_coverage_context(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.get_encounter_coverage_context(uuid) IS
  'Encounter-scoped clinical coverage read. Own active encounter + valid clinical identity + clinical.attend only; exposes no amount, payment id, receivable history, financial queue or mutation authority.';

COMMIT;
