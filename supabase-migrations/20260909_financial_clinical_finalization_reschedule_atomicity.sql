-- MEDICSPRO — Financial/Clinical Finalization Boundary: atomic package-preserving reschedule
-- Keeps package-capacity enforcement strict while allowing a canonical reschedule
-- to transfer the single active reservation inside one PostgreSQL transaction.

BEGIN;

-- The detection queue is intentionally not generically resolvable yet. A future
-- canonical financial-disposition RPC must materialize the business decision
-- (receivable, waiver/complimentary, or another approved disposition) atomically.
REVOKE UPDATE ON public.appointment_financial_exceptions FROM service_role;

COMMENT ON TABLE public.appointment_financial_exceptions IS
  'Tenant-scoped financial coverage exception detection queue. Application writes are append-only; resolution requires a future canonical financial-disposition contract.';

-- Preserve the effective public API and authorization contract from
-- 20260901_appointment_reschedule.sql. The only semantic change is operation
-- ordering: release the source reservation by cancelling the original first,
-- then insert the replacement. Both statements execute inside the same RPC
-- transaction, so any failure while creating the replacement rolls the source
-- cancellation back automatically.
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

  -- Release only the canonical source appointment's active reservation. This is
  -- not a reservation-boundary bypass: the ordinary UPDATE triggers still run,
  -- including cancellation-reason, status-transition and mutation guards.
  UPDATE public.appointments
  SET status = 'cancelado',
      cancellation_reason = coalesce(nullif(trim(p_reason), ''), 'Remarcado para novo horário'),
      updated_at = now()
  WHERE id = old_app.id;

  -- The normal INSERT path now observes the source as cancelled and therefore
  -- must pass the same serialized package-capacity and agenda-conflict guards as
  -- every other appointment. rescheduled_from_id grants no special privilege.
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

  RETURN new_app;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, date, time, time, uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, date, time, time, uuid, uuid, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.reschedule_appointment(uuid, date, time, time, uuid, uuid, text, boolean) IS
  'Atomically transfers an appointment to a replacement slot: cancels the locked source, then creates the replacement through normal conflict/package-capacity guards; any replacement failure rolls the source cancellation back.';

COMMIT;
