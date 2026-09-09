\echo '14a) repeated WAIVE with the same normalized reason is idempotent'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
SELECT * FROM public.resolve_appointment_financial_exception(
  '88000000-0000-0000-0000-000000000006',
  'waived',
  'Cortesia aprovada pelo owner'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.role','',false);
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
BEGIN
  IF (SELECT count(*)
      FROM public.appointment_financial_exception_dispositions
      WHERE exception_id='88000000-0000-0000-0000-000000000006') <> 1
     OR (SELECT reason
         FROM public.appointment_financial_exception_dispositions
         WHERE exception_id='88000000-0000-0000-0000-000000000006')
        IS DISTINCT FROM 'Cortesia aprovada pelo owner'
     OR EXISTS (
       SELECT 1 FROM public.payments
       WHERE appointment_id='49000000-0000-0000-0000-000000000006'
     ) THEN
    RAISE EXCEPTION 'waive_same_reason_idempotency_failed';
  END IF;
END $$;

\echo '14b) repeated WAIVE with a different reason fails closed and preserves history'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.resolve_appointment_financial_exception(
      '88000000-0000-0000-0000-000000000006',
      'waived',
      'Motivo semanticamente diferente'
    );
    RAISE EXCEPTION 'waive_different_reason_was_accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','',false);
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
BEGIN
  IF (SELECT count(*)
      FROM public.appointment_financial_exception_dispositions
      WHERE exception_id='88000000-0000-0000-0000-000000000006') <> 1
     OR (SELECT reason
         FROM public.appointment_financial_exception_dispositions
         WHERE exception_id='88000000-0000-0000-0000-000000000006')
        IS DISTINCT FROM 'Cortesia aprovada pelo owner'
     OR EXISTS (
       SELECT 1 FROM public.payments
       WHERE appointment_id='49000000-0000-0000-0000-000000000006'
     ) THEN
    RAISE EXCEPTION 'waive_different_reason_mutated_persisted_decision';
  END IF;
END $$;
