\echo '1) owner CHARGE materializes exactly one receivable + disposition and resolves exception'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
SELECT * FROM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000001','CHARGE',NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.role','',false);
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
DECLARE v_payment public.payments%ROWTYPE; v_disp public.appointment_financial_exception_dispositions%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE appointment_id='49000000-0000-0000-0000-000000000001' AND tipo='receber';
  SELECT * INTO v_disp FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000001';
  IF v_payment.id IS NULL OR v_payment.patient_id <> '31000000-0000-0000-0000-000000000001'
     OR v_payment.valor <> 10100 OR v_payment.status <> 'pendente'
     OR v_payment.categoria <> 'Atendimento sem cobertura'
     OR v_disp.id IS NULL OR v_disp.disposition <> 'charge' OR v_disp.amount <> 10100
     OR v_disp.payment_id IS DISTINCT FROM v_payment.id OR v_disp.actor_role <> 'owner'
     OR (SELECT status FROM public.appointment_financial_exceptions WHERE id='88000000-0000-0000-0000-000000000001') <> 'resolved'
     OR (SELECT count(*) FROM public.package_session_usage WHERE appointment_id='49000000-0000-0000-0000-000000000001') <> 0 THEN
    RAISE EXCEPTION 'owner_charge_contract_failed';
  END IF;
END $$;

\echo '2) admin CHARGE is authorized'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000002',false);
SELECT * FROM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000002','charge',NULL);
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.payments WHERE appointment_id='49000000-0000-0000-0000-000000000002' AND tipo='receber') <> 1
     OR (SELECT actor_role FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000002') <> 'admin' THEN
    RAISE EXCEPTION 'admin_charge_contract_failed'; END IF;
END $$;

\echo '3) financeiro CHARGE is authorized'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000003',false);
SELECT * FROM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000003','charge',NULL);
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.payments WHERE appointment_id='49000000-0000-0000-0000-000000000003' AND tipo='receber') <> 1
     OR (SELECT actor_role FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000003') <> 'financeiro' THEN
    RAISE EXCEPTION 'financeiro_charge_contract_failed'; END IF;
END $$;

\echo '4) recep CHARGE is denied even though reception may create generic receivables'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000004',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000004','charge',NULL); RAISE EXCEPTION 'recep_charge_was_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);

\echo '5) professional CHARGE is denied'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000005',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000005','charge',NULL); RAISE EXCEPTION 'professional_charge_was_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);

\echo '6) owner and admin WAIVE require auditable reason and create no payment'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
SELECT * FROM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000006','waived','Cortesia aprovada pelo owner');
RESET ROLE; SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000002',false); SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT * FROM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000007','WAIVED','Cortesia aprovada pelo admin');
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.payments WHERE appointment_id IN ('49000000-0000-0000-0000-000000000006','49000000-0000-0000-0000-000000000007'))
     OR (SELECT disposition FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000006') <> 'waived'
     OR (SELECT amount FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000006') <> 10600
     OR (SELECT reason FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000006') <> 'Cortesia aprovada pelo owner'
     OR (SELECT actor_role FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000007') <> 'admin' THEN
    RAISE EXCEPTION 'waive_contract_failed'; END IF;
END $$;

\echo '7) financeiro WAIVE is denied'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000003',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000008','waived','Financeiro não pode'); RAISE EXCEPTION 'financeiro_waive_was_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);

\echo '8) WAIVE without a non-empty reason is denied'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000009','waived','   '); RAISE EXCEPTION 'waive_without_reason_was_allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);

\echo '9-10) cross-tenant and nonexistent exception are denied with the same opaque response'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE foreign_state text; foreign_message text; missing_state text; missing_message text;
BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000016','charge',NULL); RAISE EXCEPTION 'cross_tenant_resolution_was_allowed';
  EXCEPTION WHEN no_data_found THEN GET STACKED DIAGNOSTICS foreign_state=RETURNED_SQLSTATE, foreign_message=MESSAGE_TEXT; END;
  BEGIN PERFORM public.resolve_appointment_financial_exception('ffffffff-ffff-ffff-ffff-ffffffffffff','charge',NULL); RAISE EXCEPTION 'missing_exception_was_allowed';
  EXCEPTION WHEN no_data_found THEN GET STACKED DIAGNOSTICS missing_state=RETURNED_SQLSTATE, missing_message=MESSAGE_TEXT; END;
  IF foreign_state IS DISTINCT FROM missing_state OR foreign_message IS DISTINCT FROM missing_message THEN RAISE EXCEPTION 'cross_tenant_exception_disclosed'; END IF;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);

\echo '11) resolved decision is immutable: CHARGE cannot become WAIVE'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000001','waived','Tentativa de troca'); RAISE EXCEPTION 'resolved_decision_was_changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);

\echo '12) non-finalized appointment cannot be resolved'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000010','charge',NULL); RAISE EXCEPTION 'non_finalized_resolution_was_allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);

\echo '13) appointment with package_session_usage cannot be treated as uncovered'
INSERT INTO public.package_session_usage(id,clinic_id,patient_package_id,appointment_id)
VALUES ('97000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002','49000000-0000-0000-0000-000000000011');
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000011','charge',NULL); RAISE EXCEPTION 'covered_appointment_was_resolved_as_uncovered';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
DELETE FROM public.package_session_usage WHERE id='97000000-0000-0000-0000-000000000011';

