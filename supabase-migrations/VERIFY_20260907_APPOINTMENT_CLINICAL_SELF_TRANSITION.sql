\echo '1) clinical self-transition guard exists'
SELECT to_regprocedure('public.guard_appointment_clinical_self_transition()') IS NOT NULL AS ok;

\echo '2) appointments status trigger is installed'
SELECT EXISTS (
  SELECT 1
  FROM pg_trigger
  WHERE tgrelid = 'public.appointments'::regclass
    AND tgname = 'trg_appointment_clinical_self_transition'
    AND NOT tgisinternal
) AS ok;

\echo '3) guard fails closed for cross-professional fisio transitions'
WITH def AS (
  SELECT pg_get_functiondef('public.guard_appointment_clinical_self_transition()'::regprocedure) AS sql
)
SELECT
  sql ILIKE '%v_role = ''fisio''%'
  AND sql ILIKE '%OLD.fisio_id IS DISTINCT FROM auth.uid()%'
  AND sql ILIKE '%NEW.fisio_id IS DISTINCT FROM auth.uid()%'
  AND sql ILIKE '%clinical_appointment_self_transition_required%'
  AND sql ILIKE '%42501%'
  AS hardened
FROM def;

\echo '4) existing status workflow guard remains installed'
SELECT EXISTS (
  SELECT 1
  FROM pg_trigger
  WHERE tgrelid = 'public.appointments'::regclass
    AND tgname = 'trg_guard_appointment_status_transition'
    AND NOT tgisinternal
) AS ok;

\echo '5) evolution/session linkage remains installed'
SELECT EXISTS (
  SELECT 1
  FROM pg_trigger
  WHERE tgrelid = 'public.physiotherapy_evolutions'::regclass
    AND tgname = 'trg_evolutions_session_linkage'
    AND NOT tgisinternal
) AS ok;
