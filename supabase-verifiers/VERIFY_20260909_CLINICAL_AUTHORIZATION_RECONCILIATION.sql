-- Production-safe verifier for the 20260909 clinical authorization reconciliation.
-- Catalog/definition inspection only: no application data is mutated.

BEGIN;
SET TRANSACTION READ ONLY;

DO $$
DECLARE
  v_src text;
  v_def text;
BEGIN
  IF current_setting('server_version_num')::integer < 160000 THEN
    RAISE EXCEPTION 'clinical_authorization_requires_postgresql_16';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.patient_journey_events'::regclass
      AND attname = 'transition_xid'
      AND atttypid = 'bigint'::regtype
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'clinical_authorization_missing_journey_transaction_proof';
  END IF;

  IF has_table_privilege('authenticated', 'public.patient_journey_events', 'INSERT')
     OR has_table_privilege('authenticated', 'public.patient_journey_events', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.patient_journey_events', 'DELETE') THEN
    RAISE EXCEPTION 'clinical_authorization_journey_proof_is_browser_forgeable';
  END IF;

  SELECT lower(pg_get_functiondef('public.transition_patient_journey(uuid,text,text,text)'::regprocedure))
    INTO v_src;

  IF v_src LIKE '%role::text <> ''fisio''%'
     OR v_src LIKE '%role::text = ''fisio''%'
     OR v_src NOT LIKE '%current_user_has_valid_clinical_identity()%'
     OR v_src NOT LIKE '%current_user_has_clinical_capability(''clinical.attend'')%'
     OR v_src NOT LIKE '%transition_xid%'
     OR v_src NOT LIKE '%txid_current()%'
     OR position('insert into public.patient_journey_events' in v_src) = 0
     OR position('update public.patients' in v_src) = 0
     OR position('insert into public.patient_journey_events' in v_src) > position('update public.patients' in v_src) THEN
    RAISE EXCEPTION 'clinical_authorization_patient_journey_contract_drift';
  END IF;

  IF v_src NOT LIKE '%(''owner'', ''admin'', ''recep'')%'
     OR v_src NOT LIKE '%current_clinic_entitlement_allowed(''crm.access'')%' THEN
    RAISE EXCEPTION 'clinical_authorization_operational_crm_handoff_drift';
  END IF;

  SELECT lower(pg_get_functiondef('public.guard_patient_crm_stage_entitlement()'::regprocedure))
    INTO v_src;

  IF v_src NOT LIKE '%patient_journey_events%'
     OR v_src NOT LIKE '%transition_xid = txid_current()%'
     OR v_src NOT LIKE '%actor_id = auth.uid()%'
     OR v_src NOT LIKE '%from_stage = old.funil_stage::text%'
     OR v_src NOT LIKE '%to_stage = new.funil_stage::text%'
     OR v_src NOT LIKE '%current_clinic_entitlement_allowed(''crm.access'')%'
     OR v_src NOT LIKE '%app_role not in (''owner'', ''admin'', ''recep'')%' THEN
    RAISE EXCEPTION 'clinical_authorization_crm_guard_drift';
  END IF;

  SELECT lower(coalesce(qual, '') || ' ' || coalesce(with_check, ''))
    INTO v_def
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'patients'
    AND policyname = 'patients_update_operational'
    AND cmd = 'UPDATE';

  IF v_def IS NULL
     OR v_def NOT LIKE '%owner%'
     OR v_def NOT LIKE '%admin%'
     OR v_def NOT LIKE '%recep%'
     OR v_def LIKE '%professional%'
     OR v_def LIKE '%fisio%' THEN
    RAISE EXCEPTION 'clinical_authorization_direct_patient_crm_policy_drift';
  END IF;

  SELECT lower(coalesce(with_check, ''))
    INTO v_def
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'appointments'
    AND policyname = 'appointments_insert_operational'
    AND cmd = 'INSERT';

  IF v_def IS NULL
     OR v_def NOT LIKE '%professional%'
     OR v_def NOT LIKE '%professional_id%'
     OR v_def NOT LIKE '%auth.uid()%'
     OR v_def LIKE '%''fisio''%' THEN
    RAISE EXCEPTION 'clinical_authorization_appointment_insert_policy_drift';
  END IF;

  SELECT lower(coalesce(qual, '') || ' ' || coalesce(with_check, ''))
    INTO v_def
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'appointments'
    AND policyname = 'appointments_update_operational'
    AND cmd = 'UPDATE';

  IF v_def IS NULL
     OR v_def NOT LIKE '%professional%'
     OR v_def NOT LIKE '%professional_id%'
     OR v_def NOT LIKE '%auth.uid()%'
     OR v_def LIKE '%''fisio''%' THEN
    RAISE EXCEPTION 'clinical_authorization_appointment_update_policy_drift';
  END IF;

  SELECT lower(pg_get_functiondef('public.guard_appointment_mutation_boundary()'::regprocedure))
    INTO v_src;
  IF v_src NOT LIKE '%v_role = ''professional''%'
     OR v_src NOT LIKE '%old.professional_id%'
     OR v_src NOT LIKE '%new.professional_id%'
     OR v_src NOT LIKE '%appointment_professional_self_mutation_required%'
     OR v_src NOT LIKE '%appointment_structural_update_requires_canonical_flow%'
     OR v_src NOT LIKE '%new.fisio_id is distinct from old.fisio_id%'
     OR v_src LIKE '%v_role = ''fisio''%' THEN
    RAISE EXCEPTION 'clinical_authorization_appointment_mutation_boundary_drift';
  END IF;

  SELECT lower(pg_get_functiondef('public.guard_appointment_clinical_self_transition()'::regprocedure))
    INTO v_src;
  IF v_src NOT LIKE '%clinical.attend%'
     OR v_src NOT LIKE '%old.professional_id is distinct from auth.uid()%'
     OR v_src NOT LIKE '%new.professional_id is distinct from auth.uid()%'
     OR v_src LIKE '%old.fisio_id is distinct from auth.uid()%'
     OR v_src LIKE '%v_role = ''fisio''%' THEN
    RAISE EXCEPTION 'clinical_authorization_appointment_self_transition_drift';
  END IF;

  SELECT lower(pg_get_functiondef('public.guard_appointment_status_transition()'::regprocedure))
    INTO v_src;
  IF v_src NOT LIKE '%new.status = ''em_atendimento''%'
     OR v_src NOT LIKE '%new.status = ''finalizado''%'
     OR v_src NOT LIKE '%clinical.attend%'
     OR v_src NOT LIKE '%old.professional_id = auth.uid()%'
     OR v_src NOT LIKE '%new.professional_id = auth.uid()%'
     OR v_src NOT LIKE '%(''recep'', ''professional'')%'
     OR v_src LIKE '%app_role = ''fisio''%' THEN
    RAISE EXCEPTION 'clinical_authorization_appointment_status_guard_drift';
  END IF;

  SELECT lower(pg_get_functiondef('public.require_evolution_before_appointment_finalize()'::regprocedure))
    INTO v_src;
  IF v_src NOT LIKE '%clinical.attend%'
     OR v_src NOT LIKE '%clinical.evolution.write%'
     OR v_src NOT LIKE '%new.professional_id is distinct from auth.uid()%'
     OR v_src NOT LIKE '%e.session_id = new.id%'
     OR v_src NOT LIKE '%e.professional_id = auth.uid()%'
     OR v_src LIKE '%v_role = ''fisio''%' THEN
    RAISE EXCEPTION 'clinical_authorization_finalize_evolution_guard_drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.patients'::regclass
      AND NOT t.tgisinternal
      AND p.proname = 'guard_patient_crm_stage_entitlement'
  ) THEN
    RAISE EXCEPTION 'clinical_authorization_patient_stage_trigger_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.appointments'::regclass
      AND NOT t.tgisinternal
      AND p.proname = 'guard_appointment_mutation_boundary'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.appointments'::regclass
      AND NOT t.tgisinternal
      AND p.proname = 'guard_appointment_status_transition'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.appointments'::regclass
      AND NOT t.tgisinternal
      AND p.proname = 'require_evolution_before_appointment_finalize'
  ) THEN
    RAISE EXCEPTION 'clinical_authorization_appointment_trigger_missing';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.transition_patient_journey(uuid,text,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.transition_patient_journey(uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'clinical_authorization_journey_rpc_acl_drift';
  END IF;
END;
$$;

ROLLBACK;
