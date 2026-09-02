-- MEDICSPRO — recorrência persistente com prévia transacional de conflitos
BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  fisio_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  room_id uuid,
  tipo text NOT NULL,
  dias_semana smallint[] NOT NULL,
  hora time NOT NULL,
  duracao_min integer NOT NULL CHECK (duracao_min BETWEEN 15 AND 240),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  valor integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'concluida')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  CHECK (data_fim >= data_inicio),
  CHECK (cardinality(dias_semana) BETWEEN 1 AND 7)
);

CREATE INDEX IF NOT EXISTS appointment_series_clinic_idx
  ON public.appointment_series (clinic_id, status, data_inicio DESC);
CREATE INDEX IF NOT EXISTS appointment_series_patient_idx
  ON public.appointment_series (paciente_id, data_inicio DESC);

ALTER TABLE public.appointment_series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appointment_series_select_tenant ON public.appointment_series;
CREATE POLICY appointment_series_select_tenant
ON public.appointment_series FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

GRANT SELECT ON public.appointment_series TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_appointment_series(
  p_paciente_id uuid,
  p_fisio_id uuid,
  p_room_id uuid,
  p_dias_semana smallint[],
  p_hora time,
  p_duracao_min integer,
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE (
  data date,
  inicio time,
  fim time,
  available boolean,
  conflict_kind text,
  conflict_detail text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH requested AS (
  SELECT d::date AS data,
         p_hora AS inicio,
         (p_hora + make_interval(mins => p_duracao_min))::time AS fim
  FROM generate_series(p_data_inicio, p_data_fim, interval '1 day') d
  WHERE extract(isodow FROM d)::smallint = ANY(p_dias_semana)
), checked AS (
  SELECT r.*,
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.clinic_id = public.current_clinic_id()
        AND a.data = r.data AND a.status <> 'cancelado'
        AND a.fisio_id = p_fisio_id
        AND r.inicio < a.fim AND a.inicio < r.fim
    ) AS professional_conflict,
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.clinic_id = public.current_clinic_id()
        AND a.data = r.data AND a.status <> 'cancelado'
        AND p_room_id IS NOT NULL AND a.room_id = p_room_id
        AND r.inicio < a.fim AND a.inicio < r.fim
    ) AS room_conflict,
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.clinic_id = public.current_clinic_id()
        AND a.data = r.data AND a.status <> 'cancelado'
        AND a.paciente_id = p_paciente_id
        AND r.inicio < a.fim AND a.inicio < r.fim
    ) AS patient_conflict
  FROM requested r
)
SELECT c.data, c.inicio, c.fim,
       NOT (c.professional_conflict OR c.room_conflict OR c.patient_conflict) AS available,
       CASE WHEN c.professional_conflict THEN 'professional'
            WHEN c.room_conflict THEN 'room'
            WHEN c.patient_conflict THEN 'patient'
            ELSE NULL END AS conflict_kind,
       CASE WHEN c.professional_conflict THEN 'Profissional já ocupado neste horário'
            WHEN c.room_conflict THEN 'Sala/recurso já ocupado neste horário'
            WHEN c.patient_conflict THEN 'Paciente já possui atendimento neste horário'
            ELSE NULL END AS conflict_detail
FROM checked c
ORDER BY c.data;
$$;

