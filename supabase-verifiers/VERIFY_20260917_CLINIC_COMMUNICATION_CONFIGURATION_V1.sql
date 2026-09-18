\set ON_ERROR_STOP on

SELECT '1) write policy composes tenant + manager + effective WhatsApp entitlement' AS check;
DO $$
DECLARE
  v_qual text;
  v_check text;
BEGIN
  SELECT qual, with_check
  INTO v_qual, v_check
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='automation_settings'
    AND policyname='automation_settings_write_admin'
    AND cmd='ALL';

  IF v_qual IS NULL OR v_check IS NULL
     OR v_qual NOT LIKE '%current_clinic_id()%'
     OR v_check NOT LIKE '%current_clinic_id()%'
     OR v_qual NOT LIKE '%current_app_role()%'
     OR v_check NOT LIKE '%current_app_role()%'
     OR v_qual NOT LIKE '%owner%'
     OR v_qual NOT LIKE '%admin%'
     OR v_qual NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_check NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_qual NOT LIKE '%whatsapp.access%'
     OR v_check NOT LIKE '%whatsapp.access%' THEN
    RAISE EXCEPTION 'automation_settings_write_policy_contract_invalid: qual=%, check=%',
      coalesce(v_qual,'<null>'), coalesce(v_check,'<null>');
  END IF;
END $$;

SELECT '2) rollout baseline keeps owner configuration writable' AS check;
SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000001', false);
SELECT set_config('app.role', 'owner', false);
DO $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.automation_settings
  SET active = false
  WHERE clinic_id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'rollout_owner_write_expected_1_got_%', v_rows;
  END IF;
END $$;
RESET ROLE;

SELECT '3) explicit WhatsApp override off blocks mutation but preserves tenant read' AS check;
INSERT INTO public.platform_clinic_entitlements (
  clinic_id, entitlement_key, enabled, source
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  'whatsapp.access', false, 'manual'
);

SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000001', false);
SELECT set_config('app.role', 'owner', false);
DO $$
DECLARE v_rows integer; v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.automation_settings
  WHERE clinic_id = '20000000-0000-0000-0000-000000000001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'disabled_entitlement_must_preserve_settings_read';
  END IF;

  UPDATE public.automation_settings
  SET active = true
  WHERE clinic_id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'disabled_override_allowed_owner_write';
  END IF;
END $$;
RESET ROLE;

SELECT '4) explicit WhatsApp override on restores manager mutation' AS check;
UPDATE public.platform_clinic_entitlements
SET enabled = true
WHERE clinic_id = '20000000-0000-0000-0000-000000000001'
  AND entitlement_key = 'whatsapp.access';

SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000001', false);
SELECT set_config('app.role', 'admin', false);
DO $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.automation_settings
  SET active = true
  WHERE clinic_id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'enabled_override_admin_write_expected_1_got_%', v_rows;
  END IF;
END $$;
RESET ROLE;

SELECT '5) disabled plan baseline blocks mutation' AS check;
SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000002', false);
SELECT set_config('app.role', 'owner', false);
DO $$
DECLARE v_rows integer; v_allowed boolean;
BEGIN
  SELECT public.current_clinic_entitlement_allowed('whatsapp.access') INTO v_allowed;
  IF v_allowed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'fixture_plan_should_disable_whatsapp';
  END IF;

  UPDATE public.automation_settings
  SET active = false
  WHERE clinic_id = '20000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'disabled_plan_allowed_owner_write';
  END IF;
END $$;
RESET ROLE;

SELECT '6) explicit override on wins disabled plan baseline' AS check;
INSERT INTO public.platform_clinic_entitlements (
  clinic_id, entitlement_key, enabled, source
) VALUES (
  '20000000-0000-0000-0000-000000000002',
  'whatsapp.access', true, 'manual'
);

SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000002', false);
SELECT set_config('app.role', 'owner', false);
DO $$
DECLARE v_rows integer; v_allowed boolean;
BEGIN
  SELECT public.current_clinic_entitlement_allowed('whatsapp.access') INTO v_allowed;
  IF v_allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'explicit_override_should_win_disabled_plan';
  END IF;

  UPDATE public.automation_settings
  SET active = false
  WHERE clinic_id = '20000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'enabled_override_over_plan_write_expected_1_got_%', v_rows;
  END IF;
END $$;
RESET ROLE;

SELECT '7) non-manager and cross-tenant writes remain denied' AS check;
SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000001', false);
SELECT set_config('app.role', 'professional', false);
DO $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.automation_settings
  SET active = false
  WHERE clinic_id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'non_manager_write_allowed';
  END IF;
END $$;

SELECT set_config('app.role', 'owner', false);
DO $$
DECLARE v_rows integer; v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.automation_settings
  WHERE clinic_id = '20000000-0000-0000-0000-000000000002';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'cross_tenant_read_allowed';
  END IF;

  UPDATE public.automation_settings
  SET active = true
  WHERE clinic_id = '20000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'cross_tenant_write_allowed';
  END IF;
END $$;
RESET ROLE;

SELECT 'CLINIC COMMUNICATION CONFIGURATION V1 VERIFY PASSED' AS result;
