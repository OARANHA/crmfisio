\pset pager off
\echo 'MEDICSPRO — MULTIPROFESSIONAL CLINICAL FOUNDATION VERIFIER'

\echo '1) generic clinical identity helper exists'
SELECT to_regprocedure('public.current_user_has_valid_clinical_identity()') IS NOT NULL AS helper_exists;

\echo '2) generic clinical capability helper exists'
SELECT to_regprocedure('public.current_user_has_clinical_capability(text)') IS NOT NULL AS helper_exists;

\echo '3) generic clinical authorship helper exists'
SELECT to_regprocedure('public.current_user_can_author_clinical_record()') IS NOT NULL AS helper_exists;

\echo '4) helpers are SECURITY DEFINER with pinned search_path'
SELECT
  bool_and(p.prosecdef) AS security_definer,
  bool_and(array_to_string(p.proconfig, ',') ILIKE '%search_path=public, pg_temp%') AS search_path_pinned
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'current_user_has_valid_clinical_identity',
    'current_user_has_clinical_capability',
    'current_user_can_author_clinical_record'
  );

\echo '5) helper grants are authenticated-only'
SELECT
  NOT has_function_privilege('public', 'public.current_user_has_valid_clinical_identity()', 'EXECUTE') AS identity_public_denied,
  NOT has_function_privilege('anon', 'public.current_user_has_valid_clinical_identity()', 'EXECUTE') AS identity_anon_denied,
  has_function_privilege('authenticated', 'public.current_user_has_valid_clinical_identity()', 'EXECUTE') AS identity_authenticated_allowed,
  NOT has_function_privilege('public', 'public.current_user_has_clinical_capability(text)', 'EXECUTE') AS capability_public_denied,
  NOT has_function_privilege('anon', 'public.current_user_has_clinical_capability(text)', 'EXECUTE') AS capability_anon_denied,
  has_function_privilege('authenticated', 'public.current_user_has_clinical_capability(text)', 'EXECUTE') AS capability_authenticated_allowed;

\echo '6) canonical generic clinical capabilities are present'
SELECT
  count(*) FILTER (WHERE capability_key = 'clinical.attend' AND clinical IS TRUE AND active IS TRUE) = 1 AS attend,
  count(*) FILTER (WHERE capability_key = 'clinical.timeline.read' AND clinical IS TRUE AND active IS TRUE) = 1 AS timeline,
  count(*) FILTER (WHERE capability_key = 'clinical.evolution.write' AND clinical IS TRUE AND active IS TRUE) = 1 AS evolution,
  count(*) FILTER (WHERE capability_key = 'clinical.assessment.apply' AND clinical IS TRUE AND active IS TRUE) = 1 AS assessment,
  count(*) FILTER (WHERE capability_key = 'clinical.body_map' AND clinical IS TRUE AND active IS TRUE) = 1 AS body_map,
  count(*) FILTER (WHERE capability_key = 'clinical.documents' AND clinical IS TRUE AND active IS TRUE) = 1 AS documents
FROM public.capability_catalog;

\echo '7) identity helper knows physiotherapy, psychology, medicine and chiropractic paths'
WITH src AS (
  SELECT pg_get_functiondef('public.current_user_has_valid_clinical_identity()'::regprocedure) AS def
)
SELECT
  def ILIKE '%crefito%' AS physiotherapy,
  def ILIKE '%crp%' AS psychology,
  def ILIKE '%crm%' AS medicine,
  (def ILIKE '%quiroprax%' OR def ILIKE '%chiropract%') AS chiropractic
FROM src;

\echo '8) legacy clinical write policies use generic capabilities'
SELECT
  coalesce((SELECT coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
            FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
            WHERE c.relname = 'physiotherapy_evaluations' AND pol.polname = 'evaluations_insert_author'), '')
    ILIKE '%current_user_has_clinical_capability%' AS evaluations_generic,
  coalesce((SELECT coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
            FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
            WHERE c.relname = 'physiotherapy_evolutions' AND pol.polname = 'evolutions_insert_author'), '')
    ILIKE '%current_user_has_clinical_capability%' AS evolutions_generic,
  coalesce((SELECT coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
            FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
            WHERE c.relname = 'clinical_assessments' AND pol.polname = 'clinical_assessments_insert_author'), '')
    ILIKE '%current_user_has_clinical_capability%' AS assessments_generic;

\echo '9) body-map writes require generic body-map capability'
SELECT
  bool_and(
    (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''))
      ILIKE '%clinical.body_map%'
  ) AS body_map_capability_required
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
WHERE c.relname = 'assessment_body_points'
  AND pol.polname IN (
    'assessment_body_points_insert_author',
    'assessment_body_points_update_author',
    'assessment_body_points_delete_author'
  );

\echo '10) clinical appointment transitions use generic attend/evolution capabilities'
WITH defs AS (
  SELECT p.proname, pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'guard_appointment_clinical_self_transition',
      'guard_appointment_status_transition',
      'require_evolution_before_appointment_finalize'
    )
)
SELECT
  bool_and(def ILIKE '%current_user_has_clinical_capability%') AS generic_capability_boundary,
  bool_or(def ILIKE '%clinical.attend%') AS attend_required,
  bool_or(def ILIKE '%clinical.evolution.write%') AS evolution_required
FROM defs;

\echo '11) Nexus medical identity helpers remain installed and separate'
SELECT
  to_regprocedure('public.current_nexus_medical_identity_valid()') IS NOT NULL AS nexus_medical_helper_exists,
  to_regprocedure('public.current_nexus_entitlement_allowed()') IS NOT NULL AS nexus_entitlement_helper_exists,
  to_regprocedure('public.has_professional_capability(text)') IS NOT NULL AS nexus_capability_helper_exists;

\echo '12) transitional fisio bridge is still explicit for staged cutover'
WITH src AS (
  SELECT pg_get_functiondef('public.current_user_has_clinical_capability(text)'::regprocedure) AS def
)
SELECT def ILIKE '%v_role = ''fisio''%' AS legacy_bridge_present
FROM src;
