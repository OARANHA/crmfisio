-- MEDICSPRO — Finalized appointment financial source lock
-- Prevents double charging / package consumption drift after financial materialization.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_finalized_appointment_financial_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role text := COALESCE(auth.role(), '');
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Only the real Supabase service role or a direct trusted database session may
  -- bypass the lock for controlled repair. An authenticated user without a clinic
  -- profile must never become an implicit repair actor merely because app role is NULL.
  IF v_jwt_role = 'service_role'
     OR (v_jwt_role = '' AND session_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  -- Once an appointment is finalized, its financial source has already been materialized
  -- either as a receivable or as package consumption. Changing these fields in-place can
  -- create a receivable + package usage for the same appointment, or leave mismatched amounts.
  IF OLD.status = 'finalizado' AND (
    NEW.pacote_id IS DISTINCT FROM OLD.pacote_id
    OR NEW.valor IS DISTINCT FROM OLD.valor
    OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
  ) THEN
    RAISE EXCEPTION 'Atendimento finalizado possui origem financeira imutável; use correção auditável'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_finalized_appointment_financial_source ON public.appointments;
CREATE TRIGGER trg_guard_finalized_appointment_financial_source
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_finalized_appointment_financial_source();

REVOKE ALL ON FUNCTION public.guard_finalized_appointment_financial_source() FROM PUBLIC, anon, authenticated;

COMMIT;
