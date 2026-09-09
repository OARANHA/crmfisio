-- MEDICSPRO — production-safe verifier: Financial Exception Resolution
BEGIN;
SET TRANSACTION READ ONLY;

\echo '1) append-only disposition ledger has one immutable decision per exception/appointment'
DO $$
DECLARE v_shape text;
BEGIN
  IF to_regclass('public.appointment_financial_exception_dispositions') IS NULL THEN
    RAISE EXCEPTION 'financial_exception_disposition_table_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.appointment_financial_exception_dispositions'::regclass
      AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ILIKE '%exception_id%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.appointment_financial_exception_dispositions'::regclass
      AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ILIKE '%appointment_id%'
  ) THEN
    RAISE EXCEPTION 'financial_exception_disposition_uniqueness_missing';
  END IF;

  SELECT string_agg(pg_get_constraintdef(c.oid),' ') INTO v_shape
  FROM pg_constraint c
  WHERE c.conrelid='public.appointment_financial_exception_dispositions'::regclass
    AND c.contype='c';

  IF v_shape NOT ILIKE '%charge%payment_id%'
     OR v_shape NOT ILIKE '%waived%payment_id%reason%'
     OR v_shape NOT ILIKE '%amount > 0%' THEN
    RAISE EXCEPTION 'financial_exception_disposition_shape_incomplete';
  END IF;
END $$;

\echo '2) disposition is browser/service read-only and protected by an immutable trigger'
DO $$
DECLARE v_guard text;
BEGIN
  IF has_table_privilege('authenticated','public.appointment_financial_exception_dispositions','INSERT')
     OR has_table_privilege('authenticated','public.appointment_financial_exception_dispositions','UPDATE')
     OR has_table_privilege('authenticated','public.appointment_financial_exception_dispositions','DELETE')
     OR has_table_privilege('service_role','public.appointment_financial_exception_dispositions','INSERT')
     OR has_table_privilege('service_role','public.appointment_financial_exception_dispositions','UPDATE')
     OR has_table_privilege('service_role','public.appointment_financial_exception_dispositions','DELETE') THEN
    RAISE EXCEPTION 'financial_exception_disposition_mutation_grant_exposed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.appointment_financial_exception_dispositions'::regclass
      AND tgname='trg_guard_financial_exception_disposition_immutability'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'financial_exception_disposition_immutability_trigger_missing';
  END IF;

  v_guard := pg_get_functiondef('public.guard_financial_exception_disposition_immutability()'::regprocedure);
  IF v_guard NOT ILIKE '%RAISE EXCEPTION%imutável%' THEN
    RAISE EXCEPTION 'financial_exception_disposition_immutability_guard_weakened';
  END IF;
END $$;

\echo '3) #388 exception queue remains read-only for browser while service_role keeps append-only detection'
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.appointment_financial_exceptions','UPDATE')
     OR has_table_privilege('authenticated','public.appointment_financial_exceptions','INSERT')
     OR has_table_privilege('authenticated','public.appointment_financial_exceptions','DELETE')
     OR NOT has_table_privilege('service_role','public.appointment_financial_exceptions','INSERT')
     OR has_table_privilege('service_role','public.appointment_financial_exceptions','UPDATE')
     OR has_table_privilege('service_role','public.appointment_financial_exceptions','DELETE') THEN
    RAISE EXCEPTION 'financial_exception_queue_detection_or_mutation_contract_regressed';
  END IF;
END $$;

\echo '4) canonical resolution RPC is SECURITY DEFINER and browser-callable only as authenticated'
DO $$
DECLARE v_proc regprocedure := to_regprocedure('public.resolve_appointment_financial_exception(uuid,text,text)');
BEGIN
  IF v_proc IS NULL THEN RAISE EXCEPTION 'financial_exception_resolution_rpc_missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=v_proc AND prosecdef) THEN
    RAISE EXCEPTION 'financial_exception_resolution_rpc_not_security_definer';
  END IF;
  IF NOT has_function_privilege('authenticated',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('service_role',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'financial_exception_resolution_execute_boundary_invalid';
  END IF;
END $$;

\echo '5) server authorization is active-profile + finance.access + exact role matrix'
DO $$
DECLARE v_def text := lower(pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure));
BEGIN
  IF v_def NOT LIKE '%where id = auth.uid()%and ativo = true%'
     OR v_def NOT LIKE '%current_clinic_entitlement_allowed(''finance.access'') is not true%'
     OR v_def NOT LIKE '%v_actor.role::text not in (''owner'', ''admin'', ''financeiro'')%'
     OR v_def NOT LIKE '%v_actor.role::text not in (''owner'', ''admin'')%'
     OR v_def LIKE '%recep%'
     OR v_def LIKE '%professional%permission%'
     OR v_def LIKE '%fisio%' THEN
    RAISE EXCEPTION 'financial_exception_resolution_authorization_matrix_regressed';
  END IF;
END $$;

\echo '6) foreign and missing exception IDs share a tenant-scoped lookup before row materialization'
DO $$
DECLARE v_def text := lower(pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure));
BEGIN
  IF v_def NOT LIKE '%from public.appointment_financial_exceptions%where id = p_exception_id%and clinic_id = v_actor.clinic_id%for update%'
     OR v_def NOT LIKE '%pendência financeira não encontrada%' THEN
    RAISE EXCEPTION 'financial_exception_cross_tenant_lookup_boundary_missing';
  END IF;
