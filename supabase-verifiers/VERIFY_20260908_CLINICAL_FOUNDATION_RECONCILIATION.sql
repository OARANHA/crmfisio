\pset pager off
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  v_assessment text;
  v_authorship text;
  v_evolution text;
  v_professional_attnum smallint;
BEGIN
  SELECT pg_get_functiondef('public.validate_clinical_assessment_context()'::regprocedure)
    INTO v_assessment;
  SELECT pg_get_functiondef('public.guard_legacy_clinical_self_authorship()'::regprocedure)
    INTO v_authorship;
  SELECT pg_get_functiondef('public.guard_clinical_evolution_session_linkage()'::regprocedure)
    INTO v_evolution;

  IF position('current_user_has_clinical_capability(''clinical.assessment.apply'')' IN v_assessment) = 0 THEN
    RAISE EXCEPTION 'clinical_reconciliation_assessment_capability_missing';
  END IF;
  IF position('a.professional_id = new.professional_id' IN lower(v_assessment)) = 0 THEN
    RAISE EXCEPTION 'clinical_reconciliation_assessment_appointment_author_missing';
  END IF;
  IF v_assessment ~* $$['"]fisio['"]$$ OR v_assessment ~* '\.fisio_id' THEN
    RAISE EXCEPTION 'clinical_reconciliation_assessment_legacy_fisio_dependency';
  END IF;

  IF position('clinical.assessment.apply' IN v_authorship) = 0
     OR position('clinical.evolution.write' IN v_authorship) = 0 THEN
    RAISE EXCEPTION 'clinical_reconciliation_legacy_authorship_capability_missing';
  END IF;
  IF v_authorship ~* $$['"]fisio['"]$$ THEN
    RAISE EXCEPTION 'clinical_reconciliation_legacy_authorship_role_dependency';
  END IF;

  IF position('v_appointment.professional_id' IN lower(v_evolution)) = 0 THEN
    RAISE EXCEPTION 'clinical_reconciliation_evolution_canonical_professional_missing';
  END IF;
  IF position('v_appointment.fisio_id' IN lower(v_evolution)) > 0 THEN
    RAISE EXCEPTION 'clinical_reconciliation_evolution_legacy_professional_dependency';
  END IF;

  SELECT a.attnum
    INTO v_professional_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.appointments'::regclass
    AND a.attname = 'professional_id'
    AND NOT a.attisdropped
    AND a.attnotnull;
  IF v_professional_attnum IS NULL THEN
    RAISE EXCEPTION 'clinical_reconciliation_appointment_professional_id_not_canonical';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.clinical_assessments'::regclass
      AND t.tgname = 'trg_clinical_assessment_context'
      AND t.tgenabled <> 'D'
      AND t.tgfoid = 'public.validate_clinical_assessment_context()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'clinical_reconciliation_assessment_trigger_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.physiotherapy_evaluations'::regclass
      AND t.tgname = 'trg_evaluations_self_authorship'
      AND t.tgenabled <> 'D'
      AND t.tgfoid = 'public.guard_legacy_clinical_self_authorship()'::regprocedure
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.physiotherapy_evolutions'::regclass
      AND t.tgname = 'trg_evolutions_self_authorship'
      AND t.tgenabled <> 'D'
      AND t.tgfoid = 'public.guard_legacy_clinical_self_authorship()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'clinical_reconciliation_self_authorship_triggers_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.physiotherapy_evolutions'::regclass
      AND t.tgname = 'trg_evolutions_session_linkage'
      AND t.tgenabled <> 'D'
      AND t.tgfoid = 'public.guard_clinical_evolution_session_linkage()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'clinical_reconciliation_evolution_linkage_trigger_missing';
  END IF;

  -- Preserve the previously hardened Assessment Engine contracts.
  IF to_regprocedure('public.guard_finalized_clinical_assessment()') IS NULL
     OR to_regprocedure('public.guard_assessment_template_version_immutability()') IS NULL
     OR to_regprocedure('public.guard_assessment_template_version_delete()') IS NULL
     OR to_regprocedure('public.validate_assessment_body_point_context()') IS NULL THEN
    RAISE EXCEPTION 'clinical_reconciliation_assessment_contract_regression';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.assessment_body_points'::regclass
      AND t.tgname = 'trg_assessment_body_point_context'
      AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'clinical_reconciliation_body_map_trigger_missing';
  END IF;
END
$$;

SELECT 'CLINICAL_FOUNDATION_RECONCILIATION_VERIFIED' AS verification;
COMMIT;
