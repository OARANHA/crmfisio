\set ON_ERROR_STOP on

BEGIN;
SET TRANSACTION READ ONLY;

SELECT '1) automation settings RLS and policy contract' AS check;
DO $$
DECLARE
  v_select_qual text;
  v_write_qual text;
  v_write_check text;
BEGIN
  IF to_regclass('public.automation_settings') IS NULL THEN
    RAISE EXCEPTION 'automation_settings_missing';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.automation_settings'::regclass) THEN
    RAISE EXCEPTION 'automation_settings_rls_disabled';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='automation_settings') <> 2 THEN
    RAISE EXCEPTION 'automation_settings_policy_count_unexpected';
  END IF;

  SELECT qual INTO v_select_qual
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='automation_settings'
    AND policyname='automation_settings_select_tenant'
    AND cmd='SELECT';

  IF v_select_qual IS NULL
     OR v_select_qual NOT LIKE '%current_clinic_id()%'
     OR v_select_qual LIKE '%current_clinic_entitlement_allowed%' THEN
    RAISE EXCEPTION 'automation_settings_select_policy_changed: %', coalesce(v_select_qual,'<null>');
  END IF;

  SELECT qual, with_check INTO v_write_qual, v_write_check
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='automation_settings'
    AND policyname='automation_settings_write_admin'
    AND cmd='ALL';

  IF v_write_qual IS NULL OR v_write_check IS NULL
     OR v_write_qual NOT LIKE '%current_clinic_id()%'
     OR v_write_check NOT LIKE '%current_clinic_id()%'
     OR v_write_qual NOT LIKE '%current_app_role()%'
     OR v_write_check NOT LIKE '%current_app_role()%'
     OR v_write_qual NOT LIKE '%owner%'
     OR v_write_qual NOT LIKE '%admin%'
     OR v_write_qual NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_write_check NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_write_qual NOT LIKE '%whatsapp.access%'
     OR v_write_check NOT LIKE '%whatsapp.access%' THEN
    RAISE EXCEPTION 'automation_settings_write_policy_not_entitlement_aware';
  END IF;
END $$;

SELECT '2) table grants preserve tenant read and manager-RLS mutation surface' AS check;
DO $$
BEGIN
  IF has_table_privilege('anon','public.automation_settings','SELECT')
     OR has_table_privilege('anon','public.automation_settings','INSERT')
     OR has_table_privilege('anon','public.automation_settings','UPDATE')
     OR has_table_privilege('anon','public.automation_settings','DELETE') THEN
    RAISE EXCEPTION 'anon_automation_settings_privilege_leaked';
  END IF;

  IF NOT has_table_privilege('authenticated','public.automation_settings','SELECT')
     OR NOT has_table_privilege('authenticated','public.automation_settings','INSERT')
     OR NOT has_table_privilege('authenticated','public.automation_settings','UPDATE')
     OR has_table_privilege('authenticated','public.automation_settings','DELETE') THEN
    RAISE EXCEPTION 'authenticated_automation_settings_grants_unexpected';
  END IF;
END $$;

SELECT '3) canonical entitlement predicate remains protected' AS check;
DO $$
DECLARE
  v_oid oid := to_regprocedure('public.current_clinic_entitlement_allowed(text)');
  v_config text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'current_clinic_entitlement_allowed_missing';
  END IF;

  SELECT array_to_string(proconfig, ',')
  INTO v_config
  FROM pg_proc
  WHERE oid=v_oid AND prosecdef AND provolatile='s';

  IF v_config IS NULL OR v_config NOT LIKE '%search_path=public, pg_temp%' THEN
    RAISE EXCEPTION 'entitlement_predicate_security_contract_invalid';
  END IF;

  IF NOT has_function_privilege('authenticated','public.current_clinic_entitlement_allowed(text)','EXECUTE')
     OR has_function_privilege('anon','public.current_clinic_entitlement_allowed(text)','EXECUTE') THEN
    RAISE EXCEPTION 'entitlement_predicate_acl_invalid';
  END IF;
END $$;

SELECT '4) existing clinic settings remain structurally consistent' AS check;
DO $$
BEGIN
  IF EXISTS (
    SELECT clinic_id
    FROM public.automation_settings
    GROUP BY clinic_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_automation_settings_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.automation_settings s
    LEFT JOIN public.clinics c ON c.id=s.clinic_id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'orphan_automation_settings_found';
  END IF;
END $$;

SELECT
  (SELECT count(*) FROM public.automation_settings) AS clinic_settings_rows,
  (SELECT count(*) FROM public.platform_clinic_entitlements WHERE entitlement_key='whatsapp.access') AS explicit_whatsapp_overrides,
  (SELECT count(*) FROM public.clinic_plan_assignments WHERE ends_at IS NULL) AS open_plan_assignments;

SELECT 'CLINIC COMMUNICATION CONFIGURATION V1 PRODUCTION VERIFY PASSED' AS result;

ROLLBACK;
