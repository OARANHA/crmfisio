\echo '1) professional active-session unique index exists'
SELECT to_regclass('public.appointments_one_active_session_per_professional_uidx') IS NOT NULL AS ok;

\echo '2) patient active-session unique index exists'
SELECT to_regclass('public.appointments_one_active_session_per_patient_uidx') IS NOT NULL AS ok;

\echo '3) professional index is unique'
SELECT i.indisunique AS professional_unique
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname = 'appointments_one_active_session_per_professional_uidx';

\echo '4) patient index is unique'
SELECT i.indisunique AS patient_unique
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname = 'appointments_one_active_session_per_patient_uidx';

\echo '5) professional index is scoped to em_atendimento'
SELECT pg_get_expr(i.indpred, i.indrelid) ILIKE '%em_atendimento%' AS active_scoped
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname = 'appointments_one_active_session_per_professional_uidx';

\echo '6) patient index is scoped to em_atendimento'
SELECT pg_get_expr(i.indpred, i.indrelid) ILIKE '%em_atendimento%' AS active_scoped
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname = 'appointments_one_active_session_per_patient_uidx';

\echo '7) professional index keys include clinic and fisio'
SELECT pg_get_indexdef(i.indexrelid) ILIKE '%(clinic_id, fisio_id)%' AS professional_keys
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname = 'appointments_one_active_session_per_professional_uidx';

\echo '8) patient index keys include clinic and patient'
SELECT pg_get_indexdef(i.indexrelid) ILIKE '%(clinic_id, paciente_id)%' AS patient_keys
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname = 'appointments_one_active_session_per_patient_uidx';

\echo '9) no professional currently has concurrent active sessions'
SELECT NOT EXISTS (
  SELECT 1
  FROM public.appointments
  WHERE status = 'em_atendimento' AND fisio_id IS NOT NULL
  GROUP BY clinic_id, fisio_id
  HAVING count(*) > 1
) AS no_professional_conflicts;

\echo '10) no patient currently has concurrent active sessions'
SELECT NOT EXISTS (
  SELECT 1
  FROM public.appointments
  WHERE status = 'em_atendimento' AND paciente_id IS NOT NULL
  GROUP BY clinic_id, paciente_id
  HAVING count(*) > 1
) AS no_patient_conflicts;
