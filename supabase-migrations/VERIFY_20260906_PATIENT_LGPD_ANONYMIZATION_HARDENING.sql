\echo '1) patient LGPD guard function exists'
SELECT to_regprocedure('public.guard_patient_lgpd_state()') IS NOT NULL AS ok;

\echo '2) patient LGPD guard trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.patients'::regclass
    AND tgname = 'trg_guard_patient_lgpd_state'
    AND NOT tgisinternal
) AS ok;

\echo '3) browser cannot execute LGPD guard directly'
SELECT
  NOT has_function_privilege('authenticated', 'public.guard_patient_lgpd_state()', 'EXECUTE') AS authenticated_denied,
  NOT has_function_privilege('anon', 'public.guard_patient_lgpd_state()', 'EXECUTE') AS anon_denied;

\echo '4) guard protects anonymizado state'
SELECT position('NEW.anonimizado IS DISTINCT FROM OLD.anonimizado' in pg_get_functiondef('public.guard_patient_lgpd_state()'::regprocedure)) > 0 AS anonymization_state_guarded;

\echo '5) guard prevents re-identification of anonymized patients'
SELECT position('Paciente anonimizado não pode ser reidentificado' in pg_get_functiondef('public.guard_patient_lgpd_state()'::regprocedure)) > 0 AS reidentification_guarded;

\echo '6) anonymization RPC exists'
SELECT to_regprocedure('public.anonymize_patient_lgpd(uuid)') IS NOT NULL AS ok;

\echo '7) anonymization RPC remains owner/admin only'
SELECT
  position('v_role NOT IN (''owner'',''admin'')' in pg_get_functiondef('public.anonymize_patient_lgpd(uuid)'::regprocedure)) > 0
  AS owner_admin_guarded;

\echo '8) anonymization clears patient registry v2 identifiers'
SELECT
  position('preferred_name = NULL' in pg_get_functiondef('public.anonymize_patient_lgpd(uuid)'::regprocedure)) > 0
  AND position('address_line = NULL' in pg_get_functiondef('public.anonymize_patient_lgpd(uuid)'::regprocedure)) > 0
  AND position('insurance_number = NULL' in pg_get_functiondef('public.anonymize_patient_lgpd(uuid)'::regprocedure)) > 0
  AND position('administrative_notes = NULL' in pg_get_functiondef('public.anonymize_patient_lgpd(uuid)'::regprocedure)) > 0
  AND position('avatar_path = NULL' in pg_get_functiondef('public.anonymize_patient_lgpd(uuid)'::regprocedure)) > 0
  AS v2_identifiers_cleared;

\echo '9) authenticated can execute anonymization RPC and anon cannot'
SELECT
  has_function_privilege('authenticated', 'public.anonymize_patient_lgpd(uuid)', 'EXECUTE') AS authenticated_allowed,
  NOT has_function_privilege('anon', 'public.anonymize_patient_lgpd(uuid)', 'EXECUTE') AS anon_denied;

\echo '10) current anonymized patients do not retain direct/v2 identifiers'
SELECT NOT EXISTS (
  SELECT 1
  FROM public.patients
  WHERE anonimizado = true
    AND deleted_at IS NULL
    AND (
      cpf IS NOT NULL OR telefone IS NOT NULL OR email IS NOT NULL
      OR preferred_name IS NOT NULL OR address_line IS NOT NULL
      OR insurance_number IS NOT NULL OR administrative_notes IS NOT NULL
      OR avatar_path IS NOT NULL OR queixa_principal IS NOT NULL
    )
) AS no_retained_identifiers;
