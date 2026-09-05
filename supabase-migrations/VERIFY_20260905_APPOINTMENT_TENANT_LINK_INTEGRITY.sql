\echo '1) appointment tenant-link guard function exists'
SELECT to_regprocedure('public.guard_appointment_tenant_links()') IS NOT NULL AS ok;

\echo '2) appointment tenant-link trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.appointments'::regclass
    AND tgname = 'trg_guard_appointment_tenant_links'
    AND NOT tgisinternal
) AS ok;

\echo '3) patient tenant linkage is guarded'
SELECT pg_get_functiondef('public.guard_appointment_tenant_links()'::regprocedure)
  ILIKE '%appointment_patient_tenant_mismatch%' AS patient_guarded;

\echo '4) professional tenant linkage is guarded'
SELECT pg_get_functiondef('public.guard_appointment_tenant_links()'::regprocedure)
  ILIKE '%appointment_professional_tenant_mismatch%' AS professional_guarded;

\echo '5) room tenant linkage is guarded'
SELECT pg_get_functiondef('public.guard_appointment_tenant_links()'::regprocedure)
  ILIKE '%appointment_room_tenant_mismatch%' AS room_guarded;

\echo '6) trigger covers inserts'
SELECT pg_get_triggerdef(oid) ILIKE '%BEFORE INSERT%' AS insert_guarded
FROM pg_trigger
WHERE tgrelid = 'public.appointments'::regclass
  AND tgname = 'trg_guard_appointment_tenant_links';

\echo '7) trigger covers tenant-link updates'
SELECT pg_get_triggerdef(oid) ILIKE '%UPDATE OF clinic_id, paciente_id, fisio_id, room_id%' AS update_guarded
FROM pg_trigger
WHERE tgrelid = 'public.appointments'::regclass
  AND tgname = 'trg_guard_appointment_tenant_links';

\echo '8) no current appointment/patient tenant mismatches'
SELECT NOT EXISTS (
  SELECT 1
  FROM public.appointments a
  LEFT JOIN public.patients p ON p.id = a.paciente_id
  WHERE p.id IS NULL OR p.clinic_id IS DISTINCT FROM a.clinic_id
) AS no_patient_mismatches;

\echo '9) no current appointment/professional tenant mismatches'
SELECT NOT EXISTS (
  SELECT 1
  FROM public.appointments a
  LEFT JOIN public.profiles pr ON pr.id = a.fisio_id
  WHERE pr.id IS NULL OR pr.clinic_id IS DISTINCT FROM a.clinic_id
) AS no_professional_mismatches;

\echo '10) no current appointment/room tenant mismatches and clients cannot execute guard directly'
SELECT
  NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    LEFT JOIN public.rooms r ON r.id = a.room_id
    WHERE a.room_id IS NOT NULL
      AND (r.id IS NULL OR r.clinic_id IS DISTINCT FROM a.clinic_id)
  ) AS no_room_mismatches,
  NOT has_function_privilege('authenticated', 'public.guard_appointment_tenant_links()', 'EXECUTE') AS authenticated_denied,
  NOT has_function_privilege('anon', 'public.guard_appointment_tenant_links()', 'EXECUTE') AS anon_denied;
