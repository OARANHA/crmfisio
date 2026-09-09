-- MEDICSPRO — Financial/Clinical Finalization Boundary
-- Clinical completion is authoritative once clinical invariants pass. Package
-- coverage remains strict, serialized and auditable without inventing usage.

BEGIN;

-- A package-linked finalized appointment that cannot legitimately consume the
-- package needs an explicit finance queue item. This is intentionally separate
-- from appointment_payment_resolutions, whose domain is prepaid cancellation
-- and whose contract requires a payment_id/disposition.
CREATE TABLE IF NOT EXISTS public.appointment_financial_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  source_package_id uuid,
  reason_code text NOT NULL CHECK (reason_code IN (
    'package_exhausted',
    'package_expired',
    'package_not_eligible'
  )),
  package_status_snapshot text,
  sessions_total_snapshot integer,
  sessions_used_snapshot integer,
  valid_until_snapshot date,
  detected_by uuid,
  detected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  CONSTRAINT appointment_financial_exceptions_one_per_appointment UNIQUE (appointment_id),
  CONSTRAINT appointment_financial_exceptions_resolution_shape CHECK (
    (status = 'pending' AND resolved_at IS NULL AND resolved_by IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS appointment_financial_exceptions_queue_idx
  ON public.appointment_financial_exceptions (clinic_id, status, detected_at DESC);

ALTER TABLE public.appointment_financial_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_financial_exceptions_read_financial
  ON public.appointment_financial_exceptions;
CREATE POLICY appointment_financial_exceptions_read_financial
ON public.appointment_financial_exceptions
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin','financeiro')
  AND public.current_clinic_entitlement_allowed('finance.access')
);

REVOKE ALL ON public.appointment_financial_exceptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.appointment_financial_exceptions FROM service_role;
GRANT SELECT ON public.appointment_financial_exceptions TO authenticated, service_role;
GRANT INSERT, UPDATE ON public.appointment_financial_exceptions TO service_role;

COMMENT ON TABLE public.appointment_financial_exceptions IS
  'Tenant-scoped queue for finalized clinical appointments whose linked package could not legitimately cover the session; separate from prepaid cancellation resolution.';

-- Appointments linked to a package are the reservation record. A dedicated
-- reservation table is unnecessary: serialize on patient_packages and count
-- non-terminal appointments that can still consume a session. This prevents
-- concurrent scheduling from reserving more coverage than the package owns.
CREATE INDEX IF NOT EXISTS appointments_package_reservation_idx
  ON public.appointments (pacote_id, status)
  WHERE pacote_id IS NOT NULL
    AND status IN ('agendado','confirmado','em_atendimento');

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

    -- Moving an existing reservation through its normal lifecycle does not
    -- reserve an additional unit. This also lets legacy overbooked rows reach
    -- clinical finalization, where coverage is reconciled explicitly.
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

DROP TRIGGER IF EXISTS trg_guard_appointment_package_reservation_capacity
  ON public.appointments;
CREATE TRIGGER trg_guard_appointment_package_reservation_capacity
BEFORE INSERT OR UPDATE OF pacote_id, status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_package_reservation_capacity();

REVOKE ALL ON FUNCTION public.guard_appointment_package_reservation_capacity()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_appointment_financial_exception(
  p_clinic_id uuid,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_source_package_id uuid,
  p_reason_code text,
  p_package_status text,
  p_sessions_total integer,
  p_sessions_used integer,
  p_valid_until date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_reason_code NOT IN ('package_exhausted','package_expired','package_not_eligible') THEN
    RAISE EXCEPTION 'Código de pendência financeira inválido' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.appointment_financial_exceptions (
    clinic_id,
    appointment_id,
    patient_id,
    source_package_id,
    reason_code,
    package_status_snapshot,
    sessions_total_snapshot,
    sessions_used_snapshot,
    valid_until_snapshot,
    detected_by
  ) VALUES (
    p_clinic_id,
    p_appointment_id,
    p_patient_id,
    p_source_package_id,
    p_reason_code,
    p_package_status,
    p_sessions_total,
    p_sessions_used,
    p_valid_until,
    auth.uid()
  )
  ON CONFLICT (appointment_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_appointment_financial_exception(
  uuid,uuid,uuid,uuid,text,text,integer,integer,date
) FROM PUBLIC, anon, authenticated;

-- Reconcile package materialization after clinical finalization. Expected
-- coverage failures become explicit finance exceptions. Unexpected integrity
-- failures are still raised so technical corruption never becomes silent.
CREATE OR REPLACE FUNCTION public.sync_appointment_package_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_package uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.pacote_id ELSE NULL END;
  v_new_package uuid := NEW.pacote_id;
  v_usage_id uuid;
  v_existing_usage public.package_session_usage%ROWTYPE;
  v_package public.patient_packages%ROWTYPE;
  v_reason text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'finalizado'
     AND NEW.status = 'finalizado'
     AND OLD.pacote_id IS NOT DISTINCT FROM NEW.pacote_id THEN
    RETURN NEW;
  END IF;

  -- Preserve the existing audited reversal semantics. Only a real ledger row
  -- returns one unit, and an impossible zero balance is treated as integrity
  -- failure instead of being hidden with greatest(0, ...).
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'finalizado'
     AND (NEW.status <> 'finalizado' OR OLD.pacote_id IS DISTINCT FROM NEW.pacote_id)
     AND v_old_package IS NOT NULL THEN
    SELECT * INTO v_package
    FROM public.patient_packages
    WHERE id = v_old_package
    FOR UPDATE;

    v_usage_id := NULL;
    DELETE FROM public.package_session_usage
    WHERE appointment_id = OLD.id
      AND patient_package_id = v_old_package
    RETURNING id INTO v_usage_id;

    IF v_usage_id IS NOT NULL THEN
      IF NOT FOUND OR v_package.sessoes_usadas <= 0 THEN
        RAISE EXCEPTION 'Integridade financeira inválida ao reverter consumo de pacote'
          USING ERRCODE = '23514';
      END IF;

      UPDATE public.patient_packages
      SET sessoes_usadas = sessoes_usadas - 1,
          updated_at = now()
      WHERE id = v_old_package
        AND sessoes_usadas > 0;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Integridade financeira inválida ao reverter consumo de pacote'
          USING ERRCODE = '23514';
      END IF;

      PERFORM public.refresh_patient_package_status(v_old_package);
    END IF;
  END IF;

  IF NEW.status <> 'finalizado' OR v_new_package IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotency: an already materialized usage for this appointment is valid
  -- only when it points at the immutable source package.
  SELECT * INTO v_existing_usage
  FROM public.package_session_usage
  WHERE appointment_id = NEW.id;

  IF FOUND THEN
    IF v_existing_usage.patient_package_id IS DISTINCT FROM v_new_package
       OR v_existing_usage.clinic_id IS DISTINCT FROM NEW.clinic_id THEN
      RAISE EXCEPTION 'Integridade financeira inválida no ledger de consumo do atendimento'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_package
  FROM public.patient_packages
  WHERE id = v_new_package
  FOR UPDATE;

  -- Missing/foreign/wrong-patient package links are coverage failures for the
  -- clinical event, not permission to fabricate a package consumption.
  IF NOT FOUND THEN
    PERFORM public.record_appointment_financial_exception(
      NEW.clinic_id, NEW.id, NEW.paciente_id, v_new_package,
      'package_not_eligible', NULL, NULL, NULL, NULL
    );
    RETURN NEW;
  END IF;

  IF v_package.sessoes_totais <= 0
     OR v_package.sessoes_usadas < 0
     OR v_package.sessoes_usadas > v_package.sessoes_totais THEN
    RAISE EXCEPTION 'Integridade financeira inválida no saldo do pacote'
      USING ERRCODE = '23514';
  END IF;

  IF v_package.clinic_id IS DISTINCT FROM NEW.clinic_id
     OR v_package.patient_id IS DISTINCT FROM NEW.paciente_id THEN
    v_reason := 'package_not_eligible';
  ELSIF v_package.status = 'vencido'
     OR (v_package.validade_ate IS NOT NULL AND v_package.validade_ate < NEW.data) THEN
    v_reason := 'package_expired';
  ELSIF v_package.status = 'esgotado'
     OR v_package.sessoes_usadas >= v_package.sessoes_totais THEN
    v_reason := 'package_exhausted';
  ELSIF v_package.status <> 'ativo' THEN
    v_reason := 'package_not_eligible';
  ELSE
    v_reason := NULL;
  END IF;

  IF v_reason IS NOT NULL THEN
    PERFORM public.record_appointment_financial_exception(
      NEW.clinic_id,
      NEW.id,
      NEW.paciente_id,
      v_new_package,
      v_reason,
      v_package.status,
      v_package.sessoes_totais,
      v_package.sessoes_usadas,
      v_package.validade_ate
    );
    RETURN NEW;
  END IF;

  -- The package row is locked. Insert and increment form one transaction; an
  -- unexpected failure rolls both back. The guarded UPDATE makes 2/1 impossible.
  v_usage_id := NULL;
  INSERT INTO public.package_session_usage (
    clinic_id, patient_package_id, appointment_id
  ) VALUES (
    NEW.clinic_id, v_new_package, NEW.id
  )
  ON CONFLICT (appointment_id) DO NOTHING
  RETURNING id INTO v_usage_id;

  IF v_usage_id IS NULL THEN
    SELECT * INTO v_existing_usage
    FROM public.package_session_usage
    WHERE appointment_id = NEW.id;

    IF NOT FOUND
       OR v_existing_usage.patient_package_id IS DISTINCT FROM v_new_package
       OR v_existing_usage.clinic_id IS DISTINCT FROM NEW.clinic_id THEN
      RAISE EXCEPTION 'Integridade financeira inválida no ledger de consumo do atendimento'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  UPDATE public.patient_packages
  SET sessoes_usadas = sessoes_usadas + 1,
      updated_at = now()
  WHERE id = v_new_package
    AND sessoes_usadas < sessoes_totais;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integridade financeira concorrente ao consumir pacote'
      USING ERRCODE = '23514';
  END IF;

  PERFORM public.refresh_patient_package_status(v_new_package);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_appointment_package_usage()
  FROM PUBLIC, anon, authenticated;

-- Keep the canonical trigger name so all existing consumers/verifiers continue
-- to observe one package materialization path.
DROP TRIGGER IF EXISTS trg_sync_appointment_package_usage ON public.appointments;
CREATE TRIGGER trg_sync_appointment_package_usage
AFTER INSERT OR UPDATE OF status, pacote_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_package_usage();

COMMIT;
