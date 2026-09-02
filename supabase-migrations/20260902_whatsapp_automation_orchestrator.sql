-- MEDICSPRO — orquestrador seguro de automações operacionais WhatsApp
BEGIN;

CREATE TABLE IF NOT EXISTS public.automation_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  confirmations_enabled boolean NOT NULL DEFAULT true,
  confirmation_hours integer NOT NULL DEFAULT 48 CHECK (confirmation_hours BETWEEN 1 AND 168),
  nps_enabled boolean NOT NULL DEFAULT true,
  nps_delay_minutes integer NOT NULL DEFAULT 15 CHECK (nps_delay_minutes BETWEEN 0 AND 1440),
  nps_lookback_days integer NOT NULL DEFAULT 7 CHECK (nps_lookback_days BETWEEN 1 AND 90),
  send_window_start time NOT NULL DEFAULT time '08:00',
  send_window_end time NOT NULL DEFAULT time '20:00',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.automation_settings (clinic_id)
SELECT id FROM public.clinics
ON CONFLICT (clinic_id) DO NOTHING;

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_settings_select_tenant ON public.automation_settings;
CREATE POLICY automation_settings_select_tenant
ON public.automation_settings
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS automation_settings_write_admin ON public.automation_settings;
CREATE POLICY automation_settings_write_admin
ON public.automation_settings
FOR ALL TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
);

GRANT SELECT, INSERT, UPDATE ON public.automation_settings TO authenticated;

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger_source text NOT NULL DEFAULT 'scheduler',
  queued_confirmations integer NOT NULL DEFAULT 0,
  queued_nps integer NOT NULL DEFAULT 0,
  expired_waitlist_offers integer NOT NULL DEFAULT 0,
  worker_processed integer NOT NULL DEFAULT 0,
  worker_sent integer NOT NULL DEFAULT 0,
  worker_failed integer NOT NULL DEFAULT 0,
  clinics_processed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','completed','failed')),
  error_message text
);

CREATE INDEX IF NOT EXISTS automation_runs_started_idx
  ON public.automation_runs (started_at DESC);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_runs_select_admin ON public.automation_runs;
CREATE POLICY automation_runs_select_admin
ON public.automation_runs
FOR SELECT TO authenticated
USING (public.current_app_role() IN ('owner','admin'));
GRANT SELECT ON public.automation_runs TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_automation_settings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_automation_settings ON public.automation_settings;
CREATE TRIGGER trg_touch_automation_settings
BEFORE UPDATE ON public.automation_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_automation_settings();

CREATE OR REPLACE FUNCTION public.run_whatsapp_automation_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.automation_settings%ROWTYPE;
  r record;
  v_run_id uuid;
  v_now_local timestamp;
  v_rows integer := 0;
  v_confirmations integer := 0;
  v_nps integer := 0;
  v_expired integer := 0;
  v_clinics integer := 0;
  v_message text;
