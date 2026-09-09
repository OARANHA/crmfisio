\echo '1) reproduce patient journey legacy-role rejection'

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.transition_patient_journey(
      '30000000-0000-0000-0000-000000000001',
      'tratamento',
      'precondition',
      NULL
    );
    RAISE EXCEPTION 'precondition_failed_legacy_journey_unexpectedly_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Somente profissional clínico pode iniciar tratamento%' THEN
      RAISE;
    END IF;
  END;
END $$;

\echo '2) reproduce zero-row appointment UPDATE caused by stale RLS'

DO $$
DECLARE
  v_rows integer;
  v_status text;
BEGIN
  UPDATE public.appointments
  SET status = 'finalizado'
  WHERE id = '40000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'precondition_failed_stale_rls_did_not_filter_professional';
  END IF;

  SELECT status INTO v_status
  FROM public.appointments
  WHERE id = '40000000-0000-0000-0000-000000000001';

  IF v_status <> 'em_atendimento' THEN
    RAISE EXCEPTION 'precondition_failed_zero_row_update_changed_status';
  END IF;
END $$;

RESET ROLE;

\echo '3) prove stale authorization definitions are present before migration'

DO $$
DECLARE
  v_journey text := lower(pg_get_functiondef('public.transition_patient_journey(uuid,text,text,text)'::regprocedure));
  v_mutation text := lower(pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure));
BEGIN
  IF v_journey NOT LIKE '%role <> ''fisio''%'
     OR v_mutation NOT LIKE '%v_role = ''fisio''%' THEN
    RAISE EXCEPTION 'precondition_failed_expected_legacy_authorization_not_present';
  END IF;
END $$;

-- Match the production event id default before applying the reconciliation migration.
ALTER TABLE public.patient_journey_events
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
