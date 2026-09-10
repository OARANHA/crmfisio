-- #399 blocker regression — Nexus engine membership must not imply neutral
-- multiprofessional clinical exposure. The synthetic nexus_only_scale contract is
-- created by scripts/build-clinical-instrument-encounter-sql-test.py before #399.

-- 39) The synthetic scale is a valid Nexus engine contract.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.nexus_result_contracts
    WHERE module_key='scales'
      AND tool_key='nexus_only_scale'
      AND rule_key='nexus.nexus_only_scale'
      AND rule_version='nexus-only-2026-09-10'
      AND required_capability='nexus.scales'
  ) THEN
    RAISE EXCEPTION 'CI399 Nexus-only negative fixture missing';
  END IF;
END $$;

-- 40) Nexus registry membership alone does not expose it in the neutral catalog.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clinical_instrument_catalog
    WHERE instrument_key='nexus_only_scale'
  ) THEN
    RAISE EXCEPTION 'CI399 Nexus-only scale leaked into neutral clinical catalog';
  END IF;
END $$;

-- 41) Neither owner nor admin can institutionally enable an instrument that was
-- not explicitly approved in the neutral clinical catalog.
SET ROLE authenticated;
DO $$
DECLARE
  actor uuid;
  v text;
BEGIN
  FOREACH actor IN ARRAY ARRAY[
    '00000000-0000-0000-0000-000000000104'::uuid,
    '00000000-0000-0000-0000-000000000105'::uuid
  ] LOOP
    v := public.test_ci399_set(actor, 'nexus_only_scale', true);
    IF v NOT LIKE 'ERR:22023:clinical_instrument_unknown%' THEN
      RAISE EXCEPTION 'CI399 Nexus-only scale enable escaped for %: %', actor, v;
    END IF;
  END LOOP;
END $$;
RESET ROLE;

-- 42) An actor who already has clinical.instrument.apply still receives no Apply
-- in Encounter authority for the Nexus-only scale.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501',
    'nexus_only_scale'
  ) THEN
    RAISE EXCEPTION 'CI399 Nexus-only scale escaped neutral exposure boundary';
  END IF;
END $$;
RESET ROLE;

SELECT 'CLINICAL_INSTRUMENT_EXPOSURE_NEGATIVE_OK_4_CASES' AS result;
