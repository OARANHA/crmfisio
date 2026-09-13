\echo 'D2-E4 pre-fix reproduction: effective appointment guard must reject A -> fixed target B'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);

-- This is intentionally unhandled. On main@3d35e10 the #452 RPC reaches the
-- effective appointment mutation guard and fails with the production error.
SELECT id
FROM public.schedule_clinical_referral_operation(
  'd4200000-0000-4000-8000-000000000001',
  current_date + 1,
  '10:00'::time,
  '11:00'::time,
  'd2100000-0000-4000-8000-000000000003',
  NULL,
  'Continuidade referral',
  0,
  NULL
);
