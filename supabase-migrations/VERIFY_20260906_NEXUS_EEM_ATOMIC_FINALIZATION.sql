-- Verify MedicsPro / Nexus atomic EEM finalization boundary.
WITH fn AS (
  SELECT p.oid,
         p.prosecdef,
         pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'finalize_nexus_eem_result'
    AND pg_get_function_identity_arguments(p.oid) = 'p_patient_id uuid, p_appointment_id uuid, p_rule_version text, p_input_snapshot jsonb, p_output_snapshot jsonb, p_classification text, p_severity text, p_interpretation text, p_soap_text text, p_evidence_snapshot jsonb, p_red_flags jsonb'
)
SELECT '01_function_exists' AS check_name, EXISTS (SELECT 1 FROM fn) AS ok
UNION ALL
SELECT '02_security_definer', coalesce((SELECT prosecdef FROM fn), false)
UNION ALL
SELECT '03_authenticated_execute', has_function_privilege('authenticated', 'public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb)', 'EXECUTE')
UNION ALL
SELECT '04_anon_no_execute', NOT has_function_privilege('anon', 'public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb)', 'EXECUTE')
UNION ALL
SELECT '05_public_no_execute', NOT has_function_privilege('public', 'public.finalize_nexus_eem_result(uuid,uuid,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb)', 'EXECUTE')
UNION ALL
SELECT '06_active_clinic_boundary', coalesce((SELECT def LIKE '%current_clinic_id()%' FROM fn), false)
UNION ALL
SELECT '07_nexus_eem_capability', coalesce((SELECT def LIKE '%has_professional_capability(''nexus.eem'')%' FROM fn), false)
UNION ALL
SELECT '08_patient_tenant_boundary', coalesce((SELECT def LIKE '%p.clinic_id = v_clinic_id%' AND def LIKE '%p.deleted_at IS NULL%' FROM fn), false)
UNION ALL
SELECT '09_appointment_author_boundary', coalesce((SELECT def LIKE '%a.fisio_id = auth.uid()%' FROM fn), false)
UNION ALL
SELECT '10_atomic_result_and_flags', coalesce((SELECT def LIKE '%INSERT INTO public.nexus_clinical_results%' AND def LIKE '%INSERT INTO public.nexus_red_flags%' AND def LIKE '%''finalized''%' FROM fn), false)
ORDER BY check_name;
