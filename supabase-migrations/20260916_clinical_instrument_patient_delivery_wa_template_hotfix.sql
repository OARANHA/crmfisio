-- MedicsPro Clinical Instrument Patient Delivery V1
-- Production hotfix: extend the canonical WhatsApp outbox template constraint
-- without silently overwriting an unknown/future constraint definition.
BEGIN;

DO $$
DECLARE
  v_def text;
  v_literal_count integer;
BEGIN
  IF to_regclass('public.wa_logs') IS NULL THEN
    RAISE EXCEPTION 'patient_delivery_wa_template_hotfix_wa_logs_missing';
  END IF;

  SELECT pg_get_constraintdef(c.oid)
    INTO v_def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.wa_logs'::regclass
    AND c.conname = 'wa_logs_template_check'
    AND c.contype = 'c';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'patient_delivery_wa_template_hotfix_constraint_missing';
  END IF;

  IF position('clinical_instrument_patient_self' IN v_def) > 0 THEN
    RETURN;
  END IF;
  IF position('confirmacao' IN lower(v_def)) = 0
     OR position('nps' IN lower(v_def)) = 0
     OR position('reativacao' IN lower(v_def)) = 0
     OR position('vaga_espera' IN lower(v_def)) = 0
     OR position('nexus_autoavaliacao' IN lower(v_def)) = 0 THEN
    RAISE EXCEPTION 'patient_delivery_wa_template_hotfix_unknown_constraint: %', v_def;
  END IF;

  SELECT count(*)
    INTO v_literal_count
  FROM regexp_matches(v_def, '''([^'']+)''', 'g');

  IF v_literal_count <> 5 THEN
    RAISE EXCEPTION 'patient_delivery_wa_template_hotfix_unknown_constraint: %', v_def;
  END IF;

  ALTER TABLE public.wa_logs DROP CONSTRAINT wa_logs_template_check;
  ALTER TABLE public.wa_logs
    ADD CONSTRAINT wa_logs_template_check
      CHECK (template IN (
        'confirmacao', 'nps', 'reativacao', 'vaga_espera',
        'nexus_autoavaliacao', 'clinical_instrument_patient_self'
      ));
END;
$$;

COMMIT;
