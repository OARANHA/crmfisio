-- Baseline C-06 exploit proof. D1 has nexus.access/nexus.scales, not nexus.eem.
-- The historical policy + trigger trust the caller-supplied required_capability,
-- so an EEM-identified row can be authorized as nexus.access.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);

INSERT INTO public.nexus_clinical_results(
  id, clinic_id, patient_id, professional_id, appointment_id,
  module_key, tool_key, rule_key, rule_version, required_capability,
  status, input_snapshot, output_snapshot, evidence_snapshot
) VALUES (
  '00000000-0000-0000-0000-000000000799',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000501',
  'eem', 'eem', 'nexus.eem', 'nexus-eem-2026-09-03',
  'nexus.access',
  'draft', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
);

RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.professional_capabilities
    WHERE professional_id='00000000-0000-0000-0000-000000000101'::uuid
      AND capability_key='nexus.eem'
      AND granted IS TRUE
  ) THEN
    RAISE EXCEPTION 'C02 exploit fixture invalid: D1 unexpectedly has nexus.eem';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.nexus_clinical_results
    WHERE id='00000000-0000-0000-0000-000000000799'::uuid
      AND module_key='eem'
      AND tool_key='eem'
      AND rule_key='nexus.eem'
      AND required_capability='nexus.access'
  ) THEN
    RAISE EXCEPTION 'C02 exploit was not reproduced';
  END IF;
END;
$$;

SELECT 'NEXUS_C02_EXPLOIT_REPRODUCED' AS result;

-- Remove only disposable Nexus rows before applying the fail-closed C-02
-- migration. The actor/tenant/appointment fixture remains unchanged.
DELETE FROM public.nexus_red_flags;
DELETE FROM public.nexus_clinical_results;