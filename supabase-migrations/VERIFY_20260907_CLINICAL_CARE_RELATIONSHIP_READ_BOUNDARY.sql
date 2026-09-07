\pset pager off

\echo '1) canonical care-access helper exists'
SELECT to_regprocedure('public.can_access_patient_clinical_record(uuid)') IS NOT NULL AS helper_exists;

\echo '2) helper is SECURITY DEFINER with pinned search_path'
SELECT
  p.prosecdef AS security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') LIKE '%search_path=public, pg_temp%' AS search_path_pinned
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'can_access_patient_clinical_record';

\echo '3) helper grants are authenticated-only'
SELECT
  NOT has_function_privilege('anon', 'public.can_access_patient_clinical_record(uuid)', 'EXECUTE') AS anon_denied,
  NOT has_function_privilege('PUBLIC', 'public.can_access_patient_clinical_record(uuid)', 'EXECUTE') AS public_denied,
  has_function_privilege('authenticated', 'public.can_access_patient_clinical_record(uuid)', 'EXECUTE') AS authenticated_allowed;

\echo '4) helper encodes manager + fisio care relationship semantics'
WITH fn AS (
  SELECT pg_get_functiondef(p.oid) AS src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'can_access_patient_clinical_record'
)
SELECT
  src LIKE '%v_role IN (''owner'', ''admin'')%' AS managers_allowed,
  src LIKE '%v_role <> ''fisio''%' AS nonclinical_denied,
  src LIKE '%a.fisio_id = v_uid%' AS appointment_relationship,
  src LIKE '%professional_id = v_uid%' AS authored_relationship
FROM fn;

\echo '5) sensitive patient snapshot uses canonical care boundary'
WITH fn AS (
  SELECT pg_get_functiondef(p.oid) AS src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'list_patient_clinical_snapshot'
)
SELECT src LIKE '%can_access_patient_clinical_record(p.id)%' AS snapshot_care_scoped
FROM fn;

\echo '6) legacy broad FOR ALL policies are gone'
SELECT
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='physiotherapy_evaluations'
      AND policyname='evaluations_write_clinical'
  ) AS evaluations_broad_policy_removed,
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='physiotherapy_evolutions'
      AND policyname='evolutions_write_clinical'
  ) AS evolutions_broad_policy_removed;

\echo '7) legacy clinical reads are care-scoped and writes remain author-only'
SELECT
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='physiotherapy_evaluations'
      AND policyname='evaluations_select_care_relationship'
      AND cmd='SELECT'
      AND qual LIKE '%can_access_patient_clinical_record%'
  ) AS evaluations_read_scoped,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='physiotherapy_evaluations'
      AND policyname='evaluations_insert_author'
      AND cmd='INSERT'
      AND with_check LIKE '%professional_id = auth.uid()%'
  ) AS evaluations_insert_author_only,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='physiotherapy_evolutions'
      AND policyname='evolutions_select_care_relationship'
      AND cmd='SELECT'
      AND qual LIKE '%can_access_patient_clinical_record%'
  ) AS evolutions_read_scoped,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='physiotherapy_evolutions'
      AND policyname='evolutions_update_author'
      AND cmd='UPDATE'
      AND qual LIKE '%professional_id = auth.uid()%'
  ) AS evolutions_update_author_only;

\echo '8) structured assessment and body-map reads are care-scoped'
SELECT
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='clinical_assessments'
      AND policyname='clinical_assessments_read_care_relationship'
      AND qual LIKE '%can_access_patient_clinical_record%'
  ) AS assessments_scoped,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='assessment_body_points'
      AND policyname='assessment_body_points_read_care_relationship'
      AND qual LIKE '%can_access_patient_clinical_record%'
  ) AS body_points_scoped;

\echo '9) Nexus clinical reads are care-scoped'
SELECT
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nexus_clinical_results'
      AND policyname='nexus_results_read_care_relationship'
      AND qual LIKE '%can_access_patient_clinical_record%'
  ) AS nexus_results_scoped,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nexus_red_flags'
      AND policyname='nexus_red_flags_read_care_relationship'
      AND qual LIKE '%can_access_patient_clinical_record%'
  ) AS nexus_red_flags_scoped,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nexus_self_assessment_invites'
      AND policyname='nexus_self_assessment_care_read'
      AND qual LIKE '%can_access_patient_clinical_record%'
  ) AS nexus_self_assessment_scoped;

\echo '10) operational patient SELECT projection remains available'
SELECT
  has_column_privilege('authenticated', 'public.patients', 'nome', 'SELECT') AS patient_name_readable,
  has_column_privilege('authenticated', 'public.patients', 'telefone', 'SELECT') AS patient_phone_readable,
  NOT has_column_privilege('authenticated', 'public.patients', 'anamnese', 'SELECT') AS anamnese_direct_read_denied,
  NOT has_column_privilege('authenticated', 'public.patients', 'queixa_principal', 'SELECT') AS complaint_direct_read_denied;
