\echo '1) fixed internal-professional target succeeds through D2-E4 RPC'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);

SELECT id AS fixed_target_appointment_id
FROM public.schedule_clinical_referral_operation(
  'd4200000-0000-4000-8000-000000000001',
  current_date + 1,
  '10:00'::time,
  '11:00'::time,
  'd2100000-0000-4000-8000-000000000003',
  NULL,
  'Continuidade referral',
  0,
  NULL
);
RESET ROLE;

DO $$
DECLARE
  v_appointment_id uuid;
  v_professional_id uuid;
  v_patient_id uuid;
  v_status text;
  v_proofs integer;
  v_scheduled_events integer;
BEGIN
  SELECT appointment_id, status
    INTO v_appointment_id, v_status
  FROM public.clinical_referral_operations
  WHERE id = 'd4200000-0000-4000-8000-000000000001';

  IF v_appointment_id IS NULL OR v_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'd2e4_fixed_target_operation_not_scheduled';
  END IF;

  SELECT professional_id, paciente_id
    INTO v_professional_id, v_patient_id
  FROM public.appointments
  WHERE id = v_appointment_id;

  IF v_professional_id IS DISTINCT FROM 'd2100000-0000-4000-8000-000000000003'::uuid
     OR v_patient_id IS DISTINCT FROM 'd2200000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'd2e4_fixed_target_appointment_link_drift';
  END IF;

  SELECT count(*) INTO v_proofs
  FROM public.clinical_referral_operation_events
  WHERE operation_id = 'd4200000-0000-4000-8000-000000000001'
    AND event_type = 'appointment_insert_authorized'
    AND actor_id = 'd2100000-0000-4000-8000-000000000001'
    AND patient_id = 'd2200000-0000-4000-8000-000000000001'
    AND target_profile_id = 'd2100000-0000-4000-8000-000000000003'
    AND transaction_xid IS NOT NULL;

  SELECT count(*) INTO v_scheduled_events
  FROM public.clinical_referral_operation_events
  WHERE operation_id = 'd4200000-0000-4000-8000-000000000001'
    AND event_type = 'scheduled'
    AND appointment_id = v_appointment_id;

  IF v_proofs <> 1 OR v_scheduled_events <> 1 THEN
    RAISE EXCEPTION 'd2e4_fixed_target_audit_proof_drift';
  END IF;
END $$;

\echo '2) retry is idempotent and does not create a second appointment or proof'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);
SELECT id AS retry_appointment_id
FROM public.schedule_clinical_referral_operation(
  'd4200000-0000-4000-8000-000000000001',
  current_date + 2,
  '12:00'::time,
  '13:00'::time,
  'd2100000-0000-4000-8000-000000000003',
  NULL,
  'Tentativa idempotente',
  0,
  NULL
);
RESET ROLE;

DO $$
DECLARE v_proofs integer; v_scheduled integer;
BEGIN
  SELECT count(*) INTO v_proofs
  FROM public.clinical_referral_operation_events
  WHERE operation_id='d4200000-0000-4000-8000-000000000001'
    AND event_type='appointment_insert_authorized';
  SELECT count(*) INTO v_scheduled
  FROM public.clinical_referral_operation_events
  WHERE operation_id='d4200000-0000-4000-8000-000000000001'
    AND event_type='scheduled';
  IF v_proofs <> 1 OR v_scheduled <> 1 THEN
    RAISE EXCEPTION 'd2e4_retry_created_duplicate_side_effect';
  END IF;
END $$;