BEGIN
  INSERT INTO public.automation_runs (status)
  VALUES ('queued')
  RETURNING id INTO v_run_id;

  BEGIN
    -- Expiração é segura para todas as clínicas e não dispara mensagens.
    IF to_regprocedure('public.expire_waitlist_offers()') IS NOT NULL THEN
      SELECT public.expire_waitlist_offers() INTO v_expired;
    END IF;

    FOR cfg IN
      SELECT * FROM public.automation_settings WHERE active = true ORDER BY clinic_id
    LOOP
      v_clinics := v_clinics + 1;
      v_now_local := timezone(cfg.timezone, now());

      -- Evita disparos fora da janela configurada, inclusive se o scheduler rodar 24/7.
      IF v_now_local::time < cfg.send_window_start OR v_now_local::time >= cfg.send_window_end THEN
        CONTINUE;
      END IF;

      INSERT INTO public.message_templates (clinic_id, template, body, ativo)
      VALUES
        (cfg.clinic_id, 'confirmacao', 'Olá, {nome}! Sua sessão de {tipo} está marcada para {data} às {hora}. Responda SIM para confirmar.', true),
        (cfg.clinic_id, 'nps', 'Olá, {nome}! Como você avalia seu atendimento recente? Responda de 0 a 10.', true),
        (cfg.clinic_id, 'reativacao', 'Olá, {nome}! Sentimos sua falta. Que tal retomar seu tratamento? Temos horários disponíveis.', true),
        (cfg.clinic_id, 'vaga_espera', 'Olá, {nome}! Surgiu uma vaga em {data} às {hora} com {profissional}. Deseja aproveitar este horário? Responda SIM para confirmar o interesse.', true)
      ON CONFLICT (clinic_id, template) DO NOTHING;

      IF cfg.confirmations_enabled THEN
        FOR r IN
          SELECT a.id AS appointment_id, a.paciente_id
          FROM public.appointments a
          JOIN public.patients p
            ON p.id = a.paciente_id AND p.clinic_id = a.clinic_id
          WHERE a.clinic_id = cfg.clinic_id
            AND a.status IN ('agendado','confirmado')
            AND p.opt_in_whats = true
            AND p.anonimizado = false
            AND coalesce(trim(p.telefone),'') <> ''
            AND (a.data + a.inicio) >= v_now_local
            AND (a.data + a.inicio) <= v_now_local + make_interval(hours => cfg.confirmation_hours)
            AND NOT EXISTS (
              SELECT 1 FROM public.wa_logs w
              WHERE w.clinic_id = cfg.clinic_id
                AND w.appointment_id = a.id
                AND w.template = 'confirmacao'
                AND w.status IN ('fila','enviando','enviado','entregue','lido')
            )
          ORDER BY a.data, a.inicio
        LOOP
          v_message := public.render_message_template(cfg.clinic_id,'confirmacao',r.paciente_id,r.appointment_id,NULL);
          INSERT INTO public.wa_logs (
            clinic_id,patient_id,appointment_id,template,mensagem,enviado_em,status,scheduled_for,created_by
          ) VALUES (
            cfg.clinic_id,r.paciente_id,r.appointment_id,'confirmacao',v_message,now(),'fila',now(),NULL
          ) ON CONFLICT DO NOTHING;
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          v_confirmations := v_confirmations + v_rows;
        END LOOP;
      END IF;

      IF cfg.nps_enabled THEN
        FOR r IN
          SELECT a.id AS appointment_id, a.paciente_id
          FROM public.appointments a
          JOIN public.patients p
            ON p.id = a.paciente_id AND p.clinic_id = a.clinic_id
          JOIN LATERAL (
            SELECT h.changed_at
            FROM public.appointment_status_history h
            WHERE h.appointment_id = a.id
              AND h.clinic_id = a.clinic_id
              AND h.to_status = 'finalizado'
            ORDER BY h.changed_at DESC
            LIMIT 1
          ) finalized ON true
          WHERE a.clinic_id = cfg.clinic_id
            AND a.status = 'finalizado'
            AND p.opt_in_whats = true
            AND p.anonimizado = false
            AND coalesce(trim(p.telefone),'') <> ''
            AND finalized.changed_at <= now() - make_interval(mins => cfg.nps_delay_minutes)
            AND finalized.changed_at >= now() - make_interval(days => cfg.nps_lookback_days)
            AND NOT EXISTS (
              SELECT 1 FROM public.wa_logs w
              WHERE w.clinic_id = cfg.clinic_id
                AND w.appointment_id = a.id
                AND w.template = 'nps'
                AND w.status IN ('fila','enviando','enviado','entregue','lido')
            )
          ORDER BY finalized.changed_at
        LOOP
          v_message := public.render_message_template(cfg.clinic_id,'nps',r.paciente_id,r.appointment_id,NULL);
          INSERT INTO public.wa_logs (
            clinic_id,patient_id,appointment_id,template,mensagem,enviado_em,status,scheduled_for,created_by
          ) VALUES (
            cfg.clinic_id,r.paciente_id,r.appointment_id,'nps',v_message,now(),'fila',now(),NULL
          ) ON CONFLICT DO NOTHING;
          GET DIAGNOSTICS v_rows = ROW_COUNT;

          IF v_rows > 0 THEN
            INSERT INTO public.nps_surveys (clinic_id,patient_id,appointment_id,nota,comentario,data)
            VALUES (cfg.clinic_id,r.paciente_id,r.appointment_id,NULL,'',current_date)
            ON CONFLICT DO NOTHING;
            v_nps := v_nps + 1;
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    UPDATE public.automation_runs
    SET queued_confirmations = v_confirmations,
        queued_nps = v_nps,
        expired_waitlist_offers = coalesce(v_expired,0),
        clinics_processed = v_clinics
    WHERE id = v_run_id;

    RETURN jsonb_build_object(
      'run_id', v_run_id,
      'queued_confirmations', v_confirmations,
      'queued_nps', v_nps,
      'expired_waitlist_offers', coalesce(v_expired,0),
      'clinics_processed', v_clinics
    );
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.automation_runs
    SET finished_at = now(), status = 'failed', error_message = left(SQLERRM,800)
    WHERE id = v_run_id;
    RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.run_whatsapp_automation_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_whatsapp_automation_tick() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_whatsapp_automation_tick() TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.automation_runs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.automation_settings TO service_role;

COMMIT;
