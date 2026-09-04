\set ON_ERROR_STOP on

DO $$
DECLARE
  v_settings integer;
  v_rls_admin boolean;
  v_rls_settings boolean;
  v_rls_audit boolean;
  v_missing integer;
BEGIN
  SELECT count(*) INTO v_settings
  FROM public.platform_automation_settings
  WHERE key IN (
    'automation.enabled',
    'finance.overdue',
    'automation.core_tick',
    'waitlist.recovery',
    'reactivation.auto',
    'evolution.worker',
    'nexus.self_assessment_processor'
  );

  IF v_settings <> 7 THEN
    RAISE EXCEPTION 'Expected 7 platform automation settings, got %', v_settings;
  END IF;

  SELECT count(*) INTO v_missing
  FROM (VALUES
    ('platform_admins', 'ativo'),
    ('platform_audit_log', 'target_type'),
    ('platform_audit_log', 'target_id'),
    ('platform_audit_log', 'entity_type'),
    ('platform_audit_log', 'entity_key')
  ) AS expected(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = expected.table_name
      AND c.column_name = expected.column_name
  );

  IF v_missing <> 0 THEN
    RAISE EXCEPTION 'Platform governance compatibility columns missing: %', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.platform_audit_log
    WHERE entity_type IS NULL OR entity_key IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing platform audit rows were not backfilled into governance projection';
  END IF;

  SELECT relrowsecurity INTO v_rls_admin
  FROM pg_class
  WHERE oid = 'public.platform_admins'::regclass;

  SELECT relrowsecurity INTO v_rls_settings
  FROM pg_class
  WHERE oid = 'public.platform_automation_settings'::regclass;

  SELECT relrowsecurity INTO v_rls_audit
  FROM pg_class
  WHERE oid = 'public.platform_audit_log'::regclass;

  IF NOT coalesce(v_rls_admin, false)
     OR NOT coalesce(v_rls_settings, false)
     OR NOT coalesce(v_rls_audit, false) THEN
    RAISE EXCEPTION 'Platform governance tables must have RLS enabled';
  END IF;

  IF has_table_privilege('authenticated', 'public.platform_admins', 'SELECT')
     OR has_table_privilege('authenticated', 'public.platform_automation_settings', 'SELECT')
     OR has_table_privilege('authenticated', 'public.platform_audit_log', 'SELECT') THEN
    RAISE EXCEPTION 'Authenticated must not have direct SELECT on platform governance tables';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.is_platform_admin()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.platform_get_automation_settings()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.platform_set_automation_setting(text,boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.platform_get_audit_log(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated RPC grants missing';
  END IF;

  RAISE NOTICE 'PLATFORM_ADMIN_GOVERNANCE_OK settings=% legacy_schema_compatible=true', v_settings;
END
$$;
