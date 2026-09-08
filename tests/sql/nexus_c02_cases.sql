-- C-02 write-contract assertions. Browser mutations run as SECURITY INVOKER.
CREATE OR REPLACE FUNCTION public.test_c02_try_insert(
  p_actor uuid,
  p_patient uuid,
  p_professional uuid,
  p_appointment uuid,
  p_module text,
  p_tool text,
  p_rule text,
  p_version text,
  p_required text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'c02_test_must_run_under_authenticated';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', p_actor::text, false);
  INSERT INTO public.nexus_clinical_results(
    clinic_id, patient_id, professional_id, appointment_id,
    module_key, tool_key, rule_key, rule_version, required_capability,
    status, input_snapshot, output_snapshot, evidence_snapshot
  ) VALUES (
    NULL, p_patient, p_professional, p_appointment,
    p_module, p_tool, p_rule, p_version, p_required,
    'draft', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  ) RETURNING id INTO v_id;
  RETURN 'OK:' || v_id::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_c02_try_contract_update(
  p_actor uuid,
  p_result uuid,
  p_required text DEFAULT NULL,
  p_tool text DEFAULT NULL,
  p_rule text DEFAULT NULL,
  p_version text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'c02_test_must_run_under_authenticated';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', p_actor::text, false);

  UPDATE public.nexus_clinical_results
  SET required_capability = coalesce(p_required, required_capability),
      tool_key = coalesce(p_tool, tool_key),
      rule_key = coalesce(p_rule, rule_key),
      rule_version = coalesce(p_version, rule_version)
  WHERE id=p_result;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_c02_try_finalized_update(
  p_actor uuid,
  p_result uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'c02_test_must_run_under_authenticated';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', p_actor::text, false);
  UPDATE public.nexus_clinical_results
  SET interpretation='tampered after finalization'
  WHERE id=p_result;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_c02_try_insert(uuid,uuid,uuid,uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_c02_try_contract_update(uuid,uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_c02_try_finalized_update(uuid,uuid) TO authenticated;

-- 1) Authorized physician + known PHQ-9 contract. Client omits capability; the
-- trusted BEFORE trigger resolves nexus.scales before RLS WITH CHECK.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
INSERT INTO public.nexus_clinical_results(
  id, patient_id, professional_id, appointment_id,
  module_key, tool_key, rule_key, rule_version,
  status, input_snapshot, output_snapshot, evidence_snapshot
) VALUES (
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000501',
  'scales','phq9','nexus.phq9','nexus-2026-09-03',
  'draft','{}','{}','[]'
);
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.nexus_clinical_results
    WHERE id='00000000-0000-0000-0000-000000000801'::uuid
      AND required_capability='nexus.scales'
  ) THEN RAISE EXCEPTION 'C02 trusted capability was not populated'; END IF;
END $$;

-- 2) Capability substitution is blocked on both INSERT and UPDATE.
SET ROLE authenticated;
DO $$
DECLARE v text;
BEGIN
  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501',
    'eem','eem','nexus.eem','nexus-eem-2026-09-03','nexus.access'
  );
  IF v NOT LIKE 'ERR:%nexus_result_required_capability_mismatch%' THEN
    RAISE EXCEPTION 'C02 capability substitution INSERT escaped: %', v;
  END IF;

  v := public.test_c02_try_contract_update(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000801',
    'nexus.access',NULL,NULL,NULL
  );
  IF v NOT LIKE 'ERR:%nexus_result_contract_immutable%' THEN
    RAISE EXCEPTION 'C02 capability substitution UPDATE escaped: %', v;
  END IF;
END $$;
RESET ROLE;

-- 3) Unknown tool and incompatible rule/version fail closed.
SET ROLE authenticated;
DO $$
DECLARE v text;
BEGIN
  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501',
    'scales','unknown','nexus.phq9','nexus-2026-09-03',NULL
  );
  IF v NOT LIKE 'ERR:%nexus_result_contract_unknown%' THEN RAISE EXCEPTION 'unknown tool escaped: %',v; END IF;

  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501',
    'scales','phq9','nexus.gad7','nexus-2026-09-03',NULL
  );
  IF v NOT LIKE 'ERR:%nexus_result_contract_unknown%' THEN RAISE EXCEPTION 'incompatible rule escaped: %',v; END IF;

  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501',
    'scales','phq9','nexus.phq9','wrong-version',NULL
  );
  IF v NOT LIKE 'ERR:%nexus_result_contract_unknown%' THEN RAISE EXCEPTION 'incompatible version escaped: %',v; END IF;
END $$;
RESET ROLE;

-- 4) Entitlement remains mandatory.
UPDATE public.platform_clinic_entitlements SET enabled=false
WHERE clinic_id='00000000-0000-0000-0000-000000000001' AND entitlement_key='nexus.access';
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501',
    'scales','phq9','nexus.phq9','nexus-2026-09-03',NULL);
  IF v NOT LIKE 'ERR:%' THEN RAISE EXCEPTION 'no-entitlement write escaped'; END IF;
