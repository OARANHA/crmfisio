\pset pager off

SELECT '1) outbox guard function exists' AS check,
       to_regprocedure('public.guard_whatsapp_outbox_entitlement()') IS NOT NULL AS ok;

SELECT '2) outbox trigger exists' AS check,
       EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgname = 'trg_guard_whatsapp_outbox_entitlement'
           AND tgrelid = 'public.wa_logs'::regclass
           AND NOT tgisinternal
       ) AS ok;

SELECT '3) outbox insert requires active non-deleted clinic' AS check,
       position('lifecycle_status = ''active''' in pg_get_functiondef('public.guard_whatsapp_outbox_entitlement()'::regprocedure)) > 0
       AND position('deleted_at IS NULL' in pg_get_functiondef('public.guard_whatsapp_outbox_entitlement()'::regprocedure)) > 0 AS ok;

SELECT '4) outbox insert still enforces whatsapp entitlement' AS check,
       position('clinic_entitlement_allowed' in pg_get_functiondef('public.guard_whatsapp_outbox_entitlement()'::regprocedure)) > 0 AS ok;

SELECT '5) provider status updates remain permitted after suspension' AS check,
       position('TG_OP = ''INSERT'' AND NOT v_clinic_active' in pg_get_functiondef('public.guard_whatsapp_outbox_entitlement()'::regprocedure)) > 0
       AND position('auth.uid() IS NOT NULL' in pg_get_functiondef('public.guard_whatsapp_outbox_entitlement()'::regprocedure)) > 0 AS ok;

SELECT '6) human review requires active clinic' AS check,
       position('NOT v_clinic_active' in pg_get_functiondef('public.guard_whatsapp_outbox_entitlement()'::regprocedure)) > 0
       AND position('review_resolution' in pg_get_functiondef('public.guard_whatsapp_outbox_entitlement()'::regprocedure)) > 0 AS ok;

SELECT '7) template guard function exists' AS check,
       to_regprocedure('public.guard_whatsapp_template_entitlement()') IS NOT NULL AS ok;

SELECT '8) template trigger exists' AS check,
       EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgname = 'trg_guard_whatsapp_template_entitlement'
           AND tgrelid = 'public.message_templates'::regclass
           AND NOT tgisinternal
       ) AS ok;

SELECT '9) template mutations require active clinic and entitlement' AS check,
       position('lifecycle_status = ''active''' in pg_get_functiondef('public.guard_whatsapp_template_entitlement()'::regprocedure)) > 0
       AND position('clinic_entitlement_allowed' in pg_get_functiondef('public.guard_whatsapp_template_entitlement()'::regprocedure)) > 0 AS ok;

SELECT '10) browser roles cannot execute lifecycle guard functions directly' AS check,
       NOT has_function_privilege('authenticated', 'public.guard_whatsapp_outbox_entitlement()', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.guard_whatsapp_outbox_entitlement()', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.guard_whatsapp_template_entitlement()', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.guard_whatsapp_template_entitlement()', 'EXECUTE') AS ok;
