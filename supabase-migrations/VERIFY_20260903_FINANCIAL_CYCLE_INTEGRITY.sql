SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='payments' AND column_name='appointment_id';

SELECT tgrelid::regclass AS table_name, tgname
FROM pg_trigger
WHERE NOT tgisinternal AND tgname IN (
  'trg_guard_payment_integrity', 'trg_audit_payment_status_change',
  'trg_create_finalized_appointment_receivable',
  'trg_guard_appointment_status_transition', 'trg_sync_appointment_package_usage'
)
ORDER BY 1,2;

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('payments','payment_status_history')
ORDER BY tablename, policyname;

SELECT
  has_function_privilege('anon','public.mark_overdue_payments()','EXECUTE') AS anon_overdue,
  has_function_privilege('authenticated','public.mark_overdue_payments()','EXECUTE') AS authenticated_overdue,
  has_function_privilege('service_role','public.mark_overdue_payments()','EXECUTE') AS service_overdue;

SELECT
  has_table_privilege('authenticated','public.payments','DELETE') AS authenticated_delete_payments,
  has_table_privilege('service_role','public.payment_status_history','UPDATE') AS service_update_history,
  has_table_privilege('service_role','public.payment_status_history','DELETE') AS service_delete_history;

SELECT
  count(*) FILTER (WHERE a.status='finalizado' AND a.pacote_id IS NULL AND a.valor>0) AS finalized_unpacked,
  count(*) FILTER (WHERE a.status='finalizado' AND a.pacote_id IS NULL AND a.valor>0 AND p.id IS NULL) AS historical_without_receivable
FROM public.appointments a
LEFT JOIN public.payments p ON p.clinic_id=a.clinic_id AND p.appointment_id=a.id AND p.tipo='receber';

SELECT count(*) AS pending_past_due
FROM public.payments
WHERE status='pendente' AND vencimento<current_date;
