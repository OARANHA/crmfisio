\echo '1) manager helper contains assessments.custom gate'
SELECT p.proname,
  pg_get_functiondef(p.oid) ILIKE '%clinic_entitlement_allowed(v_clinic_id, ''assessments.custom'')%' AS has_entitlement_gate
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname='require_assessment_template_manager';

\echo '2) assessment_templates mutation trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.assessment_templates'::regclass
    AND tgname='trg_guard_custom_assessment_template_entitlement'
    AND NOT tgisinternal
) AS ok;

\echo '3) assessment_template_versions mutation trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.assessment_template_versions'::regclass
    AND tgname='trg_guard_custom_assessment_version_entitlement'
    AND NOT tgisinternal
) AS ok;

\echo '4) template trigger contains assessments.custom gate'
SELECT p.proname,
  pg_get_functiondef(p.oid) ILIKE '%clinic_entitlement_allowed(v_clinic_id, ''assessments.custom'')%' AS has_entitlement_gate
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='guard_custom_assessment_template_entitlement';

\echo '5) version trigger contains assessments.custom gate'
SELECT p.proname,
  pg_get_functiondef(p.oid) ILIKE '%clinic_entitlement_allowed(v_clinic_id, ''assessments.custom'')%' AS has_entitlement_gate
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='guard_custom_assessment_version_entitlement';

\echo '6) standard assessment reads remain independent from entitlement'
SELECT NOT EXISTS (
  SELECT 1
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='assessment_templates'
    AND policyname='assessment_templates_read_available'
    AND coalesce(qual,'') ILIKE '%assessments.custom%'
) AS standard_reads_not_gated;
