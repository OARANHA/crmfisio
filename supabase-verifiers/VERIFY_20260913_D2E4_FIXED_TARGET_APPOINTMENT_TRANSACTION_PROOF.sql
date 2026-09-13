-- Read-only verifier for the D2-E4 fixed-target appointment transaction proof.
\pset pager off

DO $$
DECLARE
  v_guard text;
  v_schedule text;
  v_event_constraint text;
  v_proof_constraint text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinical_referral_operation_events'
      AND column_name='transaction_xid' AND data_type='bigint'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinical_referral_operation_events'
      AND column_name='patient_id' AND data_type='uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinical_referral_operation_events'
      AND column_name='target_profile_id' AND data_type='uuid'
  ) THEN
    RAISE EXCEPTION 'd2e4_fixed_target_proof_columns_missing';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_event_constraint
  FROM pg_constraint
  WHERE conrelid='public.clinical_referral_operation_events'::regclass
    AND conname='clinical_referral_operation_events_event_type_check';
  IF v_event_constraint IS NULL OR position('appointment_insert_authorized' in v_event_constraint)=0 THEN
    RAISE EXCEPTION 'd2e4_fixed_target_proof_event_type_missing';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_proof_constraint
  FROM pg_constraint
  WHERE conrelid='public.clinical_referral_operation_events'::regclass
    AND conname='clinical_referral_operation_events_insert_proof_shape_check';
  IF v_proof_constraint IS NULL
     OR position('transaction_xid' in v_proof_constraint)=0
     OR position('patient_id' in v_proof_constraint)=0
     OR position('target_profile_id' in v_proof_constraint)=0
     OR position('actor_id' in v_proof_constraint)=0 THEN
    RAISE EXCEPTION 'd2e4_fixed_target_proof_shape_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='clinical_referral_operation_events'
      AND indexname='clinical_referral_operation_events_tx_proof_idx'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND indexdef LIKE '%appointment_insert_authorized%'
  ) THEN
    RAISE EXCEPTION 'd2e4_fixed_target_unique_transaction_index_missing';
  END IF;

  SELECT pg_get_functiondef(
    'public.guard_appointment_mutation_boundary()'::regprocedure
  ) INTO v_guard;
  IF position('appointment_professional_self_assignment_required' in v_guard)=0
     OR position('appointment_professional_self_mutation_required' in v_guard)=0
     OR position('appointment_insert_authorized' in v_guard)=0
     OR position('txid_current()' in v_guard)=0
     OR position('o.status = ''received''' in v_guard)=0
     OR position('e.clinic_id = new.clinic_id' in lower(v_guard))=0
     OR position('e.patient_id = new.paciente_id' in lower(v_guard))=0
     OR position('e.actor_id = auth.uid()' in lower(v_guard))=0
     OR position('e.target_profile_id = v_assigned_professional' in lower(v_guard))=0 THEN
    RAISE EXCEPTION 'd2e4_fixed_target_guard_contract_missing';
  END IF;

  SELECT pg_get_functiondef(
    'public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)'::regprocedure
  ) INTO v_schedule;
  IF position('appointment_insert_authorized' in v_schedule)=0
     OR position('txid_current()' in v_schedule)=0
     OR position('patient_id = v_op.patient_id' in lower(v_schedule))=0
     OR position('v_doc_target is distinct from v_op.target_profile_id' in lower(v_schedule))=0
     OR position('can_access_patient_clinical_record(v_op.patient_id)' in lower(v_schedule))=0 THEN
    RAISE EXCEPTION 'd2e4_fixed_target_schedule_revalidation_missing';
  END IF;

  IF has_table_privilege('authenticated','public.clinical_referral_operation_events','INSERT') THEN
    RAISE EXCEPTION 'd2e4_authenticated_can_forge_proof';
  END IF;

  IF has_function_privilege(
       'anon',
       'public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'd2e4_anon_schedule_execute_present';
  END IF;

  IF NOT has_function_privilege(
       'authenticated',
       'public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'd2e4_authenticated_schedule_execute_missing';
  END IF;
END $$;

SELECT 'D2-E4 FIXED TARGET APPOINTMENT TRANSACTION PROOF VERIFY PASSED' AS result;
