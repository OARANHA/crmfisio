-- MedicsPro #399 — behavioral authorization matrix.
-- Runs only in the disposable PostgreSQL harness assembled by
-- scripts/build-clinical-instrument-encounter-sql-test.py.

CREATE OR REPLACE FUNCTION public.test_ci399_can(
  p_actor uuid,
  p_appointment uuid,
  p_instrument text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'ci399_test_must_run_under_authenticated';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_actor::text, ''), false);
  SELECT public.can_apply_clinical_instrument_in_encounter(p_appointment, p_instrument)
    INTO v_allowed;
  RETURN coalesce(v_allowed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.test_ci399_set(
  p_actor uuid,
  p_instrument text,
  p_enabled boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'ci399_test_must_run_under_authenticated';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_actor::text, ''), false);
  PERFORM public.set_clinic_clinical_instrument_enabled(p_instrument, p_enabled);
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE || ':' || SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_ci399_can(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_ci399_set(uuid,text,boolean) TO authenticated;

-- 1) The neutral capability is cataloged as clinical and active.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.capability_catalog
    WHERE capability_key='clinical.instrument.apply'
      AND domain='clinical'
      AND clinical IS TRUE
      AND active IS TRUE
  ) THEN RAISE EXCEPTION 'CI399 capability catalog row missing'; END IF;
END $$;

-- 2) Migration never grants the new capability to any professional implicitly.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.professional_capabilities
    WHERE capability_key='clinical.instrument.apply'
  ) THEN RAISE EXCEPTION 'CI399 migration auto-granted clinical.instrument.apply'; END IF;
END $$;

-- 3) Instrument enablement is fail-closed: no tenant rows are created implicitly.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.clinic_clinical_instrument_settings) THEN
    RAISE EXCEPTION 'CI399 migration auto-enabled an instrument';
  END IF;
END $$;

-- 4) Base authorization is internal, not a browser-visible generic act authority.
DO $$ BEGIN
  IF has_function_privilege('authenticated',
       'public.clinical_instrument_base_authorized(uuid,text)'::regprocedure,
       'EXECUTE') THEN
    RAISE EXCEPTION 'CI399 internal base authorization exposed to authenticated';
  END IF;
  IF has_function_privilege('anon',
       'public.clinical_instrument_base_authorized(uuid,text)'::regprocedure,
       'EXECUTE') THEN
    RAISE EXCEPTION 'CI399 internal base authorization exposed to anon';
  END IF;
END $$;

-- 5) Only the contextual Apply-in-Encounter boundary is browser-callable.
DO $$ BEGIN
  IF NOT has_function_privilege('authenticated',
       'public.can_apply_clinical_instrument_in_encounter(uuid,text)'::regprocedure,
       'EXECUTE')
     OR has_function_privilege('anon',
       'public.can_apply_clinical_instrument_in_encounter(uuid,text)'::regprocedure,
       'EXECUTE') THEN
    RAISE EXCEPTION 'CI399 contextual helper ACL drift';
  END IF;
END $$;

-- 6) Settings are readable in tenant scope but direct browser writes are absent.
DO $$ BEGIN
  IF NOT has_table_privilege('authenticated','public.clinic_clinical_instrument_settings','SELECT')
     OR has_table_privilege('authenticated','public.clinic_clinical_instrument_settings','INSERT')
     OR has_table_privilege('authenticated','public.clinic_clinical_instrument_settings','UPDATE')
     OR has_table_privilege('authenticated','public.clinic_clinical_instrument_settings','DELETE')
     OR has_table_privilege('anon','public.clinic_clinical_instrument_settings','SELECT') THEN
    RAISE EXCEPTION 'CI399 settings table ACL drift';
  END IF;
END $$;

