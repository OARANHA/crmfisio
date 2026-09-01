-- MEDICSPRO — Proteção transacional contra conflitos de agenda
BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_appointment_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict record;
BEGIN
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF NEW.fim <= NEW.inicio THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = '[AGENDA_INVALID] O horário final deve ser posterior ao horário inicial.';
  END IF;

  -- Serializa gravações concorrentes do mesmo profissional e sala no mesmo dia.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.clinic_id::text || ':professional:' || NEW.fisio_id::text || ':' || NEW.data::text, 0));
  IF NEW.room_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.clinic_id::text || ':room:' || NEW.room_id::text || ':' || NEW.data::text, 0));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.clinic_id::text || ':patient:' || NEW.paciente_id::text || ':' || NEW.data::text, 0));

  SELECT a.id, a.inicio, a.fim INTO v_conflict
  FROM public.appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.id IS DISTINCT FROM NEW.id
    AND a.data = NEW.data
    AND a.status <> 'cancelado'
    AND a.fisio_id = NEW.fisio_id
    AND NEW.inicio < a.fim
    AND a.inicio < NEW.fim
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format('[AGENDA_CONFLICT_PROFESSIONAL] Profissional ocupado entre %s e %s.', v_conflict.inicio, v_conflict.fim);
  END IF;

  IF NEW.room_id IS NOT NULL THEN
    SELECT a.id, a.inicio, a.fim INTO v_conflict
    FROM public.appointments a
    WHERE a.clinic_id = NEW.clinic_id
      AND a.id IS DISTINCT FROM NEW.id
      AND a.data = NEW.data
      AND a.status <> 'cancelado'
      AND a.room_id = NEW.room_id
      AND NEW.inicio < a.fim
      AND a.inicio < NEW.fim
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format('[AGENDA_CONFLICT_ROOM] Sala/recurso ocupado entre %s e %s.', v_conflict.inicio, v_conflict.fim);
    END IF;
  END IF;

  SELECT a.id, a.inicio, a.fim INTO v_conflict
  FROM public.appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.id IS DISTINCT FROM NEW.id
    AND a.data = NEW.data
    AND a.status <> 'cancelado'
    AND a.paciente_id = NEW.paciente_id
    AND NEW.inicio < a.fim
    AND a.inicio < NEW.fim
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format('[AGENDA_CONFLICT_PATIENT] Paciente já possui atendimento entre %s e %s.', v_conflict.inicio, v_conflict.fim);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_appointment_conflicts ON public.appointments;
CREATE TRIGGER trg_prevent_appointment_conflicts
BEFORE INSERT OR UPDATE OF clinic_id, paciente_id, fisio_id, room_id, data, inicio, fim, status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_appointment_conflicts();

REVOKE ALL ON FUNCTION public.prevent_appointment_conflicts() FROM PUBLIC;

COMMIT;
