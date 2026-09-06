\pset pager off

SELECT '1) inbound RPC exists' AS check,
       to_regprocedure('public.process_whatsapp_inbound(text,text)') IS NOT NULL AS ok;

SELECT '2) inbound RPC is security definer' AS check,
       p.prosecdef AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'process_whatsapp_inbound'
  AND pg_get_function_identity_arguments(p.oid) = 'p_remote_jid text, p_message_text text';

SELECT '3) inbound resolves from wa_logs outbound ledger' AS check,
       pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%FROM public.wa_logs%'
       AND pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%l.telefone%'
       AS ok;

SELECT '4) global patient-phone lookup removed' AS check,
       pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) NOT ILIKE '%ORDER BY c.updated_at DESC%'
       AND pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) NOT ILIKE '%FROM canonical c%'
       AS ok;

SELECT '5) inactive or deleted clinics are excluded' AS check,
       pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%c.lifecycle_status = ''active''%'
       AND pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%c.deleted_at IS NULL%'
       AS ok;

SELECT '6) deleted or anonymized patients are excluded' AS check,
       pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%p.deleted_at IS NULL%'
       AND pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%p.anonimizado = false%'
       AS ok;

SELECT '7) WhatsApp entitlement is enforced' AS check,
       pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%clinic_entitlement_allowed(l.clinic_id, ''whatsapp.access'')%'
       AS ok;

SELECT '8) ambiguous recipients fail closed' AS check,
       pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%ambiguous_recipient%'
       AND pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%v_patient_count > 1%'
       AND pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%v_clinic_count > 1%'
       AS ok;

SELECT '9) appointment confirmation is bound to clinic and patient' AS check,
       pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%clinic_id = v_log.clinic_id%'
       AND pg_get_functiondef('public.process_whatsapp_inbound(text,text)'::regprocedure) ILIKE '%paciente_id = v_log.patient_id%'
       AS ok;

SELECT '10) service_role only can execute inbound RPC' AS check,
       has_function_privilege('service_role', 'public.process_whatsapp_inbound(text,text)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.process_whatsapp_inbound(text,text)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.process_whatsapp_inbound(text,text)', 'EXECUTE')
       AS ok;
