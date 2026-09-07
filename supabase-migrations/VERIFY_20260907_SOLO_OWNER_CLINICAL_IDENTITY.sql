\pset pager off
\echo 'MEDICSPRO — SOLO OWNER CLINICAL IDENTITY VERIFIER'

\echo '1) canonical physiotherapy authorship helper exists'
SELECT to_regprocedure('public.current_user_can_author_physiotherapy()') IS NOT NULL AS helper_exists;

\echo '2) helper is SECURITY DEFINER with pinned search_path'
SELECT
  p.prosecdef AS security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') LIKE '%search_path=public, pg_temp%' AS search_path_pinned
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'current_user_can_author_physiotherapy';

\echo '3) helper grants are authenticated-only'
WITH fn AS (
  SELECT p.oid, coalesce(p.proacl, acldefault('f', p.proowner)) AS acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'current_user_can_author_physiotherapy'
), expanded AS (
  SELECT
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
    x.privilege_type
  FROM fn
  CROSS JOIN LATERAL aclexplode(fn.acl) x
)
SELECT
  NOT EXISTS (SELECT 1 FROM expanded WHERE grantee = 'PUBLIC' AND privilege_type = 'EXECUTE') AS public_denied,
  NOT EXISTS (SELECT 1 FROM expanded WHERE grantee = 'anon' AND privilege_type = 'EXECUTE') AS anon_denied,
  EXISTS (SELECT 1 FROM expanded WHERE grantee = 'authenticated' AND privilege_type = 'EXECUTE') AS authenticated_allowed;

\echo '4) helper preserves legacy fisio and requires validated CREFITO identity for managers'
SELECT
  pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure) LIKE '%v_role = ''fisio''%' AS legacy_fisio_preserved,
  pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure) LIKE '%v_role NOT IN (''owner'', ''admin'')%' AS manager_scope_explicit,
  pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure) LIKE '%v_council_type = ''crefito''%' AS crefito_required,
  pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure) LIKE '%v_council_state <> ''''%' AS council_state_required,
  pg_get_functiondef('public.current_user_can_author_physiotherapy()'::regprocedure) LIKE '%v_registration <> ''''%' AS registration_required;

\echo '5) legacy physiotherapy writes use the canonical helper and remain self-authored'
SELECT
  coalesce((SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='physiotherapy_evaluations' AND pol.polname='evaluations_insert_author'), '') LIKE '%current_user_can_author_physiotherapy%' AS evaluations_helper,
  coalesce((SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='physiotherapy_evaluations' AND pol.polname='evaluations_insert_author'), '') LIKE '%professional_id = auth.uid()%' AS evaluations_self,
  coalesce((SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='physiotherapy_evolutions' AND pol.polname='evolutions_insert_author'), '') LIKE '%current_user_can_author_physiotherapy%' AS evolutions_helper,
  coalesce((SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='physiotherapy_evolutions' AND pol.polname='evolutions_insert_author'), '') LIKE '%professional_id = auth.uid()%' AS evolutions_self;

\echo '6) structured assessments and body map use canonical authorship'
SELECT
  coalesce((SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='clinical_assessments' AND pol.polname='clinical_assessments_insert_author'), '') LIKE '%current_user_can_author_physiotherapy%' AS assessments_helper,
  coalesce((SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='clinical_assessments' AND pol.polname='clinical_assessments_insert_author'), '') LIKE '%professional_id = auth.uid()%' AS assessments_self,
  coalesce((SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='assessment_body_points' AND pol.polname='assessment_body_points_insert_author'), '') LIKE '%current_user_can_author_physiotherapy%' AS body_points_helper;

\echo '7) clinical start/finalize require clinical identity and self-assignment'
SELECT
  pg_get_functiondef('public.guard_appointment_clinical_self_transition()'::regprocedure) LIKE '%current_user_can_author_physiotherapy%' AS transition_identity_required,
  pg_get_functiondef('public.guard_appointment_clinical_self_transition()'::regprocedure) LIKE '%OLD.fisio_id IS DISTINCT FROM auth.uid()%' AS transition_old_self,
  pg_get_functiondef('public.guard_appointment_clinical_self_transition()'::regprocedure) LIKE '%NEW.fisio_id IS DISTINCT FROM auth.uid()%' AS transition_new_self,
  pg_get_functiondef('public.guard_appointment_status_transition()'::regprocedure) LIKE '%v_clinical%' AS status_clinical_split;

\echo '8) clinical finalization requires same-session evolution by the authenticated author'
SELECT
  pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) LIKE '%current_user_can_author_physiotherapy%' AS finalization_identity_required,
  pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) LIKE '%e.session_id = NEW.id%' AS exact_session_required,
  pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) LIKE '%e.professional_id = auth.uid()%' AS author_evolution_required,
  pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure) LIKE '%NEW.fisio_id IS DISTINCT FROM auth.uid()%' AS assigned_professional_required;

\echo '9) Nexus medical identity boundary remains separate and installed'
SELECT
  to_regprocedure('public.current_nexus_medical_identity_valid()') IS NOT NULL AS nexus_medical_helper_exists,
  to_regprocedure('public.current_nexus_entitlement_allowed()') IS NOT NULL AS nexus_entitlement_helper_exists,
  to_regprocedure('public.has_professional_capability(text)') IS NOT NULL AS capability_helper_exists;

\echo '10) canonical clinic role model remains unchanged (no synthetic solo role)'
SELECT
  NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE role::text NOT IN ('owner','admin','fisio','recep','financeiro')
  ) AS canonical_roles_only;
