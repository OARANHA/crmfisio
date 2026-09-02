-- MEDICSPRO — acesso clínico seguro às recorrências
-- Fisioterapeutas podem criar/cancelar apenas as próprias séries.
BEGIN;

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

  IF v_role NOT IN ('owner', 'admin', 'recep', 'fisio') THEN
    RAISE EXCEPTION 'Perfil sem permissão para criar recorrências' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'fisio' AND p_fisio_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Fisioterapeuta só pode criar recorrências para a própria agenda' USING ERRCODE = '42501';
  END IF;
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'Clínica não identificada' USING ERRCODE = '42501'; END IF;
  IF p_data_fim < p_data_inicio THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE = '22023'; END IF;
  IF p_duracao_min < 15 OR p_duracao_min > 240 THEN RAISE EXCEPTION 'Duração inválida' USING ERRCODE = '22023'; END IF;
  IF nullif(trim(p_tipo), '') IS NULL THEN RAISE EXCEPTION 'Tipo de atendimento obrigatório' USING ERRCODE = '22023'; END IF;
  IF p_valor < 0 THEN RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023'; END IF;
  IF cardinality(p_dias_semana) IS NULL OR cardinality(p_dias_semana) = 0 OR NOT (p_dias_semana <@ ARRAY[1,2,3,4,5,6,7]::smallint[]) THEN
    RAISE EXCEPTION 'Dias da semana inválidos' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_paciente_id AND clinic_id = v_clinic AND deleted_at IS NULL AND coalesce(anonimizado, false) = false
  ) THEN
    RAISE EXCEPTION 'Paciente inválido para esta clínica' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_fisio_id AND clinic_id = v_clinic AND ativo = true AND role IN ('fisio', 'owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para esta clínica' USING ERRCODE = '42501';
  END IF;
  IF p_room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.rooms WHERE id = p_room_id AND clinic_id = v_clinic AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Sala/recurso inválido para esta clínica' USING ERRCODE = '42501';
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
  v_series_fisio uuid;
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'recep', 'fisio') THEN
    RAISE EXCEPTION 'Perfil sem permissão para cancelar séries' USING ERRCODE = '42501';
  END IF;
  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento' USING ERRCODE = '22023';
  END IF;

  SELECT fisio_id INTO v_series_fisio
  FROM public.appointment_series
  WHERE id = p_series_id AND clinic_id = v_clinic;

  IF NOT FOUND THEN RAISE EXCEPTION 'Série não encontrada' USING ERRCODE = 'P0002'; END IF;
  IF v_role = 'fisio' AND v_series_fisio IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Fisioterapeuta só pode cancelar recorrências da própria agenda' USING ERRCODE = '42501';
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

  RETURN jsonb_build_object('series_id', p_series_id, 'cancelled_appointments', v_cancelled);
END;
$$;

REVOKE ALL ON FUNCTION public.create_appointment_series(uuid, uuid, uuid, text, smallint[], time, integer, date, date, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_appointment_series(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment_series(uuid, uuid, uuid, text, smallint[], time, integer, date, date, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_series(uuid, text) TO authenticated;

COMMIT;
