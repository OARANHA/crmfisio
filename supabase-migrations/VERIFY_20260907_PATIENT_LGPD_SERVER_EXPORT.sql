\pset pager off

SELECT '1) server-authoritative LGPD export RPC exists' AS check_name;
SELECT to_regprocedure('public.export_patient_data_lgpd(uuid)') IS NOT NULL AS export_rpc_exists;

SELECT '2) RPC is SECURITY DEFINER with pinned search_path' AS check_name;
SELECT
  p.prosecdef AS security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') ILIKE '%search_path=public, pg_temp%' AS search_path_pinned,
  pg_get_function_result(p.oid) = 'jsonb' AS returns_jsonb
FROM pg_proc p
WHERE p.oid = 'public.export_patient_data_lgpd(uuid)'::regprocedure;

SELECT '3) anonymous execution is denied and authenticated execution is allowed' AS check_name;
SELECT
  NOT has_function_privilege('anon', 'public.export_patient_data_lgpd(uuid)', 'EXECUTE') AS anon_denied,
  has_function_privilege('authenticated', 'public.export_patient_data_lgpd(uuid)', 'EXECUTE') AS authenticated_allowed;

SELECT '4) tenant and admin authorization are enforced inside the RPC' AS check_name;
WITH definition AS (
  SELECT lower(pg_get_functiondef('public.export_patient_data_lgpd(uuid)'::regprocedure)) AS body
)
SELECT
  body LIKE '%current_clinic_id%' AS uses_current_clinic,
  body LIKE '%current_app_role%' AS uses_current_role,
  body LIKE '%owner%' AND body LIKE '%admin%' AS owner_admin_only,
  body LIKE '%clinic_id = v_clinic%' AS tenant_qualified
FROM definition;

SELECT '5) canonical patient domains are assembled server-side' AS check_name;
WITH definition AS (
  SELECT lower(pg_get_functiondef('public.export_patient_data_lgpd(uuid)'::regprocedure)) AS body
)
SELECT
  body LIKE '%public.appointments%' AS appointments,
  body LIKE '%public.appointment_status_history%' AS appointment_history,
  body LIKE '%public.physiotherapy_evaluations%' AS physiotherapy_evaluations,
  body LIKE '%public.physiotherapy_evolutions%' AS evolutions,
  body LIKE '%public.consent_terms%' AS consents,
  body LIKE '%public.nps_surveys%' AS nps,
  body LIKE '%public.patient_packages%' AS packages,
  body LIKE '%public.payments%' AS finance,
  body LIKE '%public.wa_logs%' AS communications
FROM definition;

SELECT '6) structured clinical and Nexus domains are included' AS check_name;
WITH definition AS (
  SELECT lower(pg_get_functiondef('public.export_patient_data_lgpd(uuid)'::regprocedure)) AS body
)
SELECT
  body LIKE '%public.clinical_assessments%' AS clinical_assessments,
  body LIKE '%public.assessment_body_points%' AS body_map,
  body LIKE '%public.nexus_clinical_results%' AS nexus_results,
  body LIKE '%public.nexus_red_flags%' AS nexus_red_flags,
  body LIKE '%public.nexus_self_assessment_invites%' AS nexus_self_assessments
FROM definition;

SELECT '7) invitation secret and signature storage URL are excluded' AS check_name;
WITH definition AS (
  SELECT lower(pg_get_functiondef('public.export_patient_data_lgpd(uuid)'::regprocedure)) AS body
)
SELECT
  body LIKE '%- ''token_hash''%' AS token_hash_excluded,
  body LIKE '%- ''assinatura_url''%' AS signature_url_excluded
FROM definition;

SELECT '8) export and audit are one server-side operation' AS check_name;
WITH definition AS (
  SELECT lower(pg_get_functiondef('public.export_patient_data_lgpd(uuid)'::regprocedure)) AS body
)
SELECT
  body LIKE '%lgpd-portabilidade-v2%' AS contract_v2,
  body LIKE '%serverauthoritative%' AS server_authoritative_marker,
  body LIKE '%insert into public.audit_log%' AS audit_insert,
  body LIKE '%exportacao_lgpd%' AS audit_action
FROM definition;