END $$;
RESET ROLE;
UPDATE public.platform_clinic_entitlements SET enabled=true
WHERE clinic_id='00000000-0000-0000-0000-000000000001' AND entitlement_key='nexus.access';

-- 5) Non-medical professional, owner and admin never acquire Nexus by role.
SET ROLE authenticated;
DO $$
DECLARE actor uuid; v text;
BEGIN
  FOREACH actor IN ARRAY ARRAY[
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000104'::uuid,
    '00000000-0000-0000-0000-000000000105'::uuid
  ] LOOP
    v := public.test_c02_try_insert(actor,'00000000-0000-0000-0000-000000000301',actor,NULL,
      'scales','phq9','nexus.phq9','nexus-2026-09-03',NULL);
    IF v NOT LIKE 'ERR:%' THEN RAISE EXCEPTION 'non-medical actor write escaped: %',actor; END IF;
  END LOOP;
END $$;
RESET ROLE;

-- 6) Inactive user is blocked.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-000000000503',
    'scales','phq9','nexus.phq9','nexus-2026-09-03',NULL);
  IF v NOT LIKE 'ERR:%' THEN RAISE EXCEPTION 'inactive write escaped'; END IF;
END $$;
RESET ROLE;

-- 7) Suspended clinic is blocked through the existing Nexus entitlement boundary.
UPDATE public.clinics SET lifecycle_status='suspended' WHERE id='00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501',
    'scales','phq9','nexus.phq9','nexus-2026-09-03',NULL);
  IF v NOT LIKE 'ERR:%' THEN RAISE EXCEPTION 'suspended clinic write escaped'; END IF;
END $$;
RESET ROLE;
UPDATE public.clinics SET lifecycle_status='active' WHERE id='00000000-0000-0000-0000-000000000001';

-- 8) Other tenant, forged authorship and incompatible patient/appointment fail.
SET ROLE authenticated;
DO $$
DECLARE v text;
BEGIN
  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',NULL,
    'scales','phq9','nexus.phq9','nexus-2026-09-03',NULL);
  IF v NOT LIKE 'ERR:%' THEN RAISE EXCEPTION 'cross-tenant write escaped'; END IF;

  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000501',
    'scales','phq9','nexus.phq9','nexus-2026-09-03',NULL);
  IF v NOT LIKE 'ERR:%' THEN RAISE EXCEPTION 'forged authorship escaped'; END IF;

  v := public.test_c02_try_insert(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000501',
    'scales','phq9','nexus.phq9','nexus-2026-09-03',NULL);
  IF v NOT LIKE 'ERR:%Atendimento incompatível%' THEN RAISE EXCEPTION 'patient/appointment mismatch escaped: %',v; END IF;
END $$;
RESET ROLE;

-- 9) Contract identity cannot be rewritten after creation.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_c02_try_contract_update(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000801',
    NULL,'gad7','nexus.gad7','nexus-2026-09-03');
  IF v NOT LIKE 'ERR:%nexus_result_contract_immutable%' THEN RAISE EXCEPTION 'contract rewrite escaped: %',v; END IF;
END $$;
RESET ROLE;

-- 10) Finalized result remains immutable.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
UPDATE public.nexus_clinical_results
SET status='finalized'
WHERE id='00000000-0000-0000-0000-000000000801';
DO $$ DECLARE v text; BEGIN
  v := public.test_c02_try_finalized_update(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000801');
  IF v NOT LIKE 'ERR:%Resultado Nexus finalizado é imutável%' THEN RAISE EXCEPTION 'finalized mutation escaped: %',v; END IF;
END $$;
RESET ROLE;

-- 11) Specific EEM writer still works when the physician has the exact grant.
INSERT INTO public.professional_capabilities(clinic_id,professional_id,capability_key,granted)
VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','nexus.eem',true)
ON CONFLICT (clinic_id,professional_id,capability_key) DO UPDATE SET granted=EXCLUDED.granted;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
SELECT public.finalize_nexus_eem_result(
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000501',
  'nexus-eem-2026-09-03',
  '{}'::jsonb,'{}'::jsonb,'synthetic',NULL,'synthetic',NULL,'[]'::jsonb,'[]'::jsonb
);
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.nexus_clinical_results
    WHERE module_key='eem' AND tool_key='eem' AND rule_key='nexus.eem'
      AND rule_version='nexus-eem-2026-09-03'
      AND required_capability='nexus.eem'
      AND status='finalized'
      AND professional_id='00000000-0000-0000-0000-000000000101'
  ) THEN RAISE EXCEPTION 'specific EEM writer regressed'; END IF;
END $$;

SELECT 'NEXUS_C02_BEHAVIOR_OK' AS result;