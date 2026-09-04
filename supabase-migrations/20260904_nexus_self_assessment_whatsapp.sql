-- MedicsPro / Nexus Clinical Engine
-- Integra convites de autoavaliação ao outbox WhatsApp existente.
BEGIN;

ALTER TABLE public.wa_logs
  ADD COLUMN IF NOT EXISTS self_assessment_invite_id uuid
    REFERENCES public.nexus_self_assessment_invites(id) ON DELETE SET NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.wa_logs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%template%'
  LOOP
    EXECUTE format('ALTER TABLE public.wa_logs DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.wa_logs
  ADD CONSTRAINT wa_logs_template_check
    CHECK (template IN ('confirmacao','nps','reativacao','vaga_espera','nexus_autoavaliacao'));

CREATE INDEX IF NOT EXISTS wa_logs_self_assessment_invite_idx
  ON public.wa_logs(self_assessment_invite_id, status)
  WHERE self_assessment_invite_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wa_logs_one_open_self_assessment_idx
  ON public.wa_logs(self_assessment_invite_id)
  WHERE self_assessment_invite_id IS NOT NULL
    AND status IN ('fila','enviando','enviado','entregue','lido');

COMMIT;
