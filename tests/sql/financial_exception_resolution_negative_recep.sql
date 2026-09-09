DO $$
DECLARE v_def text; v_mutated text;
BEGIN
  v_def := pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure);
  v_mutated := replace(
    v_def,
    'v_actor.role::text NOT IN (''owner'', ''admin'', ''financeiro'')',
    'v_actor.role::text NOT IN (''owner'', ''admin'', ''financeiro'', ''recep'')'
  );
  IF v_mutated = v_def THEN RAISE EXCEPTION 'negative_recep_mutation_not_applied'; END IF;
  EXECUTE v_mutated;
END $$;
