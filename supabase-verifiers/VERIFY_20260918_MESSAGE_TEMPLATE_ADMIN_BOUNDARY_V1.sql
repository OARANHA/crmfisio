\set ON_ERROR_STOP on

SELECT '1) direct table/browser ACL is closed' AS check;
DO $$
BEGIN
  IF has_table_privilege('anon','public.message_templates','SELECT')
     OR has_table_privilege('anon','public.message_templates','INSERT')
     OR has_table_privilege('anon','public.message_templates','UPDATE')
     OR has_table_privilege('anon','public.message_templates','DELETE') THEN
    RAISE EXCEPTION 'anon_message_templates_privilege_leaked';
  END IF;

  IF has_table_privilege('authenticated','public.message_templates','SELECT')
     OR has_table_privilege('authenticated','public.message_templates','INSERT')
     OR has_table_privilege('authenticated','public.message_templates','UPDATE')
     OR has_table_privilege('authenticated','public.message_templates','DELETE') THEN
    RAISE EXCEPTION 'authenticated_message_templates_direct_privilege_leaked';
  END IF;
END $$;

SELECT '2) internal helpers are not browser RPCs' AS check;
DO $$
BEGIN
  IF has_function_privilege('anon','public.ensure_default_message_templates()','EXECUTE')
     OR has_function_privilege('authenticated','public.ensure_default_message_templates()','EXECUTE')
     OR has_function_privilege('anon','public.render_message_template(uuid,text,uuid,uuid,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.render_message_template(uuid,text,uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'internal_message_template_helper_acl_leaked';
  END IF;
END $$;

SELECT '3) manager RPCs are authenticated-only and security definer' AS check;
DO $$
DECLARE
  v_list oid := to_regprocedure('public.list_current_clinic_message_templates()');
  v_update oid := to_regprocedure('public.update_current_clinic_message_template(uuid,text)');
  v_list_def text;
  v_update_def text;
BEGIN
  IF v_list IS NULL OR v_update IS NULL THEN
    RAISE EXCEPTION 'message_template_admin_rpc_missing';
  END IF;

  IF has_function_privilege('anon',v_list,'EXECUTE')
     OR has_function_privilege('anon',v_update,'EXECUTE')
     OR NOT has_function_privilege('authenticated',v_list,'EXECUTE')
     OR NOT has_function_privilege('authenticated',v_update,'EXECUTE') THEN
    RAISE EXCEPTION 'message_template_admin_rpc_acl_invalid';
  END IF;

  SELECT pg_get_functiondef(v_list), pg_get_functiondef(v_update)
  INTO v_list_def, v_update_def;

  IF v_list_def NOT LIKE '%SECURITY DEFINER%'
     OR v_update_def NOT LIKE '%SECURITY DEFINER%'
     OR v_list_def NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_update_def NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_list_def NOT LIKE '%owner%'
     OR v_list_def NOT LIKE '%admin%'
     OR v_update_def NOT LIKE '%owner%'
     OR v_update_def NOT LIKE '%admin%'
     OR v_update_def NOT LIKE '%MESSAGE_TEMPLATE_UPDATED%' THEN
    RAISE EXCEPTION 'message_template_admin_rpc_contract_invalid';
  END IF;
END $$;

SELECT '4) owner/admin can list and update current tenant with audit' AS check;
SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000001', false);
SELECT set_config('app.role', 'owner', false);
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);

DO $$
DECLARE
  v_id uuid;
  v_body text;
BEGIN
  SELECT id INTO v_id
  FROM public.list_current_clinic_message_templates()
  WHERE template='confirmacao';

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'owner_list_missing_template';
  END IF;

  PERFORM public.update_current_clinic_message_template(v_id, 'Owner updated {nome}');

  SELECT body INTO v_body
  FROM public.list_current_clinic_message_templates()
  WHERE id=v_id;

  IF v_body <> 'Owner updated {nome}' THEN
    RAISE EXCEPTION 'owner_update_not_persisted';
  END IF;

END $$;

SELECT set_config('app.role', 'admin', false);
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', false);
DO $$
BEGIN
  PERFORM public.update_current_clinic_message_template(
    '50000000-0000-0000-0000-000000000002',
    'Admin NPS {nome}'
  );
END $$;
RESET ROLE;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE clinic_id='20000000-0000-0000-0000-000000000001'
    AND acao='MESSAGE_TEMPLATE_UPDATED'
    AND usuario_id IN (
      '40000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002'
    );
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'manager_update_audit_expected_2_got_%', v_count;
  END IF;
END $$;

SELECT '5) recep/professional cannot use admin RPCs' AS check;
SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000001', false);

SELECT set_config('app.role', 'recep', false);
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_message_templates();
    RAISE EXCEPTION 'recep_list_unexpectedly_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

SELECT set_config('app.role', 'professional', false);
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_message_templates();
    RAISE EXCEPTION 'professional_list_unexpectedly_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

SELECT '6) disabled entitlement and cross-tenant ids fail closed' AS check;
SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000002', false);
SELECT set_config('app.role', 'owner', false);
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.list_current_clinic_message_templates();
    RAISE EXCEPTION 'disabled_plan_list_unexpectedly_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.update_current_clinic_message_template(
      '50000000-0000-0000-0000-000000000005',
      'cross tenant'
    );
    RAISE EXCEPTION 'cross_tenant_update_unexpectedly_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

SELECT '7) direct DML cannot bypass RPC audit path' AS check;
SET ROLE authenticated;
SELECT set_config('app.clinic_id', '20000000-0000-0000-0000-000000000001', false);
SELECT set_config('app.role', 'owner', false);
DO $$
BEGIN
  BEGIN
    UPDATE public.message_templates SET body='direct bypass';
    RAISE EXCEPTION 'direct_update_unexpectedly_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

SELECT 'MESSAGE TEMPLATE ADMIN BOUNDARY V1 VERIFY PASSED' AS result;
