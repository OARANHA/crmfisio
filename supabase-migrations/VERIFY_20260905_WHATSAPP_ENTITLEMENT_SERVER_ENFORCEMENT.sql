\echo '1) explicit-clinic entitlement helper exists'
SELECT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='clinic_entitlement_allowed'
) AS ok;

\echo '2) outbox trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.wa_logs'::regclass
    AND tgname='trg_guard_whatsapp_outbox_entitlement'
    AND NOT tgisinternal
) AS ok;

\echo '3) outbox trigger function contains whatsapp gate'
SELECT p.proname,
  pg_get_functiondef(p.oid) ILIKE '%clinic_entitlement_allowed(v_clinic, ''whatsapp.access'')%' AS has_entitlement_gate
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='guard_whatsapp_outbox_entitlement';

\echo '4) template trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.message_templates'::regclass
    AND tgname='trg_guard_whatsapp_template_entitlement'
    AND NOT tgisinternal
) AS ok;

\echo '5) template trigger function contains whatsapp gate'
SELECT p.proname,
  pg_get_functiondef(p.oid) ILIKE '%clinic_entitlement_allowed(v_clinic, ''whatsapp.access'')%' AS has_entitlement_gate
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='guard_whatsapp_template_entitlement';

\echo '6) explicit helper remains backward-compatible for unconfigured clinics'
SELECT pg_get_functiondef(p.oid) ILIKE '%IF NOT FOUND THEN%RETURN true%' AS unconfigured_allowed
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='clinic_entitlement_allowed';