END $$;

\echo '7) resolution locks exception then appointment and validates uncovered finalized source coherence'
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure));
  v_exception_lock integer;
  v_appointment_lock integer;
BEGIN
  v_exception_lock := strpos(v_def,'from public.appointment_financial_exceptions');
  v_appointment_lock := strpos(v_def,'from public.appointments a');
  IF v_exception_lock=0 OR v_appointment_lock=0 OR v_exception_lock >= v_appointment_lock
     OR v_def NOT LIKE '%v_appointment.status <> ''finalizado''%'
     OR v_def NOT LIKE '%v_appointment.pacote_id is distinct from v_exception.source_package_id%'
     OR v_def NOT LIKE '%from public.package_session_usage%where u.appointment_id = v_appointment.id%'
     OR v_def NOT LIKE '%for update%' THEN
    RAISE EXCEPTION 'financial_exception_resolution_source_validation_incomplete';
  END IF;
END $$;

\echo '8) CHARGE reuses the canonical positive-value receivable domain and existing appointment uniqueness'
DO $$
DECLARE v_def text := lower(pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure));
BEGIN
  IF v_def NOT LIKE '%insert into public.payments%'
     OR v_def NOT LIKE '%''receber''%'
     OR v_def NOT LIKE '%''atendimento sem cobertura''%'
     OR v_def NOT LIKE '%v_appointment.valor%'
     OR v_def NOT LIKE '%v_appointment.data%'
     OR v_def NOT LIKE '%''pendente''%'
     OR v_def NOT LIKE '%v_appointment.valor <= 0%'
     OR v_def NOT LIKE '%atendimento já possui recebível; reconciliação financeira explícita necessária%' THEN
    RAISE EXCEPTION 'financial_exception_charge_materialization_incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='payments'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND indexdef ILIKE '%clinic_id%appointment_id%'
      AND indexdef ILIKE '%tipo%receber%'
  ) THEN
    RAISE EXCEPTION 'appointment_receivable_uniqueness_missing';
  END IF;
END $$;

\echo '9) payment, disposition and resolved transition occur in transactional order'
DO $$
DECLARE
  v_def text := lower(pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure));
  v_payment_pos integer;
  v_disposition_pos integer;
  v_resolution_pos integer;
BEGIN
  v_payment_pos := strpos(v_def,'insert into public.payments');
  v_disposition_pos := strpos(v_def,'insert into public.appointment_financial_exception_dispositions');
  v_resolution_pos := strpos(v_def,'update public.appointment_financial_exceptions');
  IF v_payment_pos=0 OR v_disposition_pos=0 OR v_resolution_pos=0
     OR v_payment_pos >= v_disposition_pos OR v_disposition_pos >= v_resolution_pos THEN
    RAISE EXCEPTION 'financial_exception_resolution_materialization_order_invalid';
  END IF;
  IF v_def NOT LIKE '%where id = v_exception.id%and status = ''pending''%' THEN
    RAISE EXCEPTION 'financial_exception_resolution_pending_compare_and_set_missing';
  END IF;
END $$;

\echo '10) idempotency returns persisted same decision and forbids decision switching'
DO $$
DECLARE v_def text := lower(pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure));
BEGIN
  IF v_def NOT LIKE '%v_exception.status = ''resolved''%'
     OR v_def NOT LIKE '%v_existing_disposition.disposition is distinct from v_disposition%'
     OR v_def NOT LIKE '%pendência financeira já possui disposição imutável%'
     OR v_def NOT LIKE '%return query%v_existing_disposition.exception_id%' THEN
    RAISE EXCEPTION 'financial_exception_resolution_idempotency_incomplete';
  END IF;
END $$;

\echo '11) WAIVE is full-value, reasoned and never reuses cancellation resolution'
DO $$
DECLARE v_def text := lower(pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure));
BEGIN
  IF v_def NOT LIKE '%v_disposition = ''waived'' and v_reason is null%'
     OR v_def NOT LIKE '%informe o motivo da cortesia%'
     OR v_def NOT LIKE '%v_appointment.valor%'
     OR v_def NOT LIKE '%case when v_disposition = ''waived'' then v_reason else null end%'
     OR v_def LIKE '%appointment_payment_resolutions%' THEN
    RAISE EXCEPTION 'financial_exception_waive_contract_incomplete';
  END IF;
END $$;

