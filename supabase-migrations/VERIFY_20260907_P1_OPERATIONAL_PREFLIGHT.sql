\pset pager off

\echo 'MEDICSPRO P1 OPERATIONAL PREFLIGHT — read-only'
\echo 'This verifier does not mutate production data.'

\echo '1) tenant/session canonical RPCs exist'
SELECT
  to_regprocedure('public.current_tenant_access_state()') IS NOT NULL AS tenant_state_rpc,
  to_regprocedure('public.current_active_profile()') IS NOT NULL AS active_profile_rpc,
  to_regprocedure('public.current_clinic_id()') IS NOT NULL AS clinic_id_rpc,
  to_regprocedure('public.current_app_role()') IS NOT NULL AS app_role_rpc;

\echo '2) tenant/session RPCs are SECURITY DEFINER with pinned search_path where required'
SELECT
  bool_and(p.prosecdef) AS security_definer,
  bool_and(array_to_string(p.proconfig, ',') ILIKE '%search_path=public, pg_temp%') AS search_path_pinned
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('current_tenant_access_state','current_active_profile');

\echo '3) canonical clinic roles only; platform_admin is not stored as clinic role'
SELECT
  count(*) FILTER (WHERE role::text NOT IN ('owner','admin','fisio','recep','financeiro')) = 0 AS canonical_roles_only,
  count(*) FILTER (WHERE role::text = 'platform_admin') = 0 AS no_platform_admin_in_profiles
FROM public.profiles;

\echo '4) profile/auth/clinic referential health'
SELECT
  count(*) FILTER (WHERE u.id IS NULL) = 0 AS all_profiles_have_auth_user,
  count(*) FILTER (WHERE c.id IS NULL) = 0 AS all_profiles_have_clinic,
  count(*) FILTER (WHERE u.id IS NOT NULL AND p.id IS DISTINCT FROM u.id) = 0 AS auth_profile_ids_match
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN public.clinics c ON c.id = p.clinic_id;

\echo '5) inactive users and suspended clinics are represented for negative-path testing'
SELECT
  count(*) FILTER (WHERE p.ativo IS TRUE) AS active_profiles,
  count(*) FILTER (WHERE p.ativo IS FALSE) AS inactive_profiles,
  count(*) FILTER (WHERE c.lifecycle_status = 'active' AND c.deleted_at IS NULL) AS active_clinic_profiles,
  count(*) FILTER (WHERE c.lifecycle_status = 'suspended' AND c.deleted_at IS NULL) AS suspended_clinic_profiles
FROM public.profiles p
JOIN public.clinics c ON c.id = p.clinic_id;

\echo '6) at least two non-deleted clinics exist for real multi-tenant smoke testing'
SELECT
  count(*) AS non_deleted_clinics,
  count(*) >= 2 AS two_clinics_available
FROM public.clinics
WHERE deleted_at IS NULL;

\echo '7) critical tenant tables have RLS enabled'
WITH expected(relname) AS (
  VALUES
    ('profiles'), ('patients'), ('appointments'), ('payments'),
    ('physiotherapy_evaluations'), ('physiotherapy_evolutions'),
    ('clinical_assessments'), ('assessment_body_points'),
    ('wa_logs'), ('wa_events')
), state AS (
  SELECT e.relname, c.oid, c.relrowsecurity
  FROM expected e
  LEFT JOIN pg_class c
    ON c.relname = e.relname
   AND c.relnamespace = 'public'::regnamespace
)
SELECT
  count(*) FILTER (WHERE oid IS NOT NULL) = 10 AS all_tables_present,
  bool_and(coalesce(relrowsecurity, false)) AS rls_enabled_on_all
FROM state;

\echo '8) clinical care relationship boundary is present'
SELECT
  to_regprocedure('public.can_access_patient_clinical_record(uuid)') IS NOT NULL AS care_helper_exists,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='physiotherapy_evolutions'
      AND policyname='evolutions_select_care_relationship'
  ) AS evolutions_care_scoped,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='physiotherapy_evaluations'
      AND policyname='evaluations_select_care_relationship'
  ) AS evaluations_care_scoped;