\echo '14) repeated CHARGE is idempotent and returns the persisted decision'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
SELECT * FROM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000001','charge',NULL);
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.payments WHERE appointment_id='49000000-0000-0000-0000-000000000001' AND tipo='receber') <> 1
     OR (SELECT count(*) FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'charge_idempotency_failed'; END IF;
END $$;

\echo '16) payment INSERT failure rolls the whole resolution back'
CREATE OR REPLACE FUNCTION public.test_fail_resolution_payment_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.appointment_id='49000000-0000-0000-0000-000000000013' THEN RAISE EXCEPTION 'forced_payment_failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_test_fail_resolution_payment_insert BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.test_fail_resolution_payment_insert();
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000013','charge',NULL); RAISE EXCEPTION 'forced_payment_failure_not_observed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forced_payment_failure' THEN RAISE; END IF; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
DROP TRIGGER trg_test_fail_resolution_payment_insert ON public.payments; DROP FUNCTION public.test_fail_resolution_payment_insert();
DO $$ BEGIN
  IF (SELECT status FROM public.appointment_financial_exceptions WHERE id='88000000-0000-0000-0000-000000000013') <> 'pending'
     OR EXISTS (SELECT 1 FROM public.payments WHERE appointment_id='49000000-0000-0000-0000-000000000013')
     OR EXISTS (SELECT 1 FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000013') THEN
    RAISE EXCEPTION 'payment_failure_did_not_rollback'; END IF;
END $$;

\echo '17) disposition INSERT failure also rolls back the newly inserted payment'
CREATE OR REPLACE FUNCTION public.test_fail_resolution_disposition_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.exception_id='88000000-0000-0000-0000-000000000014' THEN RAISE EXCEPTION 'forced_disposition_failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_test_fail_resolution_disposition_insert BEFORE INSERT ON public.appointment_financial_exception_dispositions FOR EACH ROW EXECUTE FUNCTION public.test_fail_resolution_disposition_insert();
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000014','charge',NULL); RAISE EXCEPTION 'forced_disposition_failure_not_observed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forced_disposition_failure' THEN RAISE; END IF; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
DROP TRIGGER trg_test_fail_resolution_disposition_insert ON public.appointment_financial_exception_dispositions; DROP FUNCTION public.test_fail_resolution_disposition_insert();
DO $$ BEGIN
  IF (SELECT status FROM public.appointment_financial_exceptions WHERE id='88000000-0000-0000-0000-000000000014') <> 'pending'
     OR EXISTS (SELECT 1 FROM public.payments WHERE appointment_id='49000000-0000-0000-0000-000000000014')
     OR EXISTS (SELECT 1 FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000014') THEN
    RAISE EXCEPTION 'disposition_failure_did_not_rollback_payment'; END IF;
END $$;

\echo '18) browser cannot INSERT/UPDATE/DELETE immutable dispositions'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN INSERT INTO public.appointment_financial_exception_dispositions(exception_id,clinic_id,appointment_id,disposition,amount,actor_id,actor_role,payment_id) VALUES ('88000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000012','charge',11200,auth.uid(),'owner','98000000-0000-0000-0000-000000000015'); RAISE EXCEPTION 'browser_disposition_insert_allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.appointment_financial_exception_dispositions SET reason='mutated' WHERE exception_id='88000000-0000-0000-0000-000000000001'; RAISE EXCEPTION 'browser_disposition_update_allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000001'; RAISE EXCEPTION 'browser_disposition_delete_allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);

\echo '19) browser cannot UPDATE #388 exception directly'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN UPDATE public.appointment_financial_exceptions SET status='resolved',resolved_at=now() WHERE id='88000000-0000-0000-0000-000000000012'; RAISE EXCEPTION 'browser_exception_update_allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);

\echo '20) prior paid-payment immutability remains intact'
SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN UPDATE public.payments SET valor=12001 WHERE id='98000000-0000-0000-0000-000000000020'; RAISE EXCEPTION 'paid_payment_mutation_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
DO $$ BEGIN IF (SELECT valor FROM public.payments WHERE id='98000000-0000-0000-0000-000000000020') <> 12000 THEN RAISE EXCEPTION 'paid_payment_changed'; END IF; END $$;

\echo '21) pre-existing appointment receivable is not silently adopted or bypassed'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000015','charge',NULL); RAISE EXCEPTION 'existing_receivable_was_silently_adopted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
DO $$ BEGIN
  IF (SELECT status FROM public.appointment_financial_exceptions WHERE id='88000000-0000-0000-0000-000000000015') <> 'pending'
     OR (SELECT count(*) FROM public.payments WHERE appointment_id='49000000-0000-0000-0000-000000000015') <> 1
     OR EXISTS (SELECT 1 FROM public.appointment_financial_exception_dispositions WHERE exception_id='88000000-0000-0000-0000-000000000015') THEN
    RAISE EXCEPTION 'existing_receivable_fail_closed_contract_failed'; END IF;
END $$;

\echo '22) inactive manager cannot resolve'
SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false); SELECT set_config('request.jwt.claim.sub','19000000-0000-0000-0000-000000000006',false);
DO $$ BEGIN
  BEGIN PERFORM public.resolve_appointment_financial_exception('88000000-0000-0000-0000-000000000004','charge',NULL); RAISE EXCEPTION 'inactive_actor_was_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.role','',false); SELECT set_config('request.jwt.claim.sub','',false);
