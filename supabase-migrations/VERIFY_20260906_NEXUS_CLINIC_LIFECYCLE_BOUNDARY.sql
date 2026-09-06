\pset pager off

SELECT '1) public resolve RPC exists' AS check,
       to_regprocedure('public.resolve_nexus_self_assessment(text)') IS NOT NULL AS ok;

SELECT '2) public resolve RPC requires active non-deleted clinic' AS check,
       pg_get_functiondef('public.resolve_nexus_self_assessment(text)'::regprocedure) ILIKE '%lifecycle_status = ''active''%'
       AND pg_get_functiondef('public.resolve_nexus_self_assessment(text)'::regprocedure) ILIKE '%deleted_at IS NULL%' AS ok;

SELECT '3) public submit RPC exists' AS check,
       to_regprocedure('public.submit_nexus_self_assessment(text,jsonb)') IS NOT NULL AS ok;

SELECT '4) public submit RPC requires active non-deleted clinic' AS check,
       pg_get_functiondef('public.submit_nexus_self_assessment(text,jsonb)'::regprocedure) ILIKE '%lifecycle_status = ''active''%'
       AND pg_get_functiondef('public.submit_nexus_self_assessment(text,jsonb)'::regprocedure) ILIKE '%deleted_at IS NULL%' AS ok;

SELECT '5) processor claim RPC exists' AS check,
       to_regprocedure('public.claim_nexus_self_assessment_invites(text,text,integer)') IS NOT NULL AS ok;

SELECT '6) processor claim excludes suspended/deleted clinics' AS check,
       pg_get_functiondef('public.claim_nexus_self_assessment_invites(text,text,integer)'::regprocedure) ILIKE '%JOIN public.clinics%'
       AND pg_get_functiondef('public.claim_nexus_self_assessment_invites(text,text,integer)'::regprocedure) ILIKE '%lifecycle_status = ''active''%'
       AND pg_get_functiondef('public.claim_nexus_self_assessment_invites(text,text,integer)'::regprocedure) ILIKE '%deleted_at IS NULL%' AS ok;

SELECT '7) processor completion RPC exists' AS check,
       to_regprocedure('public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)') IS NOT NULL AS ok;

SELECT '8) processor completion fails closed when clinic is inactive' AS check,
       pg_get_functiondef('public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)'::regprocedure) ILIKE '%clinic_not_active%'
       AND pg_get_functiondef('public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)'::regprocedure) ILIKE '%lifecycle_status = ''active''%'
       AND pg_get_functiondef('public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)'::regprocedure) ILIKE '%deleted_at IS NULL%' AS ok;

SELECT '9) public and service-role grants remain correctly separated' AS check,
       has_function_privilege('anon', 'public.resolve_nexus_self_assessment(text)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.resolve_nexus_self_assessment(text)', 'EXECUTE')
       AND has_function_privilege('anon', 'public.submit_nexus_self_assessment(text,jsonb)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.submit_nexus_self_assessment(text,jsonb)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.claim_nexus_self_assessment_invites(text,text,integer)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.claim_nexus_self_assessment_invites(text,text,integer)', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)', 'EXECUTE')
       AND has_function_privilege('service_role', 'public.claim_nexus_self_assessment_invites(text,text,integer)', 'EXECUTE')
       AND has_function_privilege('service_role', 'public.complete_nexus_self_assessment_processing(uuid,jsonb,jsonb)', 'EXECUTE') AS ok;

SELECT '10) suspended/deleted clinics have no active Nexus processing claims' AS check,
       NOT EXISTS (
         SELECT 1
         FROM public.nexus_self_assessment_invites i
         JOIN public.clinics c ON c.id = i.clinic_id
         WHERE (c.lifecycle_status <> 'active' OR c.deleted_at IS NOT NULL)
           AND i.status = 'submitted'
           AND i.processed_result_id IS NULL
           AND i.processing_started_at IS NOT NULL
       ) AS ok;