CREATE OR REPLACE FUNCTION public.create_appointment_series(
  p_paciente_id uuid,
  p_fisio_id uuid,
  p_room_id uuid,
  p_tipo text,
  p_dias_semana smallint[],
  p_hora time,
  p_duracao_min integer,
  p_data_inicio date,
  p_data_fim date,
  p_valor integer,
  p_skip_conflicts boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_clinic uuid;
  v_series_id uuid;
  v_slot record;
  v_created integer := 0;
  v_skipped integer := 0;
BEGIN
  v_role := public.current_app_role();
  v_clinic := public.current_clinic_id();

  IF v_role NOT IN ('owner', 'admin', 'recep') THEN
    RAISE EXCEPTION 'Somente administração e recepção podem criar recorrências' USING ERRCODE = '42501';
  END IF;
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'Clínica não identificada' USING ERRCODE = '42501'; END IF;
  IF p_data_fim < p_data_inicio THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE = '22023'; END IF;
  IF p_duracao_min < 15 OR p_duracao_min > 240 THEN RAISE EXCEPTION 'Duração inválida' USING ERRCODE = '22023'; END IF;
  IF cardinality(p_dias_semana) IS NULL OR cardinality(p_dias_semana) = 0 THEN RAISE EXCEPTION 'Selecione ao menos um dia da semana' USING ERRCODE = '22023'; END IF;

  -- Garante que paciente, profissional e sala pertencem ao tenant atual antes de persistir.
  IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id = p_paciente_id AND clinic_id = v_clinic AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_fisio_id AND clinic_id = v_clinic AND ativo = true) THEN
    RAISE EXCEPTION 'Profissional inválido para esta clínica' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.appointment_series (
    clinic_id, paciente_id, fisio_id, room_id, tipo, dias_semana, hora,
    duracao_min, data_inicio, data_fim, valor, created_by
  ) VALUES (
    v_clinic, p_paciente_id, p_fisio_id, p_room_id, trim(p_tipo), p_dias_semana,
    p_hora, p_duracao_min, p_data_inicio, p_data_fim, p_valor, auth.uid()
  ) RETURNING id INTO v_series_id;

  FOR v_slot IN
    SELECT * FROM public.preview_appointment_series(
      p_paciente_id, p_fisio_id, p_room_id, p_dias_semana,
      p_hora, p_duracao_min, p_data_inicio, p_data_fim
    )
  LOOP
    IF NOT v_slot.available THEN
      IF NOT p_skip_conflicts THEN
        RAISE EXCEPTION 'Conflito em %: %', v_slot.data, v_slot.conflict_detail USING ERRCODE = 'P0001';
      END IF;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.appointments (
      clinic_id, paciente_id, fisio_id, room_id, data, inicio, fim,
      status, tipo, valor, pacote_id, serie_id, notas
    ) VALUES (
      v_clinic, p_paciente_id, p_fisio_id, p_room_id, v_slot.data,
      v_slot.inicio, v_slot.fim, 'agendado', trim(p_tipo), p_valor, NULL,
      v_series_id, 'Gerado por série recorrente'
    );
    v_created := v_created + 1;
  END LOOP;

  IF v_created = 0 THEN
    RAISE EXCEPTION 'Nenhum horário disponível para criar a série' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('series_id', v_series_id, 'created', v_created, 'skipped', v_skipped);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment_series(
  p_series_id uuid,
  p_reason text DEFAULT 'Série cancelada'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_clinic uuid := public.current_clinic_id();
  v_cancelled integer := 0;
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'recep') THEN
    RAISE EXCEPTION 'Perfil sem permissão para cancelar séries' USING ERRCODE = '42501';
  END IF;
  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento' USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelado', cancellation_reason = trim(p_reason), updated_at = now()
  WHERE clinic_id = v_clinic
    AND serie_id = p_series_id
    AND data >= current_date
    AND status IN ('agendado', 'confirmado');
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.appointment_series
  SET status = 'cancelada', cancelled_at = now(), cancellation_reason = trim(p_reason), updated_at = now()
  WHERE id = p_series_id AND clinic_id = v_clinic;

  IF NOT FOUND THEN RAISE EXCEPTION 'Série não encontrada' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('series_id', p_series_id, 'cancelled_appointments', v_cancelled);
END;
$$;

REVOKE ALL ON FUNCTION public.preview_appointment_series(uuid, uuid, uuid, smallint[], time, integer, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_appointment_series(uuid, uuid, uuid, text, smallint[], time, integer, date, date, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_appointment_series(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_appointment_series(uuid, uuid, uuid, smallint[], time, integer, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_series(uuid, uuid, uuid, text, smallint[], time, integer, date, date, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_series(uuid, text) TO authenticated;

COMMIT;
