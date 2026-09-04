\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='wa_logs'
      AND column_name='self_assessment_invite_id'
  ) THEN
    RAISE EXCEPTION 'NEXUS_SELF_ASSESSMENT_WHATSAPP_VERIFY_FAIL: coluna ausente';
  END IF;
END $$;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO v_def
  FROM pg_constraint c
  WHERE c.conrelid='public.wa_logs'::regclass
    AND c.conname='wa_logs_template_check';

  IF v_def IS NULL OR position('nexus_autoavaliacao' in v_def)=0 THEN
    RAISE EXCEPTION 'NEXUS_SELF_ASSESSMENT_WHATSAPP_VERIFY_FAIL: template não liberado';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='wa_logs'
      AND indexname='wa_logs_one_open_self_assessment_idx'
  ) THEN
    RAISE EXCEPTION 'NEXUS_SELF_ASSESSMENT_WHATSAPP_VERIFY_FAIL: índice idempotente ausente';
  END IF;
END $$;

SELECT 'NEXUS_SELF_ASSESSMENT_WHATSAPP_OK' AS verification, now() AS verified_at;
