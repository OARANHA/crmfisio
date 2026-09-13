-- Prove that a failure after the same-transaction authorization proof has been
-- accepted by the canonical appointment guard rolls the proof back with the RPC.

CREATE OR REPLACE FUNCTION public.zz_d2e4_force_appointment_insert_failure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'd2e4_forced_insert_failure';
END;
$$;

DROP TRIGGER IF EXISTS zz_d2e4_force_appointment_insert_failure ON public.appointments;
CREATE TRIGGER zz_d2e4_force_appointment_insert_failure
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.zz_d2e4_force_appointment_insert_failure();

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.schedule_clinical_referral_operation(
      'd4200000-0000-4000-8000-000000000002',
      current_date + 5,
      '10:00'::time,
      '11:00'::time,
      'd2100000-0000-4000-8000-000000000003',
      NULL,
      'Rollback proof regression',
      0,
      NULL
    );
    RAISE EXCEPTION 'd2e4_forced_insert_failure_did_not_fire';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM IS DISTINCT FROM 'd2e4_forced_insert_failure' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

DROP TRIGGER zz_d2e4_force_appointment_insert_failure ON public.appointments;
DROP FUNCTION public.zz_d2e4_force_appointment_insert_failure();

DO $$
DECLARE
  v_status text;
  v_appointment_id uuid;
  v_proofs integer;
BEGIN
  SELECT status, appointment_id
    INTO v_status, v_appointment_id
  FROM public.clinical_referral_operations
  WHERE id = 'd4200000-0000-4000-8000-000000000002';

  SELECT count(*) INTO v_proofs
  FROM public.clinical_referral_operation_events
  WHERE operation_id = 'd4200000-0000-4000-8000-000000000002'
    AND event_type = 'appointment_insert_authorized';

  IF v_status IS DISTINCT FROM 'received'
     OR v_appointment_id IS NOT NULL
     OR v_proofs <> 0 THEN
    RAISE EXCEPTION 'd2e4_failed_insert_left_authorization_residue';
  END IF;
END $$;
