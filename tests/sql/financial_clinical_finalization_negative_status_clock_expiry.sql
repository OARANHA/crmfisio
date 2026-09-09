-- Negative control: reintroduce a current-status shortcut into historical package
-- eligibility. The production-safe verifier must reject this definition.
DO $outer$
DECLARE
  v_def text := pg_get_functiondef(
    'public.sync_appointment_package_usage()'::regprocedure
  );
BEGIN
  IF strpos(v_def, 'IF v_package.validade_ate IS NOT NULL') = 0 THEN
    RAISE EXCEPTION 'status_clock_negative_control_anchor_missing';
  END IF;

  v_def := replace(
    v_def,
    'IF v_package.validade_ate IS NOT NULL',
    'IF v_package.status = ''vencido'' OR v_package.validade_ate IS NOT NULL'
  );

  EXECUTE v_def;
END
$outer$;
