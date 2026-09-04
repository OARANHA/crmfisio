-- Verificação estrutural da Onda 0 do Nexus Clinical Engine.
-- Somente leitura/asserções. Execute após as migrations Nexus Wave 0.

DO $$
BEGIN
  IF to_regclass('public.capability_catalog') IS NULL THEN
    RAISE EXCEPTION 'capability_catalog ausente';
  END IF;
  IF to_regclass('public.professional_capabilities') IS NULL THEN
    RAISE EXCEPTION 'professional_capabilities ausente';
  END IF;
  IF to_regclass('public.nexus_evidence_sources') IS NULL THEN
    RAISE EXCEPTION 'nexus_evidence_sources ausente';
  END IF;
  IF to_regclass('public.nexus_clinical_results') IS NULL THEN
    RAISE EXCEPTION 'nexus_clinical_results ausente';
  END IF;
  IF to_regclass('public.nexus_red_flags') IS NULL THEN
    RAISE EXCEPTION 'nexus_red_flags ausente';
  END IF;
END;
$$;

DO $$
DECLARE
  v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing
  FROM (VALUES
    ('clinical.assessments'),
    ('clinical.soap'),
    ('clinical.patient_timeline'),
    ('nexus.access'),
    ('nexus.scales'),
    ('nexus.eem'),
    ('nexus.cognition'),
    ('nexus.calculators'),
    ('nexus.psychopharmacology'),
    ('nexus.education'),
    ('nexus.evidence')
  ) expected(capability_key)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.capability_catalog c
    WHERE c.capability_key = expected.capability_key
      AND c.active IS TRUE
  );

  IF v_missing <> 0 THEN
    RAISE EXCEPTION '% capabilities Nexus/core ausentes ou inativas', v_missing;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.current_professional_type()') IS NULL THEN
    RAISE EXCEPTION 'current_professional_type() ausente';
  END IF;
  IF to_regprocedure('public.has_professional_capability(text)') IS NULL THEN
    RAISE EXCEPTION 'has_professional_capability(text) ausente';
  END IF;
  IF to_regprocedure('public.validate_nexus_result_context()') IS NULL THEN
    RAISE EXCEPTION 'validate_nexus_result_context() ausente';
  END IF;
  IF to_regprocedure('public.guard_nexus_result_immutability()') IS NULL THEN
    RAISE EXCEPTION 'guard_nexus_result_immutability() ausente';
  END IF;
  IF to_regprocedure('public.guard_nexus_red_flag_acknowledgement()') IS NULL THEN
    RAISE EXCEPTION 'guard_nexus_red_flag_acknowledgement() ausente';
  END IF;
END;
$$;

DO $$
DECLARE
  v_rls_missing text[];
BEGIN
  SELECT array_agg(relname ORDER BY relname)
  INTO v_rls_missing
  FROM pg_class
  WHERE relname IN (
    'capability_catalog',
    'professional_capabilities',
    'nexus_evidence_sources',
    'nexus_clinical_results',
    'nexus_red_flags'
  )
    AND relnamespace = 'public'::regnamespace
    AND relrowsecurity IS NOT TRUE;

  IF v_rls_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS desabilitado em: %', array_to_string(v_rls_missing, ', ');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_nexus_result_context'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'trigger de contexto Nexus ausente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_nexus_result_immutable'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'trigger de imutabilidade Nexus ausente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_nexus_red_flag_ack_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'trigger de proteção de red flag ausente';
  END IF;
END;
$$;

SELECT
  'NEXUS_WAVE0_FOUNDATION_OK' AS verification,
  (SELECT count(*) FROM public.capability_catalog WHERE active IS TRUE) AS active_capabilities,
  current_timestamp AS verified_at;
