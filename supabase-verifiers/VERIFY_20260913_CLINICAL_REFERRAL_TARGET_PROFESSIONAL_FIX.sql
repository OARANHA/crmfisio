-- Production-safe verifier for the D2-E4 fixed-target scheduling correction.
DO $$
DECLARE v_schedule text;
BEGIN
  IF to_regprocedure('public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)') IS NULL THEN
    RAISE EXCEPTION 'clinical_referral_target_schedule_rpc_missing';
  END IF;

  v_schedule := lower(pg_get_functiondef(
    'public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)'::regprocedure
  ));

  IF position('clinical_referral_operation_self_or_fixed_target_required' IN v_schedule) = 0
     OR v_schedule !~ 'destination_scope\s*=\s*''internal_professional'''
     OR v_schedule !~ 'p_professional_id\s+is\s+not\s+distinct\s+from\s+v_op\.target_profile_id' THEN
    RAISE EXCEPTION 'clinical_referral_fixed_target_exception_missing';
  END IF;

  IF position('clinical_referral_operation_self_schedule_required' IN v_schedule) > 0 THEN
    RAISE EXCEPTION 'clinical_referral_legacy_self_only_guard_present';
  END IF;

  IF position('clinical_referral_operation_target_required' IN v_schedule) = 0 THEN
    RAISE EXCEPTION 'clinical_referral_fixed_target_guard_missing';
  END IF;

  IF has_function_privilege('anon','public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)','execute') THEN
    RAISE EXCEPTION 'clinical_referral_operation_anon_execute_granted';
  END IF;

  IF NOT has_function_privilege('authenticated','public.schedule_clinical_referral_operation(uuid,date,time without time zone,time without time zone,uuid,uuid,text,integer,uuid)','execute') THEN
    RAISE EXCEPTION 'clinical_referral_operation_authenticated_execute_missing';
  END IF;
END $$;

SELECT 'CLINICAL REFERRAL TARGET PROFESSIONAL FIX VERIFY PASSED' AS result;
