\set ON_ERROR_STOP on

SELECT '1) schema and identity columns' AS check;
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(required.column_name, ', ' ORDER BY required.column_name)
    INTO v_missing
  FROM (VALUES ('phone'), ('email'), ('address'), ('timezone')) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'clinics'
      AND c.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'missing_clinic_identity_columns: %', v_missing;
  END IF;

  IF to_regclass('public.clinic_opening_hours') IS NULL THEN
    RAISE EXCEPTION 'clinic_opening_hours_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clinic_opening_hours'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) ILIKE '%clinic_id%day_of_week%'
  ) THEN
    RAISE EXCEPTION 'clinic_opening_hours_primary_key_missing';
  END IF;
END $$;

SELECT '2) timezone is IANA, persisted, and conservatively backfilled' AS check;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.clinics WHERE timezone IS DISTINCT FROM 'UTC') THEN
    RAISE EXCEPTION 'existing_clinic_timezone_backfill_not_utc';
  END IF;
  IF NOT public.is_valid_iana_timezone('America/Sao_Paulo') THEN
    RAISE EXCEPTION 'iana_timezone_validation_rejected_valid_zone';
  END IF;
  IF public.is_valid_iana_timezone('MedicsPro/Not_A_Zone') THEN
    RAISE EXCEPTION 'iana_timezone_validation_accepted_invalid_zone';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT * FROM public.update_current_clinic_identity(
  'Clínica A Atualizada', '11111111000111', '(51) 99999-0001',
  'contato-a@example.test', 'Rua A, 100', 'America/Sao_Paulo'
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinics
    WHERE id = '20000000-0000-0000-0000-000000000001'
      AND name = 'Clínica A Atualizada'
      AND phone = '(51) 99999-0001'
      AND email = 'contato-a@example.test'
      AND address = 'Rua A, 100'
      AND timezone = 'America/Sao_Paulo'
  ) THEN
    RAISE EXCEPTION 'owner_identity_update_not_persisted';
  END IF;
END $$;

SELECT '3) seven weekdays are represented with Monday=0 through Sunday=6' AS check;
DO $$
BEGIN
  IF EXISTS (
    SELECT clinic_id
    FROM public.clinic_opening_hours
    GROUP BY clinic_id
    HAVING count(*) <> 7 OR min(day_of_week) <> 0 OR max(day_of_week) <> 6
  ) THEN
    RAISE EXCEPTION 'weekly_schedule_not_seven_days';
  END IF;
  IF (SELECT count(*) FROM public.clinic_opening_hours) <> 21 THEN
    RAISE EXCEPTION 'existing_clinics_not_seeded_with_seven_days';
  END IF;
END $$;

SELECT '4) owner and admin can mutate same-tenant weekly hours' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
UPDATE public.clinic_opening_hours
SET is_open = true, opens_at = '08:00', closes_at = '18:00'
WHERE clinic_id = '20000000-0000-0000-0000-000000000001' AND day_of_week = 0;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
UPDATE public.clinic_opening_hours
SET is_open = true, opens_at = '09:00', closes_at = '17:00'
WHERE clinic_id = '20000000-0000-0000-0000-000000000001' AND day_of_week = 1;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_opening_hours
    WHERE clinic_id = '20000000-0000-0000-0000-000000000001'
      AND day_of_week = 0 AND is_open AND opens_at = '08:00' AND closes_at = '18:00'
  ) THEN
    RAISE EXCEPTION 'owner_weekly_hours_update_failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_opening_hours
    WHERE clinic_id = '20000000-0000-0000-0000-000000000001'
      AND day_of_week = 1 AND is_open AND opens_at = '09:00' AND closes_at = '17:00'
  ) THEN
    RAISE EXCEPTION 'admin_weekly_hours_update_failed';
  END IF;
END $$;

SELECT '5) non-admin clinic roles may read but cannot mutate' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE
  v_user uuid;
  v_count int;
  v_rows int;
BEGIN
  FOREACH v_user IN ARRAY ARRAY[
    '10000000-0000-0000-0000-000000000003'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    '10000000-0000-0000-0000-000000000005'::uuid
  ] LOOP
    PERFORM set_config('request.jwt.claim.sub', v_user::text, false);

    SELECT count(*) INTO v_count
    FROM public.clinic_opening_hours
    WHERE clinic_id = '20000000-0000-0000-0000-000000000001';
    IF v_count <> 7 THEN
      RAISE EXCEPTION 'same_tenant_read_denied_for_role_user_%', v_user;
    END IF;

    UPDATE public.clinic_opening_hours
    SET opens_at = '07:30', closes_at = '18:30'
    WHERE clinic_id = '20000000-0000-0000-0000-000000000001' AND day_of_week = 0;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN
      RAISE EXCEPTION 'non_admin_hours_write_allowed_for_user_%', v_user;
    END IF;

    BEGIN
      PERFORM public.update_current_clinic_identity(
        'Unauthorized', NULL, NULL, NULL, NULL, 'UTC'
      );
      RAISE EXCEPTION 'non_admin_identity_write_allowed_for_user_%', v_user;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