\echo '9) server-authoritative LGPD export is installed and authenticated-only'
WITH fn AS (
  SELECT p.oid, p.proacl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='export_patient_data_lgpd'
  LIMIT 1
), acl AS (
  SELECT x.grantee, x.privilege_type
  FROM fn, LATERAL aclexplode(fn.proacl) x
)
SELECT
  EXISTS (SELECT 1 FROM fn) AS export_rpc_exists,
  NOT EXISTS (SELECT 1 FROM acl WHERE grantee=0 AND privilege_type='EXECUTE') AS public_denied,
  coalesce((SELECT has_function_privilege('authenticated', oid, 'EXECUTE') FROM fn), false) AS authenticated_allowed;

\echo '10) team atomic mutation RPCs remain service-role only'
WITH fns AS (
  SELECT p.oid, p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN ('admin_create_team_profile_atomic','admin_update_team_profile_atomic')
)
SELECT
  count(*) FILTER (WHERE proname='admin_create_team_profile_atomic') = 1 AS create_rpc_exists,
  count(*) FILTER (WHERE proname='admin_update_team_profile_atomic') = 1 AS update_rpc_exists,
  bool_and(NOT has_function_privilege('authenticated', oid, 'EXECUTE')) AS authenticated_denied,
  bool_and(has_function_privilege('service_role', oid, 'EXECUTE')) AS service_role_allowed
FROM fns;

\echo '11) WhatsApp uncertain-delivery safeguards remain installed'
WITH fns AS (
  SELECT p.oid, p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN ('requeue_stale_messages','reconcile_whatsapp_outbound_event')
)
SELECT
  count(*) FILTER (WHERE proname='requeue_stale_messages') = 1 AS stale_guard_exists,
  count(*) FILTER (WHERE proname='reconcile_whatsapp_outbound_event') = 1 AS reconciliation_exists,
  bool_and(NOT has_function_privilege('authenticated', oid, 'EXECUTE')) AS authenticated_denied,
  bool_and(has_function_privilege('service_role', oid, 'EXECUTE')) AS service_role_allowed
FROM fns;

\echo '12) no orphaned tenant rows in core operational tables'
SELECT
  (SELECT count(*) FROM public.patients p LEFT JOIN public.clinics c ON c.id=p.clinic_id WHERE c.id IS NULL) = 0 AS patients_ok,
  (SELECT count(*) FROM public.appointments a LEFT JOIN public.clinics c ON c.id=a.clinic_id WHERE c.id IS NULL) = 0 AS appointments_ok,
  (SELECT count(*) FROM public.payments x LEFT JOIN public.clinics c ON c.id=x.clinic_id WHERE c.id IS NULL) = 0 AS payments_ok,
  (SELECT count(*) FROM public.wa_logs w LEFT JOIN public.clinics c ON c.id=w.clinic_id WHERE c.id IS NULL) = 0 AS wa_logs_ok;

\echo '13) same-tenant references are not crossed in core patient-linked tables'
SELECT
  (SELECT count(*) FROM public.appointments a JOIN public.patients p ON p.id=a.paciente_id WHERE a.clinic_id IS DISTINCT FROM p.clinic_id) = 0 AS appointments_patient_same_tenant,
  (SELECT count(*) FROM public.payments x JOIN public.patients p ON p.id=x.patient_id WHERE x.clinic_id IS DISTINCT FROM p.clinic_id) = 0 AS payments_patient_same_tenant,
  (SELECT count(*) FROM public.wa_logs w JOIN public.patients p ON p.id=w.patient_id WHERE w.clinic_id IS DISTINCT FROM p.clinic_id) = 0 AS messages_patient_same_tenant;

\echo '14) live smoke-test inventory (counts only; no PII)'
SELECT
  count(*) FILTER (WHERE lifecycle_status='active' AND deleted_at IS NULL) AS active_clinics,
  count(*) FILTER (WHERE lifecycle_status='suspended' AND deleted_at IS NULL) AS suspended_clinics,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted_clinics
FROM public.clinics;

SELECT
  count(*) FILTER (WHERE p.ativo IS TRUE AND c.lifecycle_status='active' AND c.deleted_at IS NULL) AS active_users_on_active_clinic,
  count(*) FILTER (WHERE p.ativo IS FALSE) AS inactive_users,
  count(*) FILTER (WHERE p.ativo IS TRUE AND c.lifecycle_status='suspended' AND c.deleted_at IS NULL) AS active_users_on_suspended_clinic
FROM public.profiles p
JOIN public.clinics c ON c.id=p.clinic_id;

\echo '15) P1 preflight summary'
SELECT
  'GREEN when checks 1-13 are true. Check 6 and section 14 indicate whether production already contains fixtures for the final two-clinic/suspended live smoke test.' AS guidance;
