-- MedicsPro #400 — read-only installed-contract verifier.
-- Intentionally validates structure/functions only. It does NOT scan or reject
-- historical future-dated rows already physically in em_atendimento.
--
-- Historical-verifier rule: validate the installed abstraction contract and the
-- temporal invariant, not the implementation body of the operational-date helper.
-- The #400 migration/harness separately fingerprints the implementation introduced
-- by #400 (America/Sao_Paulo). This verifier must remain compatible with a later,
-- explicit per-clinic timezone implementation behind the same safe helper contract.

BEGIN;
SET TRANSACTION READ ONLY;

\echo 'VERIFY #400 — Encounter Temporal Start Boundary'

DO $$
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'ci400_verifier_not_read_only';
  END IF;
  IF current_setting('server_version_num')::integer < 160000 THEN
    RAISE EXCEPTION 'ci400_postgresql_16_required';
  END IF;
END;
$$;

-- 1) Operational-date helper exposes the stable, internal date abstraction.
-- Do not inspect timezone/current_date implementation here: a future migration may
-- legitimately make this tenant-aware while preserving this installed contract.
DO $$
DECLARE
  p record;
BEGIN
  SELECT * INTO p
  FROM pg_proc
  WHERE oid='public.current_clinic_operational_date()'::regprocedure;

  IF NOT FOUND
     OR p.prorettype <> 'date'::regtype
     OR p.provolatile <> 's'
     OR NOT p.prosecdef
     OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, pg_temp'],false)
     OR has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'ci400_operational_date_helper_contract_drift';
  END IF;
END;
$$;

-- 2) Dedicated temporal trigger guard preserves trusted internal bypass and
-- applies only when a row enters em_atendimento. The guard must consume the
-- operational-date abstraction, whatever its future implementation becomes.
DO $$
DECLARE
  p record;
  v_src text;
BEGIN
  SELECT * INTO p
  FROM pg_proc
  WHERE oid='public.guard_appointment_encounter_temporal_start()'::regprocedure;

  IF NOT FOUND
     OR NOT p.prosecdef
     OR NOT coalesce(p.proconfig @> ARRAY['search_path=public, pg_temp'],false)
     OR has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'ci400_temporal_guard_contract_drift';
  END IF;

  v_src := pg_get_functiondef(p.oid);
  IF position('auth.role()' in v_src)=0
     OR position('service_role' in v_src)=0
     OR position('session_user' in v_src)=0
     OR position('postgres' in v_src)=0
     OR position('supabase_admin' in v_src)=0
     OR position('NEW.status IS DISTINCT FROM ''em_atendimento''' in v_src)=0
     OR position('TG_OP = ''UPDATE''' in v_src)=0
     OR position('OLD.status IS NOT DISTINCT FROM ''em_atendimento''' in v_src)=0
     OR position('NEW.data > v_operational_date' in v_src)=0
     OR position('current_clinic_operational_date()' in v_src)=0
     OR position('appointment_future_encounter_start_forbidden' in v_src)=0 THEN
    RAISE EXCEPTION 'ci400_temporal_guard_source_drift';
  END IF;
END;
$$;

-- 3) Both INSERT and status-UPDATE entry points are physically guarded.
DO $$
DECLARE
  v_insert_def text;
  v_update_def text;
BEGIN
  SELECT pg_get_triggerdef(t.oid)
    INTO v_insert_def
  FROM pg_trigger t
  WHERE t.tgrelid='public.appointments'::regclass
    AND t.tgname='trg_h_appointment_encounter_temporal_start_insert'
    AND NOT t.tgisinternal
    AND t.tgenabled='O'
    AND t.tgfoid='public.guard_appointment_encounter_temporal_start()'::regprocedure;

  SELECT pg_get_triggerdef(t.oid)
    INTO v_update_def
  FROM pg_trigger t
  WHERE t.tgrelid='public.appointments'::regclass
    AND t.tgname='trg_h_appointment_encounter_temporal_start_update'
    AND NOT t.tgisinternal
    AND t.tgenabled='O'
    AND t.tgfoid='public.guard_appointment_encounter_temporal_start()'::regprocedure;

  IF v_insert_def IS NULL
     OR position('BEFORE INSERT' in upper(v_insert_def))=0
     OR v_update_def IS NULL
     OR position('BEFORE UPDATE OF status' in v_update_def)=0 THEN
    RAISE EXCEPTION 'ci400_temporal_trigger_contract_drift';
  END IF;
END;
$$;

-- 4) #399 defense in depth uses the exact same operational-date abstraction while
-- preserving its own-appointment/status/base-authorization contract.
DO $$
DECLARE
  p record;
  v_src text;
BEGIN
  SELECT * INTO p
  FROM pg_proc
  WHERE oid='public.can_apply_clinical_instrument_in_encounter(uuid,text)'::regprocedure;

  IF NOT FOUND OR NOT p.prosecdef OR p.provolatile <> 's'
     OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'ci400_ci399_helper_acl_or_shape_drift';
  END IF;

  v_src := pg_get_functiondef(p.oid);
  IF position('a.professional_id = v_uid' in v_src)=0
     OR position('a.status = ''em_atendimento''' in v_src)=0
     OR position('a.data <= public.current_clinic_operational_date()' in v_src)=0
     OR position('clinical_instrument_base_authorized' in v_src)=0
     OR position('can_access_patient_clinical_record' in v_src)>0
     OR position('fisio_id' in v_src)>0 THEN
    RAISE EXCEPTION 'ci400_ci399_temporal_defense_drift';
  END IF;
END;
$$;

-- 5) Existing clinical instrument foundation remains untouched: no result or
-- remote-delivery persistence is introduced by the temporal slice.
DO $$
BEGIN
  IF to_regclass('public.clinical_instrument_results') IS NOT NULL
     OR to_regclass('public.clinical_instrument_deliveries') IS NOT NULL THEN
    RAISE EXCEPTION 'ci400_unapproved_instrument_persistence_present';
  END IF;
END;
$$;

\echo 'VERIFY #400 OK — temporal abstraction/guards intact; helper implementation may evolve; historical rows not scanned'
ROLLBACK;
