-- MedicsPro — P0 C-01: care relationship AND Nexus authorization.
-- Additive rollout: replace read policies only; no data or write-contract changes.
-- Restrictive guards prevent any coexisting permissive SELECT/ALL policy from
-- restoring the old owner/admin OR timeline bypass. Service-role RPCs retain
-- their existing, independently authorized, token/processor contracts.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Exact dependency fingerprints: refuse missing/stale/custom helper definitions.
-- This is drift detection, not a cryptographic authenticity guarantee.
DO $$
DECLARE expected record; actual record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('authenticated','anon') AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'nexus_c01_browser_role_bypasses_rls';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('public.current_clinic_id()', '678fac3c2bb8698a44f8a9d9b282f53d'),
    ('public.current_app_role()', '7b2e6e62d9fb349ba6aa48c0744c34a7'),
    ('public.current_nexus_medical_identity_valid()', '59f4b68dda8c2c166ba803ad62f2b509'),
    ('public.current_nexus_entitlement_allowed()', 'fb31e7618a47bd017ad21ec60b12b084'),
    ('public.has_professional_capability(text)', 'd3c1b16fc57c4da3f304ba086a382991'),
    ('public.can_access_patient_clinical_record(uuid)', 'e466279f68d4858a34dfc9dee8de3d98')
  ) AS v(signature, body_md5) LOOP
    SELECT p.* INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature);
    IF NOT FOUND THEN RAISE EXCEPTION 'nexus_c01_missing_helper: %', expected.signature; END IF;
    IF md5(actual.prosrc) <> expected.body_md5 OR NOT actual.prosecdef
       OR actual.provolatile <> 's'
       OR NOT coalesce(actual.proconfig @> ARRAY['search_path=public, pg_temp'], false)
       OR NOT has_function_privilege('authenticated', actual.oid, 'EXECUTE')
       OR has_function_privilege('anon', actual.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'nexus_c01_helper_drift: %; review prerequisite migrations before proceeding', expected.signature;
    END IF;
  END LOOP;
END; $$;

ALTER TABLE public.nexus_clinical_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nexus_results_read_clinical ON public.nexus_clinical_results;
DROP POLICY IF EXISTS nexus_results_read_care_relationship ON public.nexus_clinical_results;
DROP POLICY IF EXISTS nexus_results_read_guard ON public.nexus_clinical_results;
CREATE POLICY nexus_results_read_care_relationship
ON public.nexus_clinical_results
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND public.has_professional_capability('nexus.access')
);

CREATE POLICY nexus_results_read_guard
ON public.nexus_clinical_results
AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND public.has_professional_capability('nexus.access')
);

ALTER TABLE public.nexus_red_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nexus_red_flags_read_clinical ON public.nexus_red_flags;
DROP POLICY IF EXISTS nexus_red_flags_read_care_relationship ON public.nexus_red_flags;
DROP POLICY IF EXISTS nexus_red_flags_read_guard ON public.nexus_red_flags;
CREATE POLICY nexus_red_flags_read_care_relationship
ON public.nexus_red_flags
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND public.has_professional_capability('nexus.access')
);

CREATE POLICY nexus_red_flags_read_guard
ON public.nexus_red_flags
AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND public.has_professional_capability('nexus.access')
);

ALTER TABLE public.nexus_self_assessment_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nexus_self_assessment_staff_read ON public.nexus_self_assessment_invites;
DROP POLICY IF EXISTS nexus_self_assessment_care_read ON public.nexus_self_assessment_invites;
DROP POLICY IF EXISTS nexus_self_assessment_read_guard ON public.nexus_self_assessment_invites;
CREATE POLICY nexus_self_assessment_care_read
ON public.nexus_self_assessment_invites
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND public.has_professional_capability('nexus.access')
  AND public.has_professional_capability('nexus.scales')
);

CREATE POLICY nexus_self_assessment_read_guard
ON public.nexus_self_assessment_invites
AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (
  clinic_id = public.current_clinic_id()
  AND public.can_access_patient_clinical_record(patient_id)
  AND public.has_professional_capability('nexus.access')
  AND public.has_professional_capability('nexus.scales')
);

COMMIT;
