BEGIN;
SET TRANSACTION READ ONLY;
DO $$
DECLARE helper text; snapshot text; helper_compact text; snapshot_compact text;
BEGIN
  SELECT pg_get_functiondef('public.can_access_patient_clinical_record(uuid)'::regprocedure) INTO helper;
  SELECT pg_get_functiondef('public.list_patient_clinical_snapshot()'::regprocedure) INTO snapshot;
  IF helper IS NULL OR snapshot IS NULL THEN RAISE EXCEPTION 'clinical_care_read_helper_missing'; END IF;
  helper_compact := regexp_replace(lower(helper),'\s+','','g');
  snapshot_compact := regexp_replace(lower(snapshot),'\s+','','g');
  IF position('clinical.timeline.read' IN helper)=0 OR position('current_user_has_valid_clinical_identity' IN helper)=0
     OR position('a.fisio_id=v_uid' IN helper_compact)=0 OR position('v_rolein(''owner'',''admin'')' IN helper_compact)=0
     OR position('v_role<>''professional''' IN helper_compact)=0 OR helper ~* 'v_role[^;]*(=|<>|in)[^;]*fisio'
     OR position('a.professional_id=v_uid' IN split_part(helper_compact,'orexists',1))>0 THEN
    RAISE EXCEPTION 'clinical_care_read_boundary_drift';
  END IF;
  IF position('can_access_patient_clinical_record(p.id)' IN snapshot_compact)=0
     OR position('p.clinic_id=v_clinic' IN snapshot_compact)=0
     OR position('p.deleted_atisnull' IN snapshot_compact)=0
     OR position('current_app_role' IN lower(snapshot))>0
     OR lower(snapshot) ~ E'\\m(owner|admin|professional|fisio)\\M' THEN
    RAISE EXCEPTION 'clinical_snapshot_boundary_drift';
  END IF;
  IF NOT has_function_privilege('authenticated','public.can_access_patient_clinical_record(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.can_access_patient_clinical_record(uuid)','EXECUTE') THEN RAISE EXCEPTION 'clinical_care_read_acl_drift'; END IF;
END $$;
SELECT 'CLINICAL CARE RELATIONSHIP READ RECONCILIATION VERIFY PASSED' AS result;
ROLLBACK;
