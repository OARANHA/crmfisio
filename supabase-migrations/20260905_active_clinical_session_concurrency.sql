-- MEDICSPRO — active clinical session concurrency hardening
-- Prevents one professional or one patient from being in more than one
-- em_atendimento appointment at the same time.

BEGIN;

DO $$
DECLARE
  v_duplicate_professional record;
  v_duplicate_patient record;
BEGIN
  SELECT clinic_id, fisio_id, count(*) AS active_count
    INTO v_duplicate_professional
  FROM public.appointments
  WHERE status = 'em_atendimento'
    AND fisio_id IS NOT NULL
  GROUP BY clinic_id, fisio_id
  HAVING count(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Existing concurrent active sessions for professional % in clinic % (% rows)',
      v_duplicate_professional.fisio_id,
      v_duplicate_professional.clinic_id,
      v_duplicate_professional.active_count
      USING ERRCODE = '23505';
  END IF;

  SELECT clinic_id, paciente_id, count(*) AS active_count
    INTO v_duplicate_patient
  FROM public.appointments
  WHERE status = 'em_atendimento'
    AND paciente_id IS NOT NULL
  GROUP BY clinic_id, paciente_id
  HAVING count(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Existing concurrent active sessions for patient % in clinic % (% rows)',
      v_duplicate_patient.paciente_id,
      v_duplicate_patient.clinic_id,
      v_duplicate_patient.active_count
      USING ERRCODE = '23505';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_active_session_per_professional_uidx
  ON public.appointments (clinic_id, fisio_id)
  WHERE status = 'em_atendimento' AND fisio_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_active_session_per_patient_uidx
  ON public.appointments (clinic_id, paciente_id)
  WHERE status = 'em_atendimento' AND paciente_id IS NOT NULL;

COMMENT ON INDEX public.appointments_one_active_session_per_professional_uidx IS
  'At most one em_atendimento appointment per professional and clinic.';

COMMENT ON INDEX public.appointments_one_active_session_per_patient_uidx IS
  'At most one em_atendimento appointment per patient and clinic.';

COMMIT;
