\echo '1) authenticated can select consent_terms'
SELECT has_table_privilege('authenticated', 'public.consent_terms', 'SELECT') AS ok;

\echo '2) authenticated cannot insert consent_terms directly'
SELECT NOT has_table_privilege('authenticated', 'public.consent_terms', 'INSERT') AS insert_denied;

\echo '3) authenticated cannot update consent_terms directly'
SELECT NOT has_table_privilege('authenticated', 'public.consent_terms', 'UPDATE') AS update_denied;

\echo '4) authenticated cannot delete consent_terms directly'
SELECT NOT has_table_privilege('authenticated', 'public.consent_terms', 'DELETE') AS delete_denied;

\echo '5) anon cannot mutate consent_terms'
SELECT
  NOT has_table_privilege('anon', 'public.consent_terms', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.consent_terms', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.consent_terms', 'DELETE') AS anon_mutation_denied;

\echo '6) create consent RPC exists'
SELECT to_regprocedure('public.create_patient_consent(uuid,uuid)') IS NOT NULL AS ok;

\echo '7) accept consent RPC exists'
SELECT to_regprocedure('public.accept_patient_consent(uuid,text,text)') IS NOT NULL AS ok;

\echo '8) cancel consent RPC exists'
SELECT to_regprocedure('public.cancel_patient_consent(uuid,text)') IS NOT NULL AS ok;

\echo '9) authenticated can execute all consent lifecycle RPCs'
SELECT
  has_function_privilege('authenticated', 'public.create_patient_consent(uuid,uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.accept_patient_consent(uuid,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.cancel_patient_consent(uuid,text)', 'EXECUTE') AS authenticated_rpc_allowed;

\echo '10) anon cannot execute consent lifecycle RPCs'
SELECT
  NOT has_function_privilege('anon', 'public.create_patient_consent(uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.accept_patient_consent(uuid,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.cancel_patient_consent(uuid,text)', 'EXECUTE') AS anon_rpc_denied;
