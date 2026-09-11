\set ON_ERROR_STOP on

BEGIN;
SET TRANSACTION READ ONLY;

SELECT '1) clinics identity columns and timezone contract' AS check;
DO $$
DECLARE
  v_missing text;
  v_default text;
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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'public.clinics'::regclass
      AND a.attname = 'timezone'
      AND a.attnotnull
      AND NOT a.attisdropped
  ) THEN
    RAISE EXCEPTION 'clinics_timezone_must_be_not_null';
  END IF;

  SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid)
    INTO v_default
  FROM pg_catalog.pg_attrdef d
  JOIN pg_catalog.pg_attribute a
    ON a.attrelid = d.adrelid
   AND a.attnum = d.adnum
  WHERE d.adrelid = 'public.clinics'::regclass
    AND a.attname = 'timezone';

  IF v_default IS NULL OR v_default NOT IN ('''UTC''::text', '''UTC''') THEN
    RAISE EXCEPTION 'clinics_timezone_default_unexpected: %', COALESCE(v_default, '<null>');
  END IF;

  IF to_regprocedure('public.is_valid_iana_timezone(text)') IS NULL THEN
    RAISE EXCEPTION 'iana_timezone_validator_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.clinics'::regclass
      AND c.conname = 'clinics_timezone_iana_check'
      AND c.contype = 'c'
      AND c.convalidated
      AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%is_valid_iana_timezone%timezone%'
  ) THEN
    RAISE EXCEPTION 'clinics_timezone_iana_constraint_missing_or_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.timezone IS NULL
       OR NOT public.is_valid_iana_timezone(c.timezone)
  ) THEN
    RAISE EXCEPTION 'clinic_with_invalid_iana_timezone_found';
  END IF;
END $$;

SELECT '2) clinic_opening_hours structural contract' AS check;
DO $$
DECLARE
  v_pk_columns text[];
BEGIN
  IF to_regclass('public.clinic_opening_hours') IS NULL THEN
    RAISE EXCEPTION 'clinic_opening_hours_missing';
  END IF;

  SELECT array_agg(a.attname ORDER BY keys.ordinality)
    INTO v_pk_columns
  FROM pg_catalog.pg_constraint c
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ordinality)
  JOIN pg_catalog.pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = keys.attnum
  WHERE c.conrelid = 'public.clinic_opening_hours'::regclass
    AND c.contype = 'p';

  IF v_pk_columns IS DISTINCT FROM ARRAY['clinic_id', 'day_of_week']::text[] THEN
    RAISE EXCEPTION 'clinic_opening_hours_primary_key_unexpected: %', v_pk_columns;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.clinic_opening_hours'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.clinics'::regclass
      AND c.convalidated
      AND c.confdeltype = 'c'
      AND (
        SELECT array_agg(a.attname ORDER BY keys.ordinality)
        FROM unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ordinality)
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = keys.attnum
      ) = ARRAY['clinic_id']::text[]
  ) THEN
    RAISE EXCEPTION 'clinic_opening_hours_clinic_fk_missing_or_unexpected';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.clinic_opening_hours'::regclass
      AND c.conname = 'clinic_opening_hours_day_check'
      AND c.contype = 'c'
      AND c.convalidated
      AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%day_of_week%'
      AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%>= 0%'
      AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%<= 6%'
  ) THEN
    RAISE EXCEPTION 'clinic_opening_hours_day_constraint_missing_or_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.clinic_opening_hours'::regclass
      AND c.conname = 'clinic_opening_hours_interval_check'
      AND c.contype = 'c'
      AND c.convalidated
      AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%is_open%'
      AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%opens_at%'
      AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%closes_at%'
      AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%IS NULL%'
      AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%<%'
  ) THEN
    RAISE EXCEPTION 'clinic_opening_hours_interval_constraint_missing_or_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    WHERE c.oid = 'public.clinic_opening_hours'::regclass
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'clinic_opening_hours_rls_disabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.clinic_opening_hours'::regclass
      AND t.tgname = 'trg_clinic_opening_hours_updated_at'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
      AND t.tgfoid = 'public.set_updated_at()'::regprocedure
      AND (t.tgtype & 1) = 1
      AND (t.tgtype & 2) = 2
      AND (t.tgtype & 16) = 16
  ) THEN
    RAISE EXCEPTION 'clinic_opening_hours_updated_at_trigger_missing_or_invalid';
  END IF;
END $$;

SELECT '3) opening-hours policies match the tenant/admin contract' AS check;
DO $$
DECLARE
  v_qual text;
  v_with_check text;
  v_roles name[];
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'clinic_opening_hours') <> 4 THEN
    RAISE EXCEPTION 'clinic_opening_hours_policy_count_unexpected';
  END IF;

  SELECT qual, with_check, roles
    INTO v_qual, v_with_check, v_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'clinic_opening_hours'
    AND policyname = 'clinic_opening_hours_select_tenant'
    AND cmd = 'SELECT';

  IF v_qual IS NULL
     OR NOT ('authenticated'::name = ANY(v_roles))
     OR v_qual NOT LIKE '%current_clinic_id()%'
     OR v_with_check IS NOT NULL THEN
    RAISE EXCEPTION 'select_tenant_policy_missing_or_unexpected';
  END IF;

  SELECT qual, with_check, roles
    INTO v_qual, v_with_check, v_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'clinic_opening_hours'
    AND policyname = 'clinic_opening_hours_insert_admin'
    AND cmd = 'INSERT';

  IF v_with_check IS NULL
     OR NOT ('authenticated'::name = ANY(v_roles))
     OR v_with_check NOT LIKE '%current_clinic_id()%'
     OR v_with_check NOT LIKE '%current_app_role()%'
     OR v_with_check NOT LIKE '%owner%'
     OR v_with_check NOT LIKE '%admin%' THEN
    RAISE EXCEPTION 'insert_admin_policy_missing_or_unexpected';
  END IF;

  SELECT qual, with_check, roles
    INTO v_qual, v_with_check, v_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'clinic_opening_hours'
    AND policyname = 'clinic_opening_hours_update_admin'
    AND cmd = 'UPDATE';

  IF v_qual IS NULL OR v_with_check IS NULL
     OR NOT ('authenticated'::name = ANY(v_roles))
     OR v_qual NOT LIKE '%current_clinic_id()%'
     OR v_qual NOT LIKE '%current_app_role()%'
     OR v_qual NOT LIKE '%owner%'
     OR v_qual NOT LIKE '%admin%'
     OR v_with_check NOT LIKE '%current_clinic_id()%'
     OR v_with_check NOT LIKE '%current_app_role()%'
     OR v_with_check NOT LIKE '%owner%'
     OR v_with_check NOT LIKE '%admin%' THEN
    RAISE EXCEPTION 'update_admin_policy_missing_or_unexpected';
  END IF;

  SELECT qual, with_check, roles
    INTO v_qual, v_with_check, v_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'clinic_opening_hours'
    AND policyname = 'clinic_opening_hours_delete_admin'
    AND cmd = 'DELETE';

  IF v_qual IS NULL
     OR NOT ('authenticated'::name = ANY(v_roles))
     OR v_qual NOT LIKE '%current_clinic_id()%'
     OR v_qual NOT LIKE '%current_app_role()%'
     OR v_qual NOT LIKE '%owner%'
     OR v_qual NOT LIKE '%admin%' THEN
    RAISE EXCEPTION 'delete_admin_policy_missing_or_unexpected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'clinic_opening_hours'
      AND ('anon'::name = ANY(p.roles) OR 'public'::name = ANY(p.roles))
  ) THEN
    RAISE EXCEPTION 'opening_hours_policy_exposed_to_anon_or_public';
  END IF;
END $$;

SELECT '4) grants and RPC ACLs' AS check;
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.clinic_opening_hours', 'SELECT')
     OR has_table_privilege('anon', 'public.clinic_opening_hours', 'INSERT')
     OR has_table_privilege('anon', 'public.clinic_opening_hours', 'UPDATE')
     OR has_table_privilege('anon', 'public.clinic_opening_hours', 'DELETE') THEN
    RAISE EXCEPTION 'anon_opening_hours_dml_privilege_leaked';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.clinic_opening_hours', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.clinic_opening_hours', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.clinic_opening_hours', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.clinic_opening_hours', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated_opening_hours_grants_missing';
  END IF;

  IF has_function_privilege('anon', 'public.get_current_clinic_identity()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.update_current_clinic_identity(text,text,text,text,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.is_valid_iana_timezone(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon_clinic_configuration_rpc_execute_leaked';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_current_clinic_identity()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.update_current_clinic_identity(text,text,text,text,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_valid_iana_timezone(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_clinic_configuration_rpc_execute_missing';
  END IF;
END $$;

SELECT '5) identity RPC definitions and helper dependencies' AS check;
DO $$
DECLARE
  v_get_oid oid := to_regprocedure('public.get_current_clinic_identity()');
  v_update_oid oid := to_regprocedure('public.update_current_clinic_identity(text,text,text,text,text,text)');
  v_get_search_path text;
  v_update_search_path text;
  v_update_args text;
BEGIN
  IF v_get_oid IS NULL THEN
    RAISE EXCEPTION 'get_current_clinic_identity_rpc_missing';
  END IF;

  IF v_update_oid IS NULL THEN
    RAISE EXCEPTION 'update_current_clinic_identity_rpc_missing';
  END IF;

  IF to_regprocedure('public.current_clinic_id()') IS NULL THEN
    RAISE EXCEPTION 'current_clinic_id_helper_missing';
  END IF;

  IF to_regprocedure('public.current_app_role()') IS NULL THEN
    RAISE EXCEPTION 'current_app_role_helper_missing';
  END IF;

  SELECT array_to_string(p.proconfig, ',')
    INTO v_get_search_path
  FROM pg_catalog.pg_proc p
  WHERE p.oid = v_get_oid
    AND p.prosecdef
    AND p.pronargs = 0;

  IF v_get_search_path IS NULL OR v_get_search_path NOT LIKE '%search_path=public, pg_temp%' THEN
    RAISE EXCEPTION 'get_current_clinic_identity_security_definer_or_search_path_invalid: %', COALESCE(v_get_search_path, '<null>');
  END IF;

  SELECT array_to_string(p.proconfig, ','), pg_catalog.pg_get_function_arguments(p.oid)
    INTO v_update_search_path, v_update_args
  FROM pg_catalog.pg_proc p
  WHERE p.oid = v_update_oid
    AND p.prosecdef
    AND p.pronargs = 6
    AND pg_catalog.oidvectortypes(p.proargtypes) = 'text, text, text, text, text, text';

  IF v_update_search_path IS NULL OR v_update_search_path NOT LIKE '%search_path=public, pg_temp%' THEN
    RAISE EXCEPTION 'update_current_clinic_identity_security_definer_or_search_path_invalid: %', COALESCE(v_update_search_path, '<null>');
  END IF;

  IF v_update_args IS NULL OR lower(v_update_args) LIKE '%clinic_id%' THEN
    RAISE EXCEPTION 'update_current_clinic_identity_must_not_accept_clinic_id: %', COALESCE(v_update_args, '<null>');
  END IF;
END $$;

SELECT '6) current data consistency' AS check;
SELECT
  count(*) AS total_clinics,
  count(*) FILTER (WHERE opening_rows BETWEEN 0 AND 6) AS clinics_with_0_to_6_lines,
  count(*) FILTER (WHERE opening_rows = 7) AS clinics_with_exactly_7_lines,
  count(*) FILTER (WHERE invalid_rows > 0 OR opening_rows > 7) AS clinics_with_any_inconsistency
FROM (
  SELECT
    c.id,
    count(h.clinic_id) AS opening_rows,
    count(h.clinic_id) FILTER (
      WHERE h.day_of_week NOT BETWEEN 0 AND 6
         OR (h.is_open AND (h.opens_at IS NULL OR h.closes_at IS NULL OR h.opens_at >= h.closes_at))
         OR (NOT h.is_open AND (h.opens_at IS NOT NULL OR h.closes_at IS NOT NULL))
    ) AS invalid_rows
  FROM public.clinics c
  LEFT JOIN public.clinic_opening_hours h ON h.clinic_id = c.id
  GROUP BY c.id
) AS coverage;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clinic_opening_hours h
    WHERE h.day_of_week NOT BETWEEN 0 AND 6
  ) THEN
    RAISE EXCEPTION 'opening_hours_day_out_of_range_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clinic_opening_hours h
    WHERE h.is_open
      AND (h.opens_at IS NULL OR h.closes_at IS NULL OR h.opens_at >= h.closes_at)
  ) THEN
    RAISE EXCEPTION 'invalid_open_interval_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clinic_opening_hours h
    WHERE NOT h.is_open
      AND (h.opens_at IS NOT NULL OR h.closes_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'closed_day_with_time_values_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clinic_opening_hours h
    LEFT JOIN public.clinics c ON c.id = h.clinic_id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'orphan_opening_hours_row_found';
  END IF;

  IF EXISTS (
    SELECT clinic_id, day_of_week
    FROM public.clinic_opening_hours
    GROUP BY clinic_id, day_of_week
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_opening_hours_day_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.timezone IS NULL
       OR NOT public.is_valid_iana_timezone(c.timezone)
  ) THEN
    RAISE EXCEPTION 'invalid_clinic_timezone_found';
  END IF;
END $$;

SELECT 'CLINIC CONFIGURATION CORE PRODUCTION VERIFY PASSED' AS result;

ROLLBACK;
