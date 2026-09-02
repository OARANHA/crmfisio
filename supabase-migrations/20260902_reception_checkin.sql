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

  SELECT * INTO v_row
  FROM public.appointments
  WHERE id = p_appointment_id
    AND clinic_id = public.current_clinic_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada' USING ERRCODE = 'P0002';
  END IF;

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
  WHERE id = p_appointment_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_appointment_arrival(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_appointment_arrival(uuid, boolean) TO authenticated;

COMMIT;
