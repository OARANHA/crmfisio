SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
DO $$
BEGIN
  IF NOT public.can_access_patient_clinical_record(
    '00000000-0000-0000-0000-000000000301'::uuid
  ) THEN
    RAISE EXCEPTION 'C06 regression: canonical professional appointment relationship remains blocked';
  END IF;
END;
$$;
RESET ROLE;