-- Test-only grants. These are fixtures, not migration defaults.
INSERT INTO public.professional_capabilities(
  clinic_id, professional_id, capability_key, granted
) VALUES
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','clinical.instrument.apply',true),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000103','clinical.instrument.apply',true),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000104','clinical.instrument.apply',true),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000105','clinical.instrument.apply',true),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000106','clinical.instrument.apply',true),
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','clinical.instrument.apply',true);

-- 7) Owner enables PHQ-9 through a tenant-derived RPC; browser supplies no clinic id.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','phq9',true
  );
  IF v <> 'OK' THEN RAISE EXCEPTION 'CI399 owner enable failed: %',v; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_clinical_instrument_settings
    WHERE clinic_id='00000000-0000-0000-0000-000000000001'
      AND instrument_key='phq9'
      AND enabled IS TRUE
      AND configured_by='00000000-0000-0000-0000-000000000104'
  ) THEN RAISE EXCEPTION 'CI399 owner setting was not persisted in own tenant'; END IF;
END $$;

-- 8) Ordinary clinical professionals cannot configure tenant enablement.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000101','gad7',true
  );
  IF v NOT LIKE 'ERR:42501:clinical_instrument_admin_required%' THEN
    RAISE EXCEPTION 'CI399 professional configured tenant instrument: %',v;
  END IF;
END $$;
RESET ROLE;

-- 9) Unknown instruments and EEM cannot be smuggled into the scale foundation.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','unknown',true
  );
  IF v NOT LIKE 'ERR:22023:clinical_instrument_unknown%' THEN
    RAISE EXCEPTION 'CI399 unknown instrument escaped: %',v;
  END IF;
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','eem',true
  );
  IF v NOT LIKE 'ERR:22023:clinical_instrument_unknown%' THEN
    RAISE EXCEPTION 'CI399 EEM was misclassified as neutral scale: %',v;
  END IF;
END $$;
RESET ROLE;

-- 10) Even owner cannot bypass the server configuration flow with table DML.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000104',false);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.clinic_clinical_instrument_settings(
      clinic_id,instrument_key,enabled,configured_by
    ) VALUES (
      '00000000-0000-0000-0000-000000000001','gad7',true,
      '00000000-0000-0000-0000-000000000104'
    );
    RAISE EXCEPTION 'CI399 direct settings write escaped';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- 11) Explicit setting row with omitted enabled value stays false and denies Apply now.
INSERT INTO public.clinic_clinical_instrument_settings(
  clinic_id,instrument_key,configured_by
) VALUES (
  '00000000-0000-0000-0000-000000000001','gad7',
  '00000000-0000-0000-0000-000000000104'
);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clinic_clinical_instrument_settings
    WHERE clinic_id='00000000-0000-0000-0000-000000000001'
      AND instrument_key='gad7' AND enabled IS TRUE
  ) THEN RAISE EXCEPTION 'CI399 enabled default is not fail-closed'; END IF;
END $$;
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','gad7'
  ) THEN RAISE EXCEPTION 'CI399 disabled GAD7 authorized'; END IF;
END $$;
RESET ROLE;

-- 12) Authorized physician + explicit capability + enabled instrument + own active encounter succeeds.
SET ROLE authenticated;
DO $$ BEGIN
  IF NOT public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','phq9'
  ) THEN RAISE EXCEPTION 'CI399 authorized physician active encounter denied'; END IF;
END $$;
RESET ROLE;

-- 13) Neutral capability is genuinely multiprofessional: supported physiotherapist succeeds
-- on their own active encounter without becoming a Nexus medical actor.
SET ROLE authenticated;
DO $$ BEGIN
  IF NOT public.test_ci399_can(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000502','phq9'
  ) THEN RAISE EXCEPTION 'CI399 authorized physiotherapist active encounter denied'; END IF;
END $$;
RESET ROLE;

-- 14) Future scheduled appointment is not an active Encounter for Apply now.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000508','phq9'
  ) THEN RAISE EXCEPTION 'CI399 agendado appointment escaped active encounter boundary'; END IF;
END $$;
RESET ROLE;

