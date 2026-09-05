-- MEDICSPRO — verifier: clinical evolution/session linkage hardening

SELECT '1) evolution/session linkage guard function exists' AS check;
SELECT to_regprocedure('public.guard_clinical_evolution_session_linkage()') IS NOT NULL AS ok;

SELECT '2) evolution/session linkage trigger exists' AS check;
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.physiotherapy_evolutions'::regclass
    AND tgname = 'trg_evolutions_session_linkage'
    AND NOT tgisinternal
) AS ok;

SELECT '3) authenticated inserts require a session' AS check;
SELECT pg_get_functiondef('public.guard_clinical_evolution_session_linkage()'::regprocedure)
  LIKE '%clinical_evolution_session_required%' AS session_required;

SELECT '4) linked appointment must exist' AS check;
SELECT pg_get_functiondef('public.guard_clinical_evolution_session_linkage()'::regprocedure)
  LIKE '%clinical_evolution_session_not_found%' AS appointment_required;

SELECT '5) clinic linkage is validated' AS check;
SELECT pg_get_functiondef('public.guard_clinical_evolution_session_linkage()'::regprocedure)
  LIKE '%v_appointment.clinic_id IS DISTINCT FROM NEW.clinic_id%' AS clinic_guarded;

SELECT '6) patient linkage is validated' AS check;
SELECT pg_get_functiondef('public.guard_clinical_evolution_session_linkage()'::regprocedure)
  LIKE '%v_appointment.paciente_id IS DISTINCT FROM NEW.patient_id%' AS patient_guarded;

SELECT '7) professional linkage is validated' AS check;
SELECT pg_get_functiondef('public.guard_clinical_evolution_session_linkage()'::regprocedure)
  LIKE '%v_appointment.fisio_id IS DISTINCT FROM NEW.professional_id%' AS professional_guarded;

SELECT '8) new evolution requires active appointment' AS check;
SELECT pg_get_functiondef('public.guard_clinical_evolution_session_linkage()'::regprocedure)
  LIKE '%v_appointment.status <> ''em_atendimento''%' AS active_session_required;

SELECT '9) clinical linkage fields are immutable' AS check;
SELECT pg_get_functiondef('public.guard_clinical_evolution_session_linkage()'::regprocedure)
  LIKE '%clinical_evolution_linkage_immutable%' AS linkage_immutable;

SELECT '10) authenticated and anon cannot execute guard directly' AS check;
SELECT
  NOT has_function_privilege('authenticated', 'public.guard_clinical_evolution_session_linkage()', 'EXECUTE') AS authenticated_denied,
  NOT has_function_privilege('anon', 'public.guard_clinical_evolution_session_linkage()', 'EXECUTE') AS anon_denied;