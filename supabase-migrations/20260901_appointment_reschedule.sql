-- MEDICSPRO — remarcação, encaixe e motivo operacional
BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_fit_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_from_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_rescheduled_from_idx
  ON public.appointments (rescheduled_from_id)
  WHERE rescheduled_from_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cancel_appointment_with_reason(
  p_appointment_id uuid,
  p_reason text
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app public.appointments;
  app_role text;
BEGIN
  app_role := public.current_app_role();
  IF app_role NOT IN ('owner', 'admin', 'recep', 'fisio') THEN
    RAISE EXCEPTION 'Perfil sem permissão para cancelar atendimento' USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO app
  FROM public.appointments
  WHERE id = p_appointment_id
    AND clinic_id = public.current_clinic_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF app.status NOT IN ('agendado', 'confirmado') THEN
    RAISE EXCEPTION 'Somente atendimentos agendados ou confirmados podem ser cancelados' USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelado',
      cancellation_reason = trim(p_reason),
      updated_at = now()
  WHERE id = p_appointment_id
  RETURNING * INTO app;

  RETURN app;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_data date,
  p_inicio time,
  p_fim time,
  p_fisio_id uuid,
  p_room_id uuid,
  p_reason text DEFAULT 'Remarcação solicitada',
  p_is_fit_in boolean DEFAULT false
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_app public.appointments;
  new_app public.appointments;
  app_role text;
BEGIN
  app_role := public.current_app_role();
  IF app_role NOT IN ('owner', 'admin', 'recep') THEN
    RAISE EXCEPTION 'Somente administração e recepção podem remarcar atendimentos' USING ERRCODE = '42501';
  END IF;

  IF p_fim <= p_inicio THEN
    RAISE EXCEPTION 'Horário final deve ser posterior ao inicial' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO old_app
  FROM public.appointments
  WHERE id = p_appointment_id
    AND clinic_id = public.current_clinic_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF old_app.status NOT IN ('agendado', 'confirmado') THEN
    RAISE EXCEPTION 'Somente atendimentos agendados ou confirmados podem ser remarcados' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.appointments (
    clinic_id,
    paciente_id,
    fisio_id,
    room_id,
    data,
    inicio,
    fim,
    status,
    tipo,
    valor,
    pacote_id,
    serie_id,
    notas,
    is_fit_in,
    rescheduled_from_id
  ) VALUES (
    old_app.clinic_id,
    old_app.paciente_id,
    p_fisio_id,
    p_room_id,
    p_data,
    p_inicio,
    p_fim,
    'agendado',
    old_app.tipo,
    old_app.valor,
    old_app.pacote_id,
    old_app.serie_id,
    old_app.notas,
    coalesce(p_is_fit_in, false),
    old_app.id
  )
  RETURNING * INTO new_app;

  UPDATE public.appointments
  SET status = 'cancelado',
      cancellation_reason = coalesce(nullif(trim(p_reason), ''), 'Remarcado para novo horário'),
      updated_at = now()
  WHERE id = old_app.id;

  RETURN new_app;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_appointment_with_reason(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, date, time, time, uuid, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_with_reason(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, date, time, time, uuid, uuid, text, boolean) TO authenticated;

COMMIT;
