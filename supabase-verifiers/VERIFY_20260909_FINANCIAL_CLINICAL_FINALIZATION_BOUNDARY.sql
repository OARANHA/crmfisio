-- MEDICSPRO — production-safe verifier: Financial/Clinical Finalization Boundary
BEGIN;
SET TRANSACTION READ ONLY;

\echo '1) explicit financial exception queue exists and is one-per-appointment'
DO $$
BEGIN
  IF to_regclass('public.appointment_financial_exceptions') IS NULL THEN
    RAISE EXCEPTION 'financial_exception_queue_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'appointment_financial_exceptions'
      AND c.conname = 'appointment_financial_exceptions_one_per_appointment'
      AND c.contype = 'u'
  ) THEN
    RAISE EXCEPTION 'financial_exception_idempotency_missing';
  END IF;
END $$;

\echo '2) financial exception browser access is read-only and finance-scoped'
DO $$
DECLARE v_qual text;
BEGIN
  IF has_table_privilege('authenticated', 'public.appointment_financial_exceptions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.appointment_financial_exceptions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.appointment_financial_exceptions', 'DELETE') THEN
    RAISE EXCEPTION 'financial_exception_browser_write_exposed';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.appointment_financial_exceptions', 'SELECT') THEN
    RAISE EXCEPTION 'financial_exception_browser_read_missing';
  END IF;

  SELECT coalesce(qual, '') INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'appointment_financial_exceptions'
    AND policyname = 'appointment_financial_exceptions_read_financial'
    AND cmd = 'SELECT';

  IF v_qual IS NULL
     OR v_qual NOT ILIKE '%current_clinic_id%'
     OR v_qual NOT ILIKE '%current_app_role%'
     OR v_qual NOT ILIKE '%finance.access%'
     OR v_qual NOT ILIKE '%financeiro%' THEN
    RAISE EXCEPTION 'financial_exception_read_boundary_incomplete';
  END IF;
END $$;

\echo '3) service role can append detections but cannot generically resolve or delete them'
DO $$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.appointment_financial_exceptions', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.appointment_financial_exceptions', 'INSERT')
     OR has_table_privilege('service_role', 'public.appointment_financial_exceptions', 'UPDATE')
     OR has_table_privilege('service_role', 'public.appointment_financial_exceptions', 'DELETE') THEN
    RAISE EXCEPTION 'financial_exception_service_contract_invalid';
  END IF;
END $$;

\echo '4) package usage remains an idempotent one-row-per-appointment ledger'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'package_session_usage'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%appointment_id%'
  ) THEN
    RAISE EXCEPTION 'package_usage_appointment_uniqueness_missing';
  END IF;
END $$;

\echo '5) sync distinguishes coverage failure from integrity failure'
DO $$
DECLARE v_def text := pg_get_functiondef('public.sync_appointment_package_usage()'::regprocedure);
BEGIN
  IF v_def ILIKE '%RAISE EXCEPTION ''Pacote sem saldo ou fora da validade''%' THEN
    RAISE EXCEPTION 'package_business_failure_blocks_clinical_finalization';
  END IF;
  IF v_def NOT ILIKE '%record_appointment_financial_exception%'
     OR v_def NOT ILIKE '%package_exhausted%'
     OR v_def NOT ILIKE '%package_expired%'
     OR v_def NOT ILIKE '%package_not_eligible%'
     OR v_def NOT ILIKE '%Integridade financeira inválida%'
     OR v_def NOT ILIKE '%sessoes_usadas < sessoes_totais%' THEN
    RAISE EXCEPTION 'package_finalization_boundary_incomplete';
  END IF;
  IF v_def ILIKE '%appointment_payment_resolutions%' THEN
    RAISE EXCEPTION 'prepaid_cancellation_resolution_domain_reused';
  END IF;
END $$;

\echo '6) package reservation is enforced server-side and serialized without reschedule bypass'
DO $$
DECLARE v_def text := pg_get_functiondef('public.guard_appointment_package_reservation_capacity()'::regprocedure);
BEGIN
  IF v_def NOT ILIKE '%FOR UPDATE%'
     OR v_def NOT ILIKE '%sessoes_usadas + v_reserved >= v_package.sessoes_totais%'
     OR v_def NOT ILIKE '%agendado%confirmado%em_atendimento%' THEN
    RAISE EXCEPTION 'package_reservation_capacity_not_serialized';
  END IF;
  IF v_def ILIKE '%rescheduled_from_id%' THEN
    RAISE EXCEPTION 'arbitrary_rescheduled_from_bypass_present';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.appointments'::regclass
      AND tgname = 'trg_guard_appointment_package_reservation_capacity'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'package_reservation_trigger_missing';
  END IF;
