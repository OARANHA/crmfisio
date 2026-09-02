-- MEDICSPRO — check-in operacional sem misturar chegada com status clínico
BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_arrived_today_idx
  ON public.appointments (clinic_id, data, arrived_at)
  WHERE arrived_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_appointment_arrival(
  p_appointment_id uuid,
  p_arrived boolean DEFAULT true
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row public.appointments;
BEGIN
  v_role := public.current_app_role();
  IF v_role NOT IN ('owner','admin','recep','fisio') THEN
    RAISE EXCEPTION 'Perfil sem permissão para check-in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.appointments
  WHERE id = p_appointment_id AND clinic_id = public.current_clinic_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada' USING ERRCODE = 'P0002'; END IF;
  IF v_role = 'fisio' AND v_row.fisio_id <> auth.uid() THEN
    RAISE EXCEPTION 'Fisioterapeuta só pode operar a própria agenda' USING ERRCODE = '42501';
  END IF;
  IF v_row.status IN ('finalizado','faltou','cancelado') THEN
    RAISE EXCEPTION 'Check-in indisponível para sessão encerrada';
  END IF;

  UPDATE public.appointments
  SET arrived_at = CASE WHEN p_arrived THEN now() ELSE NULL END,
      arrived_by = CASE WHEN p_arrived THEN auth.uid() ELSE NULL END,
      updated_at = now()
  WHERE id = p_appointment_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reception_today_queue()
RETURNS TABLE (
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  patient_phone text,
  professional_id uuid,
  professional_name text,
  room_name text,
  unit_name text,
  inicio time,
  fim time,
  status text,
  tipo text,
  arrived_at timestamptz,
  whatsapp_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.paciente_id,
    p.nome,
    coalesce(p.telefone, ''),
    a.fisio_id,
    pr.nome,
    coalesce(r.nome, ''),
    coalesce(u.nome, ''),
    a.inicio,
    a.fim,
    a.status::text,
    a.tipo,
    a.arrived_at,
    (
      SELECT CASE
        WHEN wl.reply_text IS NOT NULL THEN 'confirmado'
        WHEN wl.read_at IS NOT NULL THEN 'lido'
        WHEN wl.delivered_at IS NOT NULL THEN 'entregue'
        WHEN wl.sent_at IS NOT NULL THEN 'enviado'
        ELSE wl.status::text
      END
      FROM public.wa_logs wl
      WHERE wl.appointment_id = a.id AND wl.template = 'confirmacao'
      ORDER BY wl.created_at DESC LIMIT 1
    )
  FROM public.appointments a
  JOIN public.patients p ON p.id = a.paciente_id
  JOIN public.profiles pr ON pr.id = a.fisio_id
  LEFT JOIN public.rooms r ON r.id = a.room_id
  LEFT JOIN public.units u ON u.id = r.unit_id
  WHERE a.clinic_id = public.current_clinic_id()
    AND a.data = CURRENT_DATE
    AND (public.current_app_role() <> 'fisio' OR a.fisio_id = auth.uid())
  ORDER BY a.inicio, p.nome;
$$;

REVOKE ALL ON FUNCTION public.set_appointment_arrival(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reception_today_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_appointment_arrival(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reception_today_queue() TO authenticated;

COMMIT;