-- 15) Confirmed appointment is still not active until status is em_atendimento.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000509','phq9'
  ) THEN RAISE EXCEPTION 'CI399 confirmado appointment escaped active encounter boundary'; END IF;
END $$;
RESET ROLE;

-- 16) Finalized appointment is historical, not an Apply-now Encounter.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000512','phq9'
  ) THEN RAISE EXCEPTION 'CI399 finalizado appointment escaped active encounter boundary'; END IF;
END $$;
RESET ROLE;

-- 17) An active appointment owned by another professional never authorizes the actor.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000510','phq9'
  ) THEN RAISE EXCEPTION 'CI399 other-professional appointment escaped'; END IF;
END $$;
RESET ROLE;

-- 18) Owner has legitimate clinical-record read access but no act authority on D1's appointment.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000104',false);
DO $$ BEGIN
  IF public.can_access_patient_clinical_record(
       '00000000-0000-0000-0000-000000000301') IS NOT TRUE THEN
    RAISE EXCEPTION 'CI399 owner read-control fixture invalid';
  END IF;
  IF public.can_apply_clinical_instrument_in_encounter(
       '00000000-0000-0000-0000-000000000501','phq9') THEN
    RAISE EXCEPTION 'CI399 owner read bypass became clinical act authority';
  END IF;
END $$;
RESET ROLE;

-- 19) Admin has the same legitimate read behavior but no act bypass either.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000105',false);
DO $$ BEGIN
  IF public.can_access_patient_clinical_record(
       '00000000-0000-0000-0000-000000000301') IS NOT TRUE THEN
    RAISE EXCEPTION 'CI399 admin read-control fixture invalid';
  END IF;
  IF public.can_apply_clinical_instrument_in_encounter(
       '00000000-0000-0000-0000-000000000501','phq9') THEN
    RAISE EXCEPTION 'CI399 admin read bypass became clinical act authority';
  END IF;
END $$;
RESET ROLE;

-- 20) Owner may act only when they independently satisfy the same clinical boundary
-- and are the professional actually assigned to the active appointment.
SET ROLE authenticated;
DO $$ BEGIN
  IF NOT public.test_ci399_can(
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000506','phq9'
  ) THEN RAISE EXCEPTION 'CI399 assigned clinical owner denied'; END IF;
END $$;
RESET ROLE;

-- 21) Admin follows the identical rule when independently clinical and assigned.
SET ROLE authenticated;
DO $$ BEGIN
  IF NOT public.test_ci399_can(
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000507','phq9'
  ) THEN RAISE EXCEPTION 'CI399 assigned clinical admin denied'; END IF;
END $$;
RESET ROLE;

-- 22) Holding the capability without an appointment/context does not create generic authority.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',NULL,'phq9'
  ) THEN RAISE EXCEPTION 'CI399 capability alone created generic act authority'; END IF;
END $$;
RESET ROLE;

-- 23) Relevant specialty without the explicit capability is denied.
-- D2 is a valid physician fixture with specialty Psiquiatria but receives no #399 grant.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000510','phq9'
  ) THEN RAISE EXCEPTION 'CI399 specialty auto-granted instrument application'; END IF;
END $$;
RESET ROLE;

-- 24) Explicit capability row cannot rescue an inactive profile.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000106',
    '00000000-0000-0000-0000-000000000503','phq9'
  ) THEN RAISE EXCEPTION 'CI399 inactive clinical actor escaped'; END IF;
END $$;
RESET ROLE;

-- 25) Cross-tenant appointment cannot be used by a clinic-1 actor.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000505','phq9'
  ) THEN RAISE EXCEPTION 'CI399 cross-tenant appointment escaped'; END IF;
END $$;
RESET ROLE;

-- 26) Deleted patient fails the base boundary even with an exact active appointment.
UPDATE public.patients
SET deleted_at=now()
WHERE id='00000000-0000-0000-0000-000000000302';
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000511','phq9'
  ) THEN RAISE EXCEPTION 'CI399 deleted patient escaped'; END IF;
