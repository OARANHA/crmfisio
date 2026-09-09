DO $$
DECLARE v_def text; v_mutated text;
BEGIN
  v_def := pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure);
  v_mutated := replace(
    v_def,
    'v_actor.role::text NOT IN (''owner'', ''admin'')',
    'v_actor.role::text NOT IN (''owner'', ''admin'', ''financeiro'')'
  );
  IF v_mutated = v_def THEN RAISE EXCEPTION 'negative_financeiro_waive_mutation_not_applied'; END IF;
  EXECUTE v_mutated;
END $$;