END $$;

\echo '7) package balances are not overconsumed'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.patient_packages
    WHERE sessoes_usadas < 0 OR sessoes_usadas > sessoes_totais
  ) THEN
    RAISE EXCEPTION 'package_overconsumption_detected';
  END IF;
END $$;

\echo '8) an appointment cannot be both a coverage exception and consumed'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.appointment_financial_exceptions e
    JOIN public.package_session_usage u ON u.appointment_id = e.appointment_id
  ) THEN
    RAISE EXCEPTION 'appointment_has_usage_and_financial_exception';
  END IF;
END $$;

\echo '9) finalized appointment financial source lock remains intact'
DO $$
DECLARE v_def text := pg_get_functiondef('public.guard_finalized_appointment_financial_source()'::regprocedure);
BEGIN
  IF v_def NOT ILIKE '%OLD.status = ''finalizado''%'
     OR v_def NOT ILIKE '%NEW.pacote_id IS DISTINCT FROM OLD.pacote_id%'
     OR v_def NOT ILIKE '%NEW.valor IS DISTINCT FROM OLD.valor%'
     OR v_def NOT ILIKE '%service_role%' THEN
    RAISE EXCEPTION 'finalized_financial_source_lock_regressed';
  END IF;
END $$;

\echo '10) paid payment immutability and standalone receivable contracts remain intact'
DO $$
DECLARE
  v_payment_guard text := pg_get_functiondef('public.guard_payment_integrity()'::regprocedure);
  v_receivable text := pg_get_functiondef('public.create_finalized_appointment_receivable()'::regprocedure);
BEGIN
  IF v_payment_guard NOT ILIKE '%OLD.status = ''pago''%'
     OR v_payment_guard NOT ILIKE '%Lançamento liquidado é imutável%' THEN
    RAISE EXCEPTION 'paid_payment_immutability_regressed';
  END IF;
  IF v_receivable NOT ILIKE '%NEW.pacote_id IS NULL%'
     OR v_receivable NOT ILIKE '%ON CONFLICT%appointment_id%DO NOTHING%' THEN
    RAISE EXCEPTION 'standalone_receivable_idempotency_regressed';
  END IF;
END $$;

\echo '11) trigger functions are not browser-callable'
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.sync_appointment_package_usage()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.guard_appointment_package_reservation_capacity()', 'EXECUTE')
     OR has_function_privilege(
       'authenticated',
       'public.record_appointment_financial_exception(uuid,uuid,uuid,uuid,text,text,integer,integer,date)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'financial_internal_function_browser_execute_exposed';
  END IF;
END $$;

\echo '12) canonical reschedule releases the locked source before inserting replacement'
DO $$
DECLARE
  v_proc regprocedure := to_regprocedure(
    'public.reschedule_appointment(uuid,date,time without time zone,time without time zone,uuid,uuid,text,boolean)'
  );
  v_def text;
  v_upper text;
  v_update_pos integer;
  v_insert_pos integer;
BEGIN
  IF v_proc IS NULL THEN
    RAISE EXCEPTION 'canonical_reschedule_missing';
  END IF;

  v_def := pg_get_functiondef(v_proc);
  v_upper := upper(v_def);
  v_update_pos := strpos(v_upper, 'UPDATE PUBLIC.APPOINTMENTS');
  v_insert_pos := strpos(v_upper, 'INSERT INTO PUBLIC.APPOINTMENTS');

  IF v_update_pos = 0 OR v_insert_pos = 0 OR v_update_pos >= v_insert_pos THEN
    RAISE EXCEPTION 'reschedule_insert_precedes_source_release';
  END IF;
  IF v_def NOT ILIKE '%cancellation_reason%'
     OR v_def NOT ILIKE '%old_app.pacote_id%'
     OR v_def NOT ILIKE '%rescheduled_from_id%old_app.id%' THEN
    RAISE EXCEPTION 'reschedule_transfer_contract_incomplete';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = v_proc AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'reschedule_not_security_definer';
  END IF;
  IF NOT has_function_privilege('authenticated', v_proc, 'EXECUTE')
     OR has_function_privilege('anon', v_proc, 'EXECUTE') THEN
    RAISE EXCEPTION 'reschedule_execute_boundary_invalid';
  END IF;
END $$;

\echo '13) financial exception queue has no canonical generic resolve RPC in this slice'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'resolve_appointment_financial_exception',
        'resolve_appointment_financial_exception_with_note'
      )
  ) THEN
    RAISE EXCEPTION 'unmaterialized_financial_exception_resolution_exposed';
  END IF;
END $$;

ROLLBACK;