\echo '12) resolution function never mutates appointment source, package counters or package usage'
DO $$
DECLARE v_def text := upper(pg_get_functiondef('public.resolve_appointment_financial_exception(uuid,text,text)'::regprocedure));
BEGIN
  IF v_def LIKE '%UPDATE PUBLIC.APPOINTMENTS%'
     OR v_def LIKE '%UPDATE PUBLIC.PATIENT_PACKAGES%'
     OR v_def LIKE '%INSERT INTO PUBLIC.PACKAGE_SESSION_USAGE%'
     OR v_def LIKE '%DELETE FROM PUBLIC.PACKAGE_SESSION_USAGE%'
     OR v_def LIKE '%APPOINTMENT_PAYMENT_RESOLUTIONS%' THEN
    RAISE EXCEPTION 'financial_exception_resolution_weakened_existing_financial_source_contract';
  END IF;
END $$;

\echo '13) pending queue projection is tenant-safe and finance-scoped'
DO $$
DECLARE
  v_proc regprocedure := to_regprocedure('public.list_pending_appointment_financial_exceptions()');
  v_def text;
BEGIN
  IF v_proc IS NULL OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=v_proc AND prosecdef) THEN
    RAISE EXCEPTION 'financial_exception_pending_list_rpc_missing';
  END IF;
  v_def := lower(pg_get_functiondef(v_proc));
  IF v_def NOT LIKE '%where id = auth.uid()%and ativo = true%'
     OR v_def NOT LIKE '%role::text not in (''owner'', ''admin'', ''financeiro'')%'
     OR v_def NOT LIKE '%current_clinic_entitlement_allowed(''finance.access'')%'
     OR v_def NOT LIKE '%where e.clinic_id = v_actor.clinic_id%and e.status = ''pending''%'
     OR v_def NOT LIKE '%pp.clinic_id = e.clinic_id%and pp.patient_id = e.patient_id%'
     OR v_def LIKE '%recep%'
     OR v_def LIKE '%professional%' THEN
    RAISE EXCEPTION 'financial_exception_pending_list_boundary_incomplete';
  END IF;
END $$;

\echo '14) persisted state has exactly one coherent disposition for each resolved exception'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.appointment_financial_exceptions e
    WHERE e.status='resolved'
      AND (SELECT count(*) FROM public.appointment_financial_exception_dispositions d WHERE d.exception_id=e.id) <> 1
  ) THEN RAISE EXCEPTION 'resolved_exception_without_exactly_one_disposition'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointment_financial_exceptions e
    JOIN public.appointment_financial_exception_dispositions d ON d.exception_id=e.id
    WHERE e.status='pending'
  ) THEN RAISE EXCEPTION 'pending_exception_has_materialized_disposition'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointment_financial_exception_dispositions d
    JOIN public.appointment_financial_exceptions e ON e.id=d.exception_id
    JOIN public.appointments a ON a.id=d.appointment_id
    WHERE d.clinic_id IS DISTINCT FROM e.clinic_id
       OR d.appointment_id IS DISTINCT FROM e.appointment_id
       OR a.clinic_id IS DISTINCT FROM d.clinic_id
       OR a.valor IS DISTINCT FROM d.amount
       OR e.patient_id IS DISTINCT FROM a.paciente_id
  ) THEN RAISE EXCEPTION 'financial_exception_disposition_cross_tenant_or_amount_drift'; END IF;
END $$;

\echo '15) persisted CHARGE and WAIVE rows obey role/payment semantics'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.appointment_financial_exception_dispositions d
    LEFT JOIN public.payments p ON p.id=d.payment_id
    WHERE d.disposition='charge'
      AND (
        d.actor_role NOT IN ('owner','admin','financeiro')
        OR p.id IS NULL
        OR p.clinic_id IS DISTINCT FROM d.clinic_id
        OR p.appointment_id IS DISTINCT FROM d.appointment_id
        OR p.tipo IS DISTINCT FROM 'receber'
        OR p.valor IS DISTINCT FROM d.amount
      )
  ) THEN RAISE EXCEPTION 'charge_disposition_payment_or_role_incoherent'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointment_financial_exception_dispositions d
    WHERE d.disposition='waived'
      AND (d.actor_role NOT IN ('owner','admin') OR d.payment_id IS NOT NULL OR nullif(trim(d.reason),'') IS NULL)
  ) THEN RAISE EXCEPTION 'waived_disposition_role_or_reason_incoherent'; END IF;
END $$;

\echo '16) no resolved uncovered appointment has package usage'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.appointment_financial_exception_dispositions d
    JOIN public.package_session_usage u ON u.appointment_id=d.appointment_id
  ) THEN RAISE EXCEPTION 'resolved_uncovered_appointment_has_package_usage'; END IF;
END $$;

\echo '17) paid-payment immutability from the prior financial cycle remains intact'
DO $$
DECLARE v_guard text := pg_get_functiondef('public.guard_payment_integrity()'::regprocedure);
BEGIN
  IF v_guard NOT ILIKE '%OLD.status = ''pago''%'
     OR v_guard NOT ILIKE '%Lançamento liquidado é imutável%' THEN
    RAISE EXCEPTION 'paid_payment_immutability_regressed';
  END IF;
END $$;

ROLLBACK;
