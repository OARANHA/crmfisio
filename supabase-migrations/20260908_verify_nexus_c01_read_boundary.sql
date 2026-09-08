-- Read-only verifier. Use psql -X -v ON_ERROR_STOP=1 as database administrator.
-- Never treats a false boolean as a successful verification.
BEGIN READ ONLY;
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

DO $$
DECLARE expected record; actual record; expr text;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('nexus_clinical_results', 'nexus_results_read_care_relationship', 'nexus_results_read_guard', false),
    ('nexus_red_flags', 'nexus_red_flags_read_care_relationship', 'nexus_red_flags_read_guard', false),
    ('nexus_self_assessment_invites', 'nexus_self_assessment_care_read', 'nexus_self_assessment_read_guard', true)
  ) AS v(table_name, allow_name, guard_name, scales) LOOP
    IF NOT coalesce((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||expected.table_name)), false) THEN
      RAISE EXCEPTION 'nexus_c01_rls_disabled_or_missing: %',expected.table_name;
    END IF;
    expr := 'clinic_id=current_clinic_idANDcan_access_patient_clinical_recordpatient_idANDhas_professional_capability''nexus.access''';
    IF expected.scales THEN expr := expr||'ANDhas_professional_capability''nexus.scales'''; END IF;
    FOR actual IN SELECT * FROM pg_policies
      WHERE schemaname='public' AND tablename=expected.table_name
        AND policyname IN (expected.allow_name,expected.guard_name)
    LOOP
      IF actual.cmd <> 'SELECT' OR actual.with_check IS NOT NULL
        OR actual.permissive <> (CASE WHEN actual.policyname=expected.guard_name THEN 'RESTRICTIVE' ELSE 'PERMISSIVE' END)
        OR actual.roles <> (CASE WHEN actual.policyname=expected.guard_name THEN ARRAY['public']::name[] ELSE ARRAY['authenticated']::name[] END)
        OR regexp_replace(replace(replace(actual.qual,'public.',''),'::text',''),'[[:space:]()]','','g') IS DISTINCT FROM expr THEN
        RAISE EXCEPTION 'nexus_c01_policy_drift: %',actual.policyname;
      END IF;
    END LOOP;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=expected.table_name
        AND policyname IN (expected.allow_name,expected.guard_name)) <> 2 THEN
      RAISE EXCEPTION 'nexus_c01_missing_policies: %',expected.table_name;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname IN
    ('nexus_results_read_clinical','nexus_red_flags_read_clinical','nexus_self_assessment_staff_read')) THEN
    RAISE EXCEPTION 'nexus_c01_obsolete_read_policy';
  END IF;
END; $$;

-- Includes unchanged writes and authorization metadata. Extra permissive policies
-- cannot defeat the SELECT guards but must be reviewed for unrelated write drift.
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public'
  AND (tablename LIKE 'nexus_%' OR tablename IN ('professional_capabilities','capability_catalog'))
ORDER BY tablename, cmd, policyname;
SELECT 'NEXUS_C01_VERIFIED' AS result;
COMMIT;
