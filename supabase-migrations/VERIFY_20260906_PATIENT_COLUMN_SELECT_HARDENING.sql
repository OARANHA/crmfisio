-- MEDICSPRO — verifier for patient column SELECT hardening
-- Expected: every row below returns t.

SELECT 'authenticated_has_no_table_select' AS check_name,
       NOT has_table_privilege('authenticated', 'public.patients', 'SELECT') AS ok;

SELECT 'anon_has_no_table_select' AS check_name,
       NOT has_table_privilege('anon', 'public.patients', 'SELECT') AS ok;

SELECT 'authenticated_can_read_operational_patient_columns' AS check_name,
       has_column_privilege('authenticated', 'public.patients', 'id', 'SELECT')
       AND has_column_privilege('authenticated', 'public.patients', 'nome', 'SELECT')
       AND has_column_privilege('authenticated', 'public.patients', 'preferred_name', 'SELECT')
       AND has_column_privilege('authenticated', 'public.patients', 'administrative_notes', 'SELECT')
       AND has_column_privilege('authenticated', 'public.patients', 'avatar_path', 'SELECT') AS ok;

SELECT 'authenticated_cannot_read_clinical_patient_columns_directly' AS check_name,
       NOT has_column_privilege('authenticated', 'public.patients', 'queixa_principal', 'SELECT')
       AND NOT has_column_privilege('authenticated', 'public.patients', 'cid10', 'SELECT')
       AND NOT has_column_privilege('authenticated', 'public.patients', 'anamnese', 'SELECT') AS ok;

SELECT 'authenticated_can_execute_clinical_snapshot' AS check_name,
       has_function_privilege('authenticated', 'public.list_patient_clinical_snapshot()', 'EXECUTE') AS ok;

SELECT 'anon_cannot_execute_clinical_snapshot' AS check_name,
       NOT has_function_privilege('anon', 'public.list_patient_clinical_snapshot()', 'EXECUTE') AS ok;
