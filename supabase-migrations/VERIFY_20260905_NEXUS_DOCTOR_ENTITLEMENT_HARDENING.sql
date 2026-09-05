\echo '1) medical identity helper exists'
SELECT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='current_nexus_medical_identity_valid'
) AS ok;

\echo '2) nexus entitlement helper is fail-closed and explicit'
SELECT pg_get_functiondef(p.oid) ILIKE '%platform_clinic_entitlements%'
   AND pg_get_functiondef(p.oid) ILIKE '%entitlement_key = ''nexus.access''%'
   AND pg_get_functiondef(p.oid) ILIKE '%enabled IS TRUE%'
   AS fail_closed_explicit
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='current_nexus_entitlement_allowed';

\echo '3) capability helper checks entitlement and medical identity before grants'
SELECT pg_get_functiondef(p.oid) ILIKE '%current_nexus_entitlement_allowed()%'
   AND pg_get_functiondef(p.oid) ILIKE '%current_nexus_medical_identity_valid()%'
   AND pg_get_functiondef(p.oid) ILIKE '%IF v_is_nexus THEN%'
   AS hardened
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='has_professional_capability';

\echo '4) medical identity requires physician + CRM context'
SELECT pg_get_functiondef(p.oid) ILIKE '%professional_type%'
   AND pg_get_functiondef(p.oid) ILIKE '%council_type%crm%'
   AND pg_get_functiondef(p.oid) ILIKE '%council_state%'
   AND pg_get_functiondef(p.oid) ILIKE '%registro%'
   AS crm_identity_required
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='current_nexus_medical_identity_valid';

\echo '5) Nexus results read policy requires nexus.access only'
SELECT (
         qual ILIKE '%has_professional_capability(''nexus.access'')%'
         OR qual ILIKE '%has_professional_capability(''nexus.access''::text)%'
       )
   AND qual NOT ILIKE '%owner%'
   AND qual NOT ILIKE '%clinical.patient_timeline%'
   AS doctor_nexus_only
FROM pg_policies
WHERE schemaname='public'
  AND tablename='nexus_clinical_results'
  AND policyname='nexus_results_read_clinical';

\echo '6) Nexus red flags read/ack policies require nexus.access'
SELECT policyname,
       (
         coalesce(qual,'') ILIKE '%has_professional_capability(''nexus.access'')%'
         OR coalesce(qual,'') ILIKE '%has_professional_capability(''nexus.access''::text)%'
       )
       AND (
         policyname <> 'nexus_red_flags_acknowledge'
         OR coalesce(with_check,'') ILIKE '%has_professional_capability(''nexus.access'')%'
         OR coalesce(with_check,'') ILIKE '%has_professional_capability(''nexus.access''::text)%'
       )
       AS nexus_gate
FROM pg_policies
WHERE schemaname='public'
  AND tablename='nexus_red_flags'
  AND policyname IN ('nexus_red_flags_read_clinical','nexus_red_flags_acknowledge')
ORDER BY policyname;

\echo '7) Nexus evidence is no longer readable by every authenticated user'
SELECT (
         qual ILIKE '%has_professional_capability(''nexus.evidence'')%'
         OR qual ILIKE '%has_professional_capability(''nexus.evidence''::text)%'
       )
   AS nexus_evidence_gate
FROM pg_policies
WHERE schemaname='public'
  AND tablename='nexus_evidence_sources'
  AND policyname='nexus_evidence_read_authenticated';

\echo '8) anon cannot execute Nexus security helpers'
SELECT
  NOT has_function_privilege('anon', 'public.current_nexus_medical_identity_valid()', 'EXECUTE') AS medical_helper_anon_denied,
  NOT has_function_privilege('anon', 'public.current_nexus_entitlement_allowed()', 'EXECUTE') AS entitlement_helper_anon_denied,
  NOT has_function_privilege('anon', 'public.has_professional_capability(text)', 'EXECUTE') AS capability_helper_anon_denied;
