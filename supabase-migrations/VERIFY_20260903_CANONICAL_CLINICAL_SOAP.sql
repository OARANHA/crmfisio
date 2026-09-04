-- MedicsPro — verificação pós-migration do SOAP canônico
-- Execute após 20260903_canonical_clinical_soap.sql no ambiente alvo.

DO $$
BEGIN
  IF to_regclass('public.clinical_notes') IS NULL THEN
    RAISE EXCEPTION 'clinical_notes ausente';
  END IF;
  IF to_regclass('public.clinical_note_imports') IS NULL THEN
    RAISE EXCEPTION 'clinical_note_imports ausente';
  END IF;
  IF to_regprocedure('public.accept_clinical_note_import(uuid)') IS NULL THEN
    RAISE EXCEPTION 'accept_clinical_note_import(uuid) ausente';
  END IF;
  IF to_regprocedure('public.reject_clinical_note_import(uuid)') IS NULL THEN
    RAISE EXCEPTION 'reject_clinical_note_import(uuid) ausente';
  END IF;
END $$;

-- RLS precisa estar habilitado nas duas tabelas.
DO $$
DECLARE
  v_notes_rls boolean;
  v_imports_rls boolean;
BEGIN
  SELECT relrowsecurity INTO v_notes_rls FROM pg_class WHERE oid = 'public.clinical_notes'::regclass;
  SELECT relrowsecurity INTO v_imports_rls FROM pg_class WHERE oid = 'public.clinical_note_imports'::regclass;
  IF NOT coalesce(v_notes_rls, false) THEN RAISE EXCEPTION 'RLS desabilitado em clinical_notes'; END IF;
  IF NOT coalesce(v_imports_rls, false) THEN RAISE EXCEPTION 'RLS desabilitado em clinical_note_imports'; END IF;
END $$;

-- Confirma políticas essenciais.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'clinical_notes'
    AND policyname IN ('clinical_notes_read_scope', 'clinical_notes_insert_author', 'clinical_notes_update_author');
  IF v_count <> 3 THEN RAISE EXCEPTION 'Políticas esperadas de clinical_notes incompletas: %/3', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'clinical_note_imports'
    AND policyname IN ('clinical_note_imports_read_scope', 'clinical_note_imports_insert_author');
  IF v_count <> 2 THEN RAISE EXCEPTION 'Políticas esperadas de clinical_note_imports incompletas: %/2', v_count; END IF;
END $$;

-- Confirma triggers de contexto/imutabilidade.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_trigger
  WHERE tgrelid = 'public.clinical_notes'::regclass
    AND NOT tgisinternal
    AND tgname IN ('trg_clinical_note_context', 'trg_clinical_note_signature');
  IF v_count <> 2 THEN RAISE EXCEPTION 'Triggers esperados de clinical_notes incompletos: %/2', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM pg_trigger
  WHERE tgrelid = 'public.clinical_note_imports'::regclass
    AND NOT tgisinternal
    AND tgname = 'trg_clinical_note_import_context';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Trigger de clinical_note_imports ausente'; END IF;
END $$;

-- Confirma constraint lógica principal: somente SOAP e estados conhecidos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clinical_notes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%note_type%soap%'
  ) THEN
    RAISE EXCEPTION 'Constraint note_type=soap não encontrada';
  END IF;
END $$;

SELECT
  'canonical_clinical_soap_ok' AS verification,
  now() AS checked_at;
