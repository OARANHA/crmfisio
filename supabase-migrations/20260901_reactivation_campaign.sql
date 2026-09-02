-- MEDICSPRO — campanha controlada de reativação via WhatsApp
-- Elegibilidade operacional: última sessão finalizada antiga + nenhuma sessão futura.
BEGIN;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at timestamptz;

CREATE INDEX IF NOT EXISTS wa_logs_reactivation_patient_idx
  ON public.wa_logs (clinic_id, patient_id, created_at DESC)
  WHERE template = 'reativacao';

-- Remove a assinatura inicial do PR caso esta migration já tenha sido executada.
DROP FUNCTION IF EXISTS public.queue_selected_reactivation_campaign(uuid[],integer);
DROP FUNCTION IF EXISTS public.queue_selected_reactivation_campaign(uuid[],integer,integer);

CREATE FUNCTION public.queue_selected_reactivation_campaign(
  p_patient_ids uuid[],
  p_inactive_days integer DEFAULT 30,
  p_cooldown_days integer DEFAULT 30
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
  r record;
  v_message text;
  v_now timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  IF v_role NOT IN ('owner','admin','recep') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE='42501';
  END IF;
  IF coalesce(array_length(p_patient_ids, 1), 0) = 0 THEN RETURN 0; END IF;

  PERFORM public.ensure_default_message_templates();

  FOR r IN
    WITH last_sessions AS (
      SELECT
        a.clinic_id,
        a.paciente_id,
        max(a.data + a.fim) AS last_finished_at
      FROM public.appointments a
      WHERE a.clinic_id = v_clinic
        AND a.status = 'finalizado'
      GROUP BY a.clinic_id, a.paciente_id
    )
    SELECT p.id AS patient_id, ls.last_finished_at
    FROM public.patients p
    JOIN last_sessions ls
      ON ls.clinic_id = p.clinic_id
     AND ls.paciente_id = p.id
    WHERE p.id = ANY(p_patient_ids)
      AND p.clinic_id = v_clinic
      -- Alta é decisão clínica explícita e nunca entra automaticamente em campanha.
      AND p.status <> 'alta'
      AND p.opt_in_whats = true
      AND p.anonimizado = false
      AND coalesce(trim(p.telefone), '') <> ''
      -- O paciente não precisa ser marcado manualmente como inativo.
      AND ls.last_finished_at <= v_now - make_interval(days => greatest(1, p_inactive_days))
      AND NOT EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.clinic_id = v_clinic
          AND a.paciente_id = p.id
          AND a.status IN ('agendado','confirmado','em_atendimento')
          AND (a.data + a.inicio) >= v_now
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.wa_logs w
        WHERE w.clinic_id = v_clinic
          AND w.patient_id = p.id
          AND w.template = 'reativacao'
          AND w.created_at >= now() - make_interval(days => greatest(1, p_cooldown_days))
          AND w.status IN ('fila','enviando','enviado','entregue','lido')
      )
    ORDER BY ls.last_finished_at, p.nome
  LOOP
    v_message := public.render_message_template(v_clinic, 'reativacao', r.patient_id, NULL, NULL);

    INSERT INTO public.wa_logs (
      clinic_id, patient_id, template, mensagem,
      enviado_em, status, scheduled_for, created_by
    ) VALUES (
      v_clinic, r.patient_id, 'reativacao', v_message,
      now(), 'fila', now(), auth.uid()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_selected_reactivation_campaign(uuid[],integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_selected_reactivation_campaign(uuid[],integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_reactivation_reply_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text text := lower(trim(coalesce(NEW.reply_text, '')));
BEGIN
  IF NEW.template <> 'reativacao'
     OR NEW.reply_text IS NULL
     OR OLD.reply_text IS NOT DISTINCT FROM NEW.reply_text THEN
    RETURN NEW;
  END IF;

  IF v_text ~ '^(parar|pare|sair|stop|cancelar mensagens|nao quero receber|não quero receber|nao me mande mais|não me mande mais)$' THEN
    UPDATE public.patients
    SET opt_in_whats = false,
        whatsapp_opt_out_at = now()
    WHERE id = NEW.patient_id
      AND clinic_id = NEW.clinic_id;

    UPDATE public.wa_logs
    SET response_action = 'reactivation_opt_out',
        needs_human = false,
        review_resolution = 'opt_out_saved',
        review_note = 'Opt-out solicitado pelo paciente e aplicado automaticamente',
        review_resolved_at = now()
    WHERE id = NEW.id;

  ELSIF v_text ~ '^(sim|s|ok|quero|tenho interesse|quero voltar|vamos agendar|pode agendar|agendar)$' THEN
    UPDATE public.wa_logs
    SET response_action = 'reactivation_interest_yes',
        needs_human = true,
        review_resolution = NULL,
        review_note = 'Paciente demonstrou interesse em retornar; recepção deve oferecer agenda',
        review_resolved_at = NULL
    WHERE id = NEW.id;

  ELSIF v_text ~ '^(nao|não|n|agora nao|agora não|nao tenho interesse|não tenho interesse)$' THEN
    UPDATE public.wa_logs
    SET response_action = 'reactivation_interest_no',
        needs_human = false,
        review_resolution = 'declined',
        review_note = 'Paciente recusou a reativação; respeitar cooldown antes de novo contato',
        review_resolved_at = now()
    WHERE id = NEW.id;

  ELSE
    UPDATE public.wa_logs
    SET response_action = 'reactivation_needs_human',
        needs_human = true,
        review_resolution = NULL,
        review_note = 'Resposta de reativação requer interpretação da recepção',
        review_resolved_at = NULL
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_reactivation_reply_policy ON public.wa_logs;
CREATE TRIGGER trg_apply_reactivation_reply_policy
AFTER UPDATE OF reply_text ON public.wa_logs
FOR EACH ROW
EXECUTE FUNCTION public.apply_reactivation_reply_policy();

COMMIT;
