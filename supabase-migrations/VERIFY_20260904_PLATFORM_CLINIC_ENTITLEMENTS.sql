\set ON_ERROR_STOP on

DO $$
DECLARE
  v_count integer;
BEGIN
  IF to_regclass('public.platform_clinic_entitlements') IS NULL THEN
    RAISE EXCEPTION 'platform_clinic_entitlements missing';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_constraint
  WHERE conrelid = 'public.platform_clinic_entitlements'::regclass
    AND contype = 'p';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'platform_clinic_entitlements primary key missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'platform_clinic_entitlements'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS disabled on platform_clinic_entitlements';
  END IF;

  IF to_regprocedure('public.platform_get_clinic_entitlements(uuid)') IS NULL THEN
    RAISE EXCEPTION 'platform_get_clinic_entitlements missing';
  END IF;

  IF to_regprocedure('public.platform_set_clinic_entitlement(uuid,text,boolean,text,timestamp with time zone,timestamp with time zone)') IS NULL THEN
    RAISE EXCEPTION 'platform_set_clinic_entitlement missing';
  END IF;

  IF has_table_privilege('authenticated', 'public.platform_clinic_entitlements', 'SELECT')
     OR has_table_privilege('authenticated', 'public.platform_clinic_entitlements', 'INSERT')
     OR has_table_privilege('authenticated', 'public.platform_clinic_entitlements', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.platform_clinic_entitlements', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must not have direct table access';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.platform_get_clinic_entitlements(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute platform_get_clinic_entitlements';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.platform_set_clinic_entitlement(uuid,text,boolean,text,timestamp with time zone,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute platform_set_clinic_entitlement';
  END IF;

  RAISE NOTICE 'PLATFORM_CLINIC_ENTITLEMENTS_OK keys=6';
END
$$;
