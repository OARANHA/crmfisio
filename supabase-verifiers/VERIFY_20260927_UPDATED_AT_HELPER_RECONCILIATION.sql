\set ON_ERROR_STOP on
\pset pager off

-- Production-safe verifier: catalog reads only.
DO $verify$
DECLARE
  v_oid oid := to_regprocedure('public.update_updated_at_column()');
  v_language text;
  v_return_type regtype;
  v_security_definer boolean;
  v_source text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'updated_at_helper_missing';
  END IF;

  SELECT l.lanname, p.prorettype::regtype, p.prosecdef, p.prosrc
    INTO v_language, v_return_type, v_security_definer, v_source
  FROM pg_proc p
  JOIN pg_language l ON l.oid = p.prolang
  WHERE p.oid = v_oid;

  IF v_language IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'updated_at_helper_language_mismatch:%', v_language;
  END IF;

  IF v_return_type IS DISTINCT FROM 'trigger'::regtype THEN
    RAISE EXCEPTION 'updated_at_helper_return_type_mismatch:%', v_return_type;
  END IF;

  IF v_security_definer IS TRUE THEN
    RAISE EXCEPTION 'updated_at_helper_security_definer_forbidden';
  END IF;

  IF position('new.updated_at' in lower(v_source)) = 0
     OR position('return new' in lower(v_source)) = 0 THEN
    RAISE EXCEPTION 'updated_at_helper_body_mismatch';
  END IF;
END
$verify$;

SELECT 'VERIFY UPDATED_AT HELPER RECONCILIATION OK' AS result;
