-- MedicsPro — PHQ-15 Clinician-Assisted Administration V1
-- Adds one versioned Nexus engine contract and one neutral clinical-instrument
-- catalog exposure. It grants no user capability and enables no clinic.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF to_regclass('public.nexus_result_contracts') IS NULL
     OR to_regclass('public.clinical_instrument_catalog') IS NULL
     OR to_regclass('public.clinic_clinical_instrument_settings') IS NULL
     OR to_regprocedure('public.can_apply_clinical_instrument_in_encounter(uuid,text)') IS NULL
     OR to_regprocedure('public.record_clinician_assisted_clinical_instrument(uuid,uuid,text,uuid,jsonb,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'phq15_clinician_assisted_prerequisite_missing';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.nexus_result_contracts
    WHERE module_key='scales' AND tool_key='phq15'
      AND rule_key='nexus.phq15' AND rule_version='nexus-phq15-2026-09-13'
      AND required_capability IS DISTINCT FROM 'nexus.scales'
  ) THEN
    RAISE EXCEPTION 'phq15_nexus_contract_conflict';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clinical_instrument_catalog
    WHERE instrument_key='phq15'
      AND (
        engine_source IS DISTINCT FROM 'nexus'
        OR engine_module_key IS DISTINCT FROM 'scales'
        OR engine_tool_key IS DISTINCT FROM 'phq15'
        OR engine_rule_key IS DISTINCT FROM 'nexus.phq15'
        OR engine_rule_version IS DISTINCT FROM 'nexus-phq15-2026-09-13'
      )
  ) THEN
    RAISE EXCEPTION 'phq15_neutral_catalog_conflict';
  END IF;
END;
$$;

INSERT INTO public.nexus_result_contracts(
  module_key, tool_key, rule_key, rule_version, required_capability
) VALUES (
  'scales', 'phq15', 'nexus.phq15', 'nexus-phq15-2026-09-13', 'nexus.scales'
)
ON CONFLICT (module_key, tool_key, rule_key, rule_version) DO NOTHING;

INSERT INTO public.clinical_instrument_catalog(
  instrument_key, engine_source, engine_module_key, engine_tool_key,
  engine_rule_key, engine_rule_version, active
) VALUES (
  'phq15', 'nexus', 'scales', 'phq15',
  'nexus.phq15', 'nexus-phq15-2026-09-13', true
)
ON CONFLICT (instrument_key) DO NOTHING;
-- Intentionally no INSERT into clinic_clinical_instrument_settings and no grant
-- into professional_capabilities. Missing tenant setting remains deny-by-default.

COMMIT;
