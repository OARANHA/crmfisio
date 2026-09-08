-- Disposable PostgreSQL 16 negative control.
-- Remove only the signed terminal-state guard from the effective trigger function
-- while preserving every other lifecycle validation. This must never run in
-- production; scripts/test-nexus-c03.sh is hard-gated to the disposable DB.

DO $outer$
DECLARE
  v_body text;
  v_without_guard text;
  v_guard text := E'  IF TG_OP = ''UPDATE'' AND OLD.signed_at IS NOT NULL THEN\n    RAISE EXCEPTION ''nexus_clinical_lifecycle_signed_immutable'';\n  END IF;\n\n';
BEGIN
  SELECT prosrc INTO v_body
  FROM pg_proc
  WHERE oid='public.validate_nexus_result_clinical_lifecycle()'::regprocedure;

  IF v_body IS NULL
     OR position('nexus_clinical_review_timestamp_invalid' IN v_body)=0
     OR position('nexus_clinical_sign_timestamp_invalid' IN v_body)=0
     OR position('nexus_clinical_lifecycle_signed_immutable' IN v_body)=0 THEN
    RAISE EXCEPTION 'C03 canonical lifecycle guard unavailable for negative control';
  END IF;

  v_without_guard := replace(v_body, v_guard, '');

  IF v_without_guard = v_body
     OR position('nexus_clinical_lifecycle_signed_immutable' IN v_without_guard)>0
     OR position('nexus_clinical_review_timestamp_invalid' IN v_without_guard)=0
     OR position('nexus_clinical_sign_timestamp_invalid' IN v_without_guard)=0
     OR position('NEW.updated_at := now()' IN v_without_guard)=0 THEN
    RAISE EXCEPTION 'C03 negative control did not isolate only the terminal guard';
  END IF;

  EXECUTE
    'CREATE OR REPLACE FUNCTION public.validate_nexus_result_clinical_lifecycle() '
    || 'RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER '
    || 'SET search_path = public, pg_temp AS '
    || quote_literal(v_without_guard);
END;
$outer$;

SELECT 'NEXUS_C03_TERMINAL_GUARD_REMOVED_FOR_NEGATIVE_CONTROL' AS result;
