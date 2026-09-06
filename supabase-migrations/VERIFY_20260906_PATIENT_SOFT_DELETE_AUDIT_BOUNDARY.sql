\echo '1) patient deleted-state guard function exists'
SELECT to_regprocedure('public.guard_patient_deleted_state()') IS NOT NULL AS ok;

\echo '2) patient deleted-state trigger exists'
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.patients'::regclass
    AND tgname = 'trg_guard_patient_deleted_state'
    AND NOT tgisinternal
) AS ok;

\echo '3) browser cannot execute deleted-state guard directly'
SELECT
  NOT has_function_privilege('authenticated', 'public.guard_patient_deleted_state()', 'EXECUTE') AS authenticated_denied,
  NOT has_function_privilege('anon', 'public.guard_patient_deleted_state()', 'EXECUTE') AS anon_denied;

\echo '4) guard protects deleted_at changes'
SELECT position('NEW.deleted_at IS DISTINCT FROM OLD.deleted_at' in pg_get_functiondef('public.guard_patient_deleted_state()'::regprocedure)) > 0 AS deleted_state_guarded;

\echo '5) soft-delete RPC exists'
SELECT to_regprocedure('public.soft_delete_patient(uuid,text)') IS NOT NULL AS ok;

\echo '6) restore RPC exists'
SELECT to_regprocedure('public.restore_soft_deleted_patient(uuid,text)') IS NOT NULL AS ok;

\echo '7) lifecycle RPCs are owner/admin only and require reason'
SELECT
  position('v_role NOT IN (''owner'',''admin'')' in pg_get_functiondef('public.soft_delete_patient(uuid,text)'::regprocedure)) > 0
  AND position('Motivo da exclusão lógica é obrigatório' in pg_get_functiondef('public.soft_delete_patient(uuid,text)'::regprocedure)) > 0
  AND position('v_role NOT IN (''owner'',''admin'')' in pg_get_functiondef('public.restore_soft_deleted_patient(uuid,text)'::regprocedure)) > 0
  AND position('Motivo da restauração é obrigatório' in pg_get_functiondef('public.restore_soft_deleted_patient(uuid,text)'::regprocedure)) > 0
  AS lifecycle_guarded;

\echo '8) soft-delete disables operational contact and audits action'
SELECT
  position('opt_in_whats = false' in pg_get_functiondef('public.soft_delete_patient(uuid,text)'::regprocedure)) > 0
  AND position('EXCLUSAO_LOGICA_PACIENTE' in pg_get_functiondef('public.soft_delete_patient(uuid,text)'::regprocedure)) > 0
  AS deletion_audited;

\echo '9) restore refuses anonymized patients and audits action'
SELECT
  position('anonimizado = false' in pg_get_functiondef('public.restore_soft_deleted_patient(uuid,text)'::regprocedure)) > 0
  AND position('RESTAURACAO_PACIENTE' in pg_get_functiondef('public.restore_soft_deleted_patient(uuid,text)'::regprocedure)) > 0
  AS restoration_guarded;

\echo '10) authenticated can execute lifecycle RPCs, anon cannot, and browser lacks direct DELETE grant'
SELECT
  has_function_privilege('authenticated', 'public.soft_delete_patient(uuid,text)', 'EXECUTE') AS authenticated_delete_rpc_allowed,
  has_function_privilege('authenticated', 'public.restore_soft_deleted_patient(uuid,text)', 'EXECUTE') AS authenticated_restore_rpc_allowed,
  NOT has_function_privilege('anon', 'public.soft_delete_patient(uuid,text)', 'EXECUTE') AS anon_delete_rpc_denied,
  NOT has_function_privilege('anon', 'public.restore_soft_deleted_patient(uuid,text)', 'EXECUTE') AS anon_restore_rpc_denied,
  NOT has_table_privilege('authenticated', 'public.patients', 'DELETE') AS direct_delete_denied;
