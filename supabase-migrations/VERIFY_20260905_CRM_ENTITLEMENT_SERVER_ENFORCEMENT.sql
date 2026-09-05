\echo '1) trigger exists'
SELECT EXISTS (
  SELECT 1
  FROM pg_trigger
  WHERE tgrelid = 'public.patients'::regclass
    AND tgname = 'trg_guard_patient_crm_stage_entitlement'
    AND NOT tgisinternal
) AS ok;

\echo '2) trigger function contains crm entitlement gate'
SELECT
  p.proname,
  pg_get_functiondef(p.oid) ILIKE '%current_clinic_entitlement_allowed(''crm.access'')%' AS has_entitlement_gate
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'guard_patient_crm_stage_entitlement';

\echo '3) trigger is scoped to funnel-stage updates'
SELECT
  t.tgname,
  pg_get_triggerdef(t.oid) ILIKE '%BEFORE UPDATE OF funil_stage%' AS stage_only
FROM pg_trigger t
WHERE t.tgrelid = 'public.patients'::regclass
  AND t.tgname = 'trg_guard_patient_crm_stage_entitlement'
  AND NOT t.tgisinternal;

\echo '4) helper remains backward-compatible for unconfigured clinics'
SELECT
  pg_get_functiondef(p.oid) ILIKE '%IF NOT FOUND THEN%RETURN true%' AS unconfigured_allowed
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'current_clinic_entitlement_allowed';