END $$;
RESET ROLE;

SELECT '6) cross-tenant reads and writes fail closed' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE
  v_count int;
  v_rows int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.clinic_opening_hours
  WHERE clinic_id = '20000000-0000-0000-0000-000000000002';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'cross_tenant_read_allowed';
  END IF;

  UPDATE public.clinic_opening_hours
  SET is_open = true, opens_at = '06:00', closes_at = '22:00'
  WHERE clinic_id = '20000000-0000-0000-0000-000000000002' AND day_of_week = 0;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'cross_tenant_update_allowed';
  END IF;

  BEGIN
    UPDATE public.clinic_opening_hours
    SET clinic_id = '20000000-0000-0000-0000-000000000002'
    WHERE clinic_id = '20000000-0000-0000-0000-000000000001' AND day_of_week = 2;
    RAISE EXCEPTION 'tenant_key_reassignment_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

SELECT '7) inactive and suspended identities are denied' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE
  v_user uuid;
  v_count int;
  v_rows int;
BEGIN
  FOREACH v_user IN ARRAY ARRAY[
    '10000000-0000-0000-0000-000000000006'::uuid,
    '10000000-0000-0000-0000-000000000008'::uuid
  ] LOOP
    PERFORM set_config('request.jwt.claim.sub', v_user::text, false);
    SELECT count(*) INTO v_count FROM public.clinic_opening_hours;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'inactive_or_suspended_read_allowed_for_user_%', v_user;
    END IF;

    UPDATE public.clinic_opening_hours
    SET is_open = true, opens_at = '08:00', closes_at = '17:00'
    WHERE day_of_week = 4;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN
      RAISE EXCEPTION 'inactive_or_suspended_write_allowed_for_user_%', v_user;
    END IF;

    BEGIN
      PERFORM public.get_current_clinic_identity();
      RAISE EXCEPTION 'inactive_or_suspended_identity_read_allowed_for_user_%', v_user;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
END $$;
RESET ROLE;

SELECT '8) anon has neither table access nor identity RPC execute' AS check;
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.clinic_opening_hours', 'SELECT')
     OR has_table_privilege('anon', 'public.clinic_opening_hours', 'INSERT')
     OR has_table_privilege('anon', 'public.clinic_opening_hours', 'UPDATE')
     OR has_table_privilege('anon', 'public.clinic_opening_hours', 'DELETE') THEN
    RAISE EXCEPTION 'anon_hours_privilege_leaked';
  END IF;

  IF has_function_privilege('anon', 'public.get_current_clinic_identity()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.update_current_clinic_identity(text,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon_identity_rpc_privilege_leaked';
  END IF;
END $$;

SELECT '9) constraints reject invalid weekdays, intervals and timezones' AS check;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.clinic_opening_hours (clinic_id, day_of_week, is_open, opens_at, closes_at)
    VALUES ('20000000-0000-0000-0000-000000000001', 7, true, '08:00', '18:00');
    RAISE EXCEPTION 'invalid_weekday_accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.clinic_opening_hours
    SET is_open = true, opens_at = '18:00', closes_at = '08:00'
    WHERE clinic_id = '20000000-0000-0000-0000-000000000001' AND day_of_week = 3;
    RAISE EXCEPTION 'invalid_open_interval_accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM public.update_current_clinic_identity(
      'Clínica A Atualizada', NULL, NULL, NULL, NULL, 'MedicsPro/Not_A_Zone'
    );
    RAISE EXCEPTION 'invalid_timezone_accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
END $$;
RESET ROLE;

SELECT '10) grants, RLS and policies are present' AS check;
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.clinic_opening_hours'::regclass) THEN
    RAISE EXCEPTION 'opening_hours_rls_disabled';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.clinic_opening_hours', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'authenticated_hours_grants_missing';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='clinic_opening_hours') <> 4 THEN
    RAISE EXCEPTION 'opening_hours_policy_count_invalid';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_current_clinic_identity()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.update_current_clinic_identity(text,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_identity_rpc_grant_missing';
  END IF;
END $$;

SELECT 'clinic_configuration_core_verifier_ok' AS result;
