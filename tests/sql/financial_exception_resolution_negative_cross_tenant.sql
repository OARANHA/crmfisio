DO $$
DECLARE v_def text; v_mutated text;
BEGIN
  v_def := pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure);
  v_mutated := replace(v_def, 'AND clinic_id = v_actor.clinic_id', 'AND true');
  IF v_mutated = v_def THEN RAISE EXCEPTION 'negative_cross_tenant_mutation_not_applied'; END IF;
  EXECUTE v_mutated;
END $$;
