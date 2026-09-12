BEGIN;
SET TRANSACTION READ ONLY;
DO $$
DECLARE helper text; snapshot text;
BEGIN
  SELECT pg_get_functiondef('public.can_access_patient_clinical_record(uuid)'::regprocedure) INTO helper;
  SELECT pg_get_functiondef('public.list_patient_clinical_snapshot()'::regprocedure) INTO snapshot;
  IF helper IS NULL OR snapshot IS NULL THEN RAISE EXCEPTION 'clinical_care_read_helper_missing'; END IF;
  IF position('clinical.timeline.read' IN helper)=0 OR position('current_user_has_valid_clinical_identity' IN helper)=0
     OR position('a.fisio_id=v_uid' IN replace(helper,' ',''))=0 OR position('v_role IN (''owner'',''admin'')' IN helper)=0
     OR position('v_role <> ''professional''' IN helper)=0 OR helper ~* 'v_role[^;]*(=|<>|in)[^;]*fisio' THEN
    RAISE EXCEPTION 'clinical_care_read_boundary_drift';
  END IF;
  IF position('can_access_patient_clinical_record(p.id)' IN snapshot)=0
     OR snapshot ~* 'v_role[^;]*(=|<>|in)[^;]*fisio' THEN RAISE EXCEPTION 'clinical_snapshot_boundary_drift'; END IF;
  IF NOT has_function_privilege('authenticated','public.can_access_patient_clinical_record(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.can_access_patient_clinical_record(uuid)','EXECUTE') THEN RAISE EXCEPTION 'clinical_care_read_acl_drift'; END IF;
END $$;
SELECT 'CLINICAL CARE RELATIONSHIP READ RECONCILIATION VERIFY PASSED' AS result;
ROLLBACK;
