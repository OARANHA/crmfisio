-- Replace only the disposable temp pointer with a fresh signed EEM whose SOAP
-- field is populated. The historical C-03 EEM row remains untouched.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
UPDATE test_c03_eem_result
SET id = public.finalize_nexus_eem_result(
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000501',
  'nexus-eem-2026-09-03',
  '{}'::jsonb,
  jsonb_build_object('narrative','synthetic C03'),
  'synthetic C04 EEM',
  'low',
  'synthetic C04 interpretation',
  'synthetic C03',
  '[]'::jsonb,
  '[]'::jsonb
);
RESET ROLE;
