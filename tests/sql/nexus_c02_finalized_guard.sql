-- Reusable assertion: reaches the row despite RLS, and requires the EXACT
-- historical exception. An unrelated error or zero-row UPDATE is not success.
SET ROLE service_role;
DO $$ DECLARE v text; BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.nexus_clinical_results
    WHERE id='00000000-0000-0000-0000-000000000801'
      AND status='finalized' AND finalized_at IS NOT NULL) THEN
    RAISE EXCEPTION 'C02 guard probe requires an existing finalized result';
  END IF;
  v := public.test_c02_try_finalized_update(
    '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000801');
  IF v <> 'ERR:P0001:Resultado Nexus finalizado é imutável; registre novo resultado/adendo' THEN
    RAISE EXCEPTION 'finalized mutation escaped: %',v;
  END IF;
END $$;
RESET ROLE;
