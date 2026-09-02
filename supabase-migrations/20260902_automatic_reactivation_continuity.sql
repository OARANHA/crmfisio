-- MEDICSPRO — reativação automática controlada de pacientes sem continuidade
BEGIN;

ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS reactivation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reactivation_inactive_days integer NOT NULL DEFAULT 30 CHECK (reactivation_inactive_days BETWEEN 7 AND 180),
  ADD COLUMN IF NOT EXISTS reactivation_cooldown_days integer NOT NULL DEFAULT 30 CHECK (reactivation_cooldown_days BETWEEN 7 AND 180),
  ADD COLUMN IF NOT EXISTS reactivation_limit_per_run integer NOT NULL DEFAULT 10 CHECK (reactivation_limit_per_run BETWEEN 1 AND 100);

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS queued_reactivations integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.run_reactivation_auto_tick(p_run_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.automation_settings%ROWTYPE;
  r record;
  v_now_local timestamp;
  v_message text;
  v_clinic_count integer;
  v_total integer := 0;
BEGIN
  FOR cfg IN
    SELECT *
    FROM public.automation_settings
    WHERE active = true
      AND reactivation_enabled = true
    ORDER BY clinic_id
  LOOP
    v_now_local := timezone(cfg.timezone, now());

    IF v_now_local::time < cfg.send_window_start OR v_now_local::time >= cfg.send_window_end THEN
      CONTINUE;
    END IF;

    v_clinic_count := 0;

    FOR r IN
      WITH last_sessions AS (
        SELECT
          a.paciente_id,
          max(a.data + a.fim) AS last_finished_at
        FROM public.appointments a
        WHERE a.clinic_id = cfg.clinic_id
          AND a.status = 'finalizado'
        GROUP BY a.paciente_id
      )
      SELECT p.id AS patient_id
      FROM public.patients p
      JOIN last_sessions ls ON ls.paciente_id = p.id
      WHERE p.clinic_id = cfg.clinic_id
        AND p.status <> 'alta'
        AND p.anonimizado = false
        AND p.opt_in_whats = true
        AND coalesce(trim(p.telefone), '') <> ''
        AND ls.last_finished_at <= v_now_local - make_interval(days => cfg.reactivation_inactive_days)
        AND NOT EXISTS (
          SELECT 1
          FROM public.appointments future
          WHERE future.clinic_id = cfg.clinic_id
            AND future.paciente_id = p.id
            AND future.status IN ('agendado','confirmado','em_atendimento')
            AND (future.data + future.inicio) >= v_now_local
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.wa_logs w
          WHERE w.clinic_id = cfg.clinic_id
            AND w.patient_id = p.id
            AND w.template = 'reativacao'
            AND w.created_at >= now() - make_interval(days => cfg.reactivation_cooldown_days)
            AND w.status IN ('fila','enviando','enviado','entregue','lido')
        )
      ORDER BY ls.last_finished_at, p.nome
      LIMIT cfg.reactivation_limit_per_run
    LOOP
      v_message := public.render_message_template(cfg.clinic_id, 'reativacao', r.patient_id, NULL, NULL);

      INSERT INTO public.wa_logs (
        clinic_id,
        patient_id,
        template,
        mensagem,
        enviado_em,
        status,
        scheduled_for,
        created_by
      ) VALUES (
        cfg.clinic_id,
        r.patient_id,
        'reativacao',
        v_message,
        now(),
        'fila',
        now(),
        NULL
      );

      v_clinic_count := v_clinic_count + 1;
      v_total := v_total + 1;
    END LOOP;
  END LOOP;

  IF p_run_id IS NOT NULL THEN
    UPDATE public.automation_runs
    SET queued_reactivations = v_total
    WHERE id = p_run_id;
  END IF;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.run_reactivation_auto_tick(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_reactivation_auto_tick(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_reactivation_auto_tick(uuid) TO service_role;

COMMIT;