END $$;
RESET ROLE;
UPDATE public.patients
SET deleted_at=NULL
WHERE id='00000000-0000-0000-0000-000000000302';

-- 27) A non-doctor with neutral clinical.instrument.apply gains no nexus.* authority.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
DO $$ BEGIN
  IF public.has_professional_capability('nexus.access')
     OR public.has_professional_capability('nexus.scales')
     OR public.has_professional_capability('nexus.eem') THEN
    RAISE EXCEPTION 'CI399 neutral capability broadened Nexus authority';
  END IF;
END $$;
RESET ROLE;

-- 28) Tenant disablement immediately closes the Apply-in-Encounter boundary.
SET ROLE authenticated;
DO $$ DECLARE v text; BEGIN
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','phq9',false
  );
  IF v <> 'OK' THEN RAISE EXCEPTION 'CI399 disable failed: %',v; END IF;
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','phq9'
  ) THEN RAISE EXCEPTION 'CI399 disabled instrument remained authorized'; END IF;
  v := public.test_ci399_set(
    '00000000-0000-0000-0000-000000000104','phq9',true
  );
  IF v <> 'OK' THEN RAISE EXCEPTION 'CI399 re-enable failed: %',v; END IF;
END $$;
RESET ROLE;

-- 29) Explicit capability revocation closes authorization without changing appointment.
UPDATE public.professional_capabilities
SET granted=false
WHERE professional_id='00000000-0000-0000-0000-000000000101'
  AND capability_key='clinical.instrument.apply';
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000501','phq9'
  ) THEN RAISE EXCEPTION 'CI399 revoked capability remained authorized'; END IF;
END $$;
RESET ROLE;
UPDATE public.professional_capabilities
SET granted=true
WHERE professional_id='00000000-0000-0000-0000-000000000101'
  AND capability_key='clinical.instrument.apply';

-- 30) The same rule works independently in tenant 2, proving settings are tenant-scoped.
INSERT INTO public.clinic_clinical_instrument_settings(
  clinic_id,instrument_key,enabled,configured_by
) VALUES (
  '00000000-0000-0000-0000-000000000002','phq9',true,
  '00000000-0000-0000-0000-000000000201'
);
SET ROLE authenticated;
DO $$ BEGIN
  IF NOT public.test_ci399_can(
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000505','phq9'
  ) THEN RAISE EXCEPTION 'CI399 tenant-2 authorized encounter denied'; END IF;
END $$;
RESET ROLE;

-- 31) Settings RLS does not leak another tenant's enablement.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clinic_clinical_instrument_settings
    WHERE clinic_id='00000000-0000-0000-0000-000000000002'
  ) THEN RAISE EXCEPTION 'CI399 settings tenant isolation failed'; END IF;
END $$;
RESET ROLE;

-- 32) Operational owner role alone never grants the clinical capability.
UPDATE public.professional_capabilities
SET granted=false
WHERE professional_id='00000000-0000-0000-0000-000000000104'
  AND capability_key='clinical.instrument.apply';
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000506','phq9'
  ) THEN RAISE EXCEPTION 'CI399 owner role bypassed explicit capability denial'; END IF;
END $$;
RESET ROLE;
UPDATE public.professional_capabilities
SET granted=true
WHERE professional_id='00000000-0000-0000-0000-000000000104'
  AND capability_key='clinical.instrument.apply';

-- 33) Encounter authority fails closed for unknown/non-scale instrument keys.
SET ROLE authenticated;
DO $$ BEGIN
  IF public.test_ci399_can(
       '00000000-0000-0000-0000-000000000101',
       '00000000-0000-0000-0000-000000000501','unknown')
     OR public.test_ci399_can(
       '00000000-0000-0000-0000-000000000101',
       '00000000-0000-0000-0000-000000000501','eem') THEN
    RAISE EXCEPTION 'CI399 unknown/non-scale instrument escaped';
  END IF;
