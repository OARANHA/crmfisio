-- Disposable PostgreSQL 16 post-correction shape probe.
-- The posterior production verifier remains authoritative; this probe gives the
-- harness a focused marker for the exact rollout correction.

DO $$
DECLARE
  v_body text;
  v_terminal_pos integer;
  v_review_pos integer;
  v_sign_pos integer;
  v_updated_pos integer;
BEGIN
  SELECT prosrc INTO v_body
  FROM pg_proc
  WHERE oid='public.validate_nexus_result_clinical_lifecycle()'::regprocedure;

  v_terminal_pos := position(
    'IF TG_OP = ''UPDATE'' AND OLD.signed_at IS NOT NULL THEN' IN v_body
  );
  v_review_pos := position(
    'IF NEW.reviewed_at IS NOT NULL AND NEW.reviewed_at < NEW.processed_at THEN'
    IN v_body
  );
  v_sign_pos := position(
    'IF NEW.signed_at IS NOT NULL AND NEW.signed_at < NEW.reviewed_at THEN'
    IN v_body
  );
  v_updated_pos := position('NEW.updated_at := now()' IN v_body);

  IF v_body IS NULL
     OR v_terminal_pos=0
     OR position('NEW IS DISTINCT FROM OLD' IN v_body)>0
     OR v_review_pos=0
     OR v_sign_pos=0
     OR v_updated_pos=0
     OR v_terminal_pos > v_review_pos
     OR v_terminal_pos > v_sign_pos
     OR v_terminal_pos > v_updated_pos THEN
    RAISE EXCEPTION 'C03 rollout correction did not install canonical terminal guard';
  END IF;
END;
$$;

SELECT 'NEXUS_C03_ROLLOUT_CORRECTION_SHAPE_OK' AS result;
