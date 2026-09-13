-- Production-safe structural verifier for D2-E4.
DO $$
DECLARE v_schedule text;
BEGIN
  IF to_regclass('public.clinical_referral_operations') IS NULL
     OR to_regclass('public.clinical_referral_operation_events') IS NULL THEN
    RAISE EXCEPTION 'clinical_referral_operation_tables_missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.clinical_referral_operations'::regclass AND contype='u' AND pg_get_constraintdef(oid) ILIKE '%referral_document_id%') THEN
    RAISE EXCEPTION 'clinical_referral_operation_idempotency_constraint_missing';
  END IF;
  IF to_regprocedure('public.open_clinical_referral_operation(uuid)') IS NULL
     OR to_regprocedure('public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)') IS NULL THEN
    RAISE EXCEPTION 'clinical_referral_operation_rpc_missing';
  END IF;
  v_schedule := lower(pg_get_functiondef('public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)'::regprocedure));
  IF position('current_clinic_id()' IN v_schedule)=0 OR position('insert into public.appointments' IN v_schedule)=0 OR position('target_required' IN v_schedule)=0 THEN
    RAISE EXCEPTION 'clinical_referral_operation_schedule_boundary_missing';
  END IF;
  IF has_function_privilege('anon','public.open_clinical_referral_operation(uuid)','execute')
     OR has_function_privilege('anon','public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)','execute') THEN
    RAISE EXCEPTION 'clinical_referral_operation_anon_execute_granted';
  END IF;
END $$;

SELECT 'CLINICAL REFERRAL OPERATIONAL CONTINUITY V1 VERIFY PASSED' AS result;
