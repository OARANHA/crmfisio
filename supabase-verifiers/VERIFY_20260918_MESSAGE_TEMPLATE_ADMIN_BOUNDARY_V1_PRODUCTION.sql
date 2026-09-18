\set ON_ERROR_STOP on

BEGIN;
SET TRANSACTION READ ONLY;

SELECT '1) message_templates direct ACL is closed' AS check;
DO $$
BEGIN
  IF to_regclass('public.message_templates') IS NULL THEN
    RAISE EXCEPTION 'message_templates_missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.message_templates'::regclass) THEN
    RAISE EXCEPTION 'message_templates_rls_disabled';
  END IF;
  IF has_table_privilege('anon','public.message_templates','SELECT')
     OR has_table_privilege('anon','public.message_templates','INSERT')
     OR has_table_privilege('anon','public.message_templates','UPDATE')
     OR has_table_privilege('anon','public.message_templates','DELETE')
     OR has_table_privilege('authenticated','public.message_templates','SELECT')
     OR has_table_privilege('authenticated','public.message_templates','INSERT')
     OR has_table_privilege('authenticated','public.message_templates','UPDATE')
     OR has_table_privilege('authenticated','public.message_templates','DELETE') THEN
    RAISE EXCEPTION 'message_templates_direct_client_acl_open';
  END IF;
END $$;

SELECT '2) only manager RPCs remain client-executable' AS check;
DO $$
DECLARE
  v_list oid := to_regprocedure('public.list_current_clinic_message_templates()');
  v_update oid := to_regprocedure('public.update_current_clinic_message_template(uuid,text)');
  v_update_def text;
BEGIN
  IF v_list IS NULL OR v_update IS NULL THEN
    RAISE EXCEPTION 'message_template_admin_rpc_missing';
  END IF;
  IF has_function_privilege('anon',v_list,'EXECUTE')
     OR has_function_privilege('anon',v_update,'EXECUTE')
     OR NOT has_function_privilege('authenticated',v_list,'EXECUTE')
     OR NOT has_function_privilege('authenticated',v_update,'EXECUTE')
     OR has_function_privilege('authenticated','public.ensure_default_message_templates()','EXECUTE')
     OR has_function_privilege('authenticated','public.render_message_template(uuid,text,uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'message_template_function_acl_invalid';
  END IF;

  SELECT pg_get_functiondef(v_update) INTO v_update_def;
  IF v_update_def NOT LIKE '%current_clinic_id()%'
     OR v_update_def NOT LIKE '%current_app_role()%'
     OR v_update_def NOT LIKE '%current_clinic_entitlement_allowed%'
     OR v_update_def NOT LIKE '%whatsapp.access%'
     OR v_update_def NOT LIKE '%MESSAGE_TEMPLATE_UPDATED%' THEN
    RAISE EXCEPTION 'message_template_update_contract_invalid';
  END IF;
END $$;

SELECT '3) stored templates remain structurally valid' AS check;
DO $$
BEGIN
  IF EXISTS (
    SELECT clinic_id, template
    FROM public.message_templates
    GROUP BY clinic_id, template
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_message_template_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.message_templates t
    LEFT JOIN public.clinics c ON c.id=t.clinic_id
    WHERE c.id IS NULL
       OR btrim(t.body)=''
       OR t.template NOT IN ('confirmacao','nps','reativacao','vaga_espera')
  ) THEN
    RAISE EXCEPTION 'invalid_message_template_row_found';
  END IF;
END $$;

SELECT
  count(*) AS template_rows,
  count(DISTINCT clinic_id) AS clinics_with_templates
FROM public.message_templates;

SELECT 'MESSAGE TEMPLATE ADMIN BOUNDARY V1 PRODUCTION VERIFY PASSED' AS result;
ROLLBACK;