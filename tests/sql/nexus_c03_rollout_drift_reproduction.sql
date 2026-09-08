-- Disposable PostgreSQL 16 probe: prove the historical C-03 migration leaves the
-- exact function shape that the posterior verifier rejects. This runs before the
-- additive rollout correction and never targets production.

DO $$
DECLARE
  v_body text;
  v_terminal_pos integer;
  v_review_pos integer;
  v_sign_pos integer;
BEGIN
  SELECT prosrc INTO v_body
  FROM pg_proc
  WHERE oid='public.validate_nexus_result_clinical_lifecycle()'::regprocedure;

  IF v_body IS NULL THEN
    RAISE EXCEPTION 'C03 historical lifecycle guard function missing';
  END IF;

  v_terminal_pos := position(
    'IF TG_OP = ''UPDATE'' AND OLD.signed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN'
    IN v_body
  );
  v_review_pos := position(
    'IF NEW.reviewed_at IS NOT NULL AND NEW.reviewed_at < NEW.processed_at THEN'
    IN v_body
  );
  v_sign_pos := position(
    'IF NEW.signed_at IS NOT NULL AND NEW.signed_at < NEW.reviewed_at THEN'
    IN v_body
  );

  IF v_terminal_pos=0
     OR v_review_pos=0
     OR v_sign_pos=0
     OR v_terminal_pos < v_review_pos
     OR v_terminal_pos < v_sign_pos THEN
    RAISE EXCEPTION 'C03 historical rollout drift was not reproduced';
  END IF;
END;
$$;

SELECT 'NEXUS_C03_HISTORICAL_GUARD_DRIFT_REPRODUCED' AS result;