\echo '3) target C is denied when immutable referral target is B'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.schedule_clinical_referral_operation(
      'd4200000-0000-4000-8000-000000000002',
      current_date + 1, '10:00'::time, '11:00'::time,
      'd2100000-0000-4000-8000-000000000004', NULL,
      'Target C deve falhar', 0, NULL
    );
    RAISE EXCEPTION 'd2e4_arbitrary_target_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    IF SQLERRM IS DISTINCT FROM 'clinical_referral_operation_target_required' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '4) cross-tenant operation is not addressable by the caller'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.schedule_clinical_referral_operation(
      'd4200000-0000-4000-8000-000000000003',
      current_date + 1, '10:00'::time, '11:00'::time,
      'd2100000-0000-4000-8000-000000000013', NULL,
      'Cross tenant deve falhar', 0, NULL
    );
    RAISE EXCEPTION 'd2e4_cross_tenant_operation_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    IF SQLERRM IS DISTINCT FROM 'clinical_referral_operation_unavailable' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '5) persisted operation patient must still match immutable referral patient'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.schedule_clinical_referral_operation(
      'd4200000-0000-4000-8000-000000000005',
      current_date + 1, '10:00'::time, '11:00'::time,
      'd2100000-0000-4000-8000-000000000003', NULL,
      'Patient mismatch deve falhar', 0, NULL
    );
    RAISE EXCEPTION 'd2e4_patient_mismatch_was_allowed';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    IF SQLERRM IS DISTINCT FROM 'clinical_referral_operation_referral_mismatch' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '6) internal_service does not grant arbitrary cross-professional scheduling'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.schedule_clinical_referral_operation(
      'd4200000-0000-4000-8000-000000000004',
      current_date + 1, '10:00'::time, '11:00'::time,
      'd2100000-0000-4000-8000-000000000004', NULL,
      'Internal service arbitrary target', 0, NULL
    );
    RAISE EXCEPTION 'd2e4_internal_service_cross_professional_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    IF SQLERRM IS DISTINCT FROM 'clinical_referral_operation_self_or_fixed_target_required' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '7) direct professional A -> B appointment INSERT remains blocked after proof exists'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.appointments(
      clinic_id,paciente_id,fisio_id,professional_id,data,inicio,fim,status,tipo,valor
    ) VALUES (
      'd2000000-0000-4000-8000-000000000001',
      'd2200000-0000-4000-8000-000000000001',
      'd2100000-0000-4000-8000-000000000003',
      'd2100000-0000-4000-8000-000000000003',
      current_date + 3,'14:00'::time,'15:00'::time,'agendado','Direct cross professional',0
    );
    RAISE EXCEPTION 'd2e4_direct_cross_professional_insert_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    IF SQLERRM IS DISTINCT FROM 'appointment_professional_self_assignment_required' THEN
      RAISE;
    END IF;
  END;
END $$;
RESET ROLE;

\echo '8) completed-transaction proof is not reusable in a later transaction'
DO $$
DECLARE v_current_xid bigint; v_reusable integer;
BEGIN
  v_current_xid := txid_current();
  SELECT count(*) INTO v_reusable
  FROM public.clinical_referral_operation_events
  WHERE event_type='appointment_insert_authorized'
    AND transaction_xid=v_current_xid;
  IF v_reusable <> 0 THEN
    RAISE EXCEPTION 'd2e4_transaction_proof_reusable_across_transactions';
  END IF;
END $$;

\echo '9) authenticated browser cannot forge an authorization proof event'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.clinical_referral_operation_events(
      operation_id,clinic_id,event_type,actor_id,transaction_xid,patient_id,target_profile_id
    ) VALUES (
      'd4200000-0000-4000-8000-000000000002',
      'd2000000-0000-4000-8000-000000000001',
      'appointment_insert_authorized',
      'd2100000-0000-4000-8000-000000000001',
      txid_current(),
      'd2200000-0000-4000-8000-000000000001',
      'd2100000-0000-4000-8000-000000000003'
    );
    RAISE EXCEPTION 'd2e4_authenticated_proof_forgery_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END $$;
RESET ROLE;

\echo '10) normal professional self-scheduling remains allowed'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'd2100000-0000-4000-8000-000000000001', false);
INSERT INTO public.appointments(
  clinic_id,paciente_id,fisio_id,professional_id,data,inicio,fim,status,tipo,valor
) VALUES (
  'd2000000-0000-4000-8000-000000000001',
  'd2200000-0000-4000-8000-000000000001',
  'd2100000-0000-4000-8000-000000000001',
  'd2100000-0000-4000-8000-000000000001',
  current_date + 4,'16:00'::time,'17:00'::time,'agendado','Self scheduling regression',0
);
RESET ROLE;

\echo '11) immutable referral snapshot remains unchanged'
DO $$
DECLARE v_snapshot jsonb;
BEGIN
  SELECT payload_snapshot INTO v_snapshot
  FROM public.clinical_documents
  WHERE id='d4100000-0000-4000-8000-000000000001';
  IF v_snapshot->>'target_profile_id' IS DISTINCT FROM 'd2100000-0000-4000-8000-000000000003'
     OR v_snapshot->>'destination_scope' IS DISTINCT FROM 'internal_professional' THEN
    RAISE EXCEPTION 'd2e4_referral_snapshot_was_mutated';
  END IF;
END $$;