END $$;
RESET ROLE;

-- 34) C-01 Nexus read policies remain exactly unchanged after #399.
DO $$ BEGIN
  IF EXISTS (
    (SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM ci399_nexus_policy_snapshot
     EXCEPT
     SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname='public'
       AND tablename IN ('nexus_clinical_results','nexus_red_flags','nexus_self_assessment_invites'))
    UNION ALL
    (SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname='public'
       AND tablename IN ('nexus_clinical_results','nexus_red_flags','nexus_self_assessment_invites')
     EXCEPT
     SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM ci399_nexus_policy_snapshot)
  ) THEN RAISE EXCEPTION 'CI399 altered Nexus read-policy surface'; END IF;
END $$;

-- 35) C-06 authority helpers remain byte-identical.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM ci399_nexus_helper_snapshot s
    JOIN pg_proc p ON p.oid::regprocedure::text=s.signature
    WHERE md5(p.prosrc) IS DISTINCT FROM s.body_md5
  ) OR (SELECT count(*) FROM ci399_nexus_helper_snapshot) <> 2 THEN
    RAISE EXCEPTION 'CI399 altered protected C06 helper';
  END IF;
END $$;

-- 36) Trusted Nexus result contracts, including PHQ/GAD rule/version identity,
-- remain data-for-data unchanged. #399 only reads them as provenance.
DO $$ BEGIN
  IF EXISTS (
    (SELECT * FROM ci399_nexus_contract_snapshot
     EXCEPT
     SELECT module_key, tool_key, rule_key, rule_version, required_capability
     FROM public.nexus_result_contracts)
    UNION ALL
    (SELECT module_key, tool_key, rule_key, rule_version, required_capability
     FROM public.nexus_result_contracts
     EXCEPT
     SELECT * FROM ci399_nexus_contract_snapshot)
  ) THEN RAISE EXCEPTION 'CI399 modified Nexus trusted result contracts'; END IF;
END $$;

-- 37) Structural proof: contextual helper is appointment/professional/status specific,
-- contains no owner/admin read helper and no fisio_id compatibility authority.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(
    'public.can_apply_clinical_instrument_in_encounter(uuid,text)'::regprocedure
  ) INTO v_src;
  IF position('a.professional_id = v_uid' in v_src)=0
     OR position('a.status = ''em_atendimento''' in v_src)=0
     OR position('clinical_instrument_base_authorized' in v_src)=0
     OR position('can_access_patient_clinical_record' in v_src)>0
     OR position('fisio_id' in v_src)>0
     OR position('owner' in lower(v_src))>0
     OR position('admin' in lower(v_src))>0 THEN
    RAISE EXCEPTION 'CI399 contextual helper structural contract drift';
  END IF;
END $$;

-- 38) Structural proof: the internal base composes generic clinical identity,
-- neutral explicit capability, patient tenant and enabled setting. It does not
-- consult Nexus authorization or the read-care helper.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(
    'public.clinical_instrument_base_authorized(uuid,text)'::regprocedure
  ) INTO v_src;
  IF position('current_user_has_valid_clinical_identity() IS NOT TRUE' in v_src)=0
     OR position('current_user_has_clinical_capability(''clinical.instrument.apply'') IS NOT TRUE' in v_src)=0
     OR position('clinic_clinical_instrument_settings' in v_src)=0
     OR position('p.clinic_id = v_clinic' in v_src)=0
     OR position('s.enabled IS TRUE' in v_src)=0
     OR position('has_professional_capability' in v_src)>0
     OR position('can_access_patient_clinical_record' in v_src)>0
     OR position('''nexus.scales''' in v_src)>0 THEN
    RAISE EXCEPTION 'CI399 base helper structural contract drift';
  END IF;
END $$;

SELECT 'CLINICAL_INSTRUMENT_ENCOUNTER_399_BEHAVIOR_OK_38_CASES' AS result;
