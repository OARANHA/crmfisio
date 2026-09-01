-- MEDICSPRO — corrige elegibilidade de confirmação usando horário operacional da clínica
BEGIN;

CREATE OR REPLACE FUNCTION public.queue_selected_appointment_confirmations(
  p_appointment_ids uuid[],
  p_hours integer DEFAULT 48
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.current_clinic_id();
  v_role text := public.current_app_role();
  v_count integer := 0;
  v_now_local timestamp := timezone('America/Sao_Paulo', now());
  r record;
  v_message text;
BEGIN
  IF v_role NOT IN ('owner','admin','recep') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501';
  END IF;

  IF coalesce(array_length(p_appointment_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  PERFORM public.ensure_default_message_templates();

  FOR r IN
    SELECT a.id AS appointment_id, a.paciente_id
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.paciente_id AND p.clinic_id = a.clinic_id
    WHERE a.id = ANY(p_appointment_ids)
      AND a.clinic_id = v_clinic
      AND a.status IN ('agendado','confirmado')
      AND p.opt_in_whats = true
      AND p.anonimizado = false
      AND coalesce(trim(p.telefone), '') <> ''
      AND (a.data + a.inicio) >= v_now_local
      AND (a.data + a.inicio) <= v_now_local + make_interval(hours => greatest(1, p_hours))
      AND NOT EXISTS (
        SELECT 1
        FROM public.wa_logs w
        WHERE w.appointment_id = a.id
          AND w.template = 'confirmacao'
          AND w.status IN ('fila','enviando','enviado','entregue','lido')
      )
    ORDER BY a.data, a.inicio
  LOOP
    v_message := public.render_message_template(v_clinic, 'confirmacao', r.paciente_id, r.appointment_id, NULL);

    INSERT INTO public.wa_logs (
      clinic_id, patient_id, appointment_id, template, mensagem,
      enviado_em, status, scheduled_for, created_by
    ) VALUES (
      v_clinic, r.paciente_id, r.appointment_id, 'confirmacao', v_message,
      now(), 'fila', now(), auth.uid()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_selected_appointment_confirmations(uuid[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_selected_appointment_confirmations(uuid[], integer) TO authenticated;

COMMIT;
