-- MedicsPro — auditoria somente leitura para prontidão de piloto
-- NÃO altera dados. Execute após aplicar as migrations financeiras previstas para o piloto.
-- Resultado esperado: todas as consultas de anomalia retornam zero linhas.

-- 1) Atendimento avulso finalizado sem recebível correspondente.
SELECT
  a.id AS appointment_id,
  a.clinic_id,
  a.paciente_id,
  a.data,
  a.valor,
  a.status
FROM public.appointments a
LEFT JOIN public.payments p
  ON p.clinic_id = a.clinic_id
 AND p.appointment_id = a.id
 AND p.tipo = 'receber'
WHERE a.status = 'finalizado'
  AND a.pacote_id IS NULL
  AND a.valor > 0
  AND p.id IS NULL
ORDER BY a.data DESC;

-- 2) Atendimento finalizado com pacote E recebível de atendimento: risco de dupla cobrança.
SELECT
  a.id AS appointment_id,
  a.clinic_id,
  a.paciente_id,
  a.pacote_id,
  p.id AS payment_id,
  p.valor AS payment_value,
  p.status AS payment_status
FROM public.appointments a
JOIN public.payments p
  ON p.clinic_id = a.clinic_id
 AND p.appointment_id = a.id
 AND p.tipo = 'receber'
WHERE a.status = 'finalizado'
  AND a.pacote_id IS NOT NULL
ORDER BY a.data DESC;

-- 3) Atendimento finalizado com pacote sem consumo registrado.
SELECT
  a.id AS appointment_id,
  a.clinic_id,
  a.paciente_id,
  a.pacote_id
FROM public.appointments a
LEFT JOIN public.package_session_usage u
  ON u.appointment_id = a.id
 AND u.patient_package_id = a.pacote_id
WHERE a.status = 'finalizado'
  AND a.pacote_id IS NOT NULL
  AND u.id IS NULL
ORDER BY a.data DESC;

-- 4) Consumo de pacote apontando para atendimento que não está finalizado ou pacote divergente.
SELECT
  u.id AS usage_id,
  u.appointment_id,
  u.patient_package_id,
  a.status AS appointment_status,
  a.pacote_id AS appointment_package_id
FROM public.package_session_usage u
LEFT JOIN public.appointments a ON a.id = u.appointment_id
WHERE a.id IS NULL
   OR a.status <> 'finalizado'
   OR a.pacote_id IS DISTINCT FROM u.patient_package_id;

-- 5) Saldo materializado do pacote divergente do consumo efetivo.
SELECT
  pp.id AS patient_package_id,
  pp.clinic_id,
  pp.patient_id,
  pp.sessoes_usadas AS stored_used,
  count(u.id)::integer AS actual_used,
  pp.sessoes_totais
FROM public.patient_packages pp
LEFT JOIN public.package_session_usage u
  ON u.patient_package_id = pp.id
GROUP BY pp.id, pp.clinic_id, pp.patient_id, pp.sessoes_usadas, pp.sessoes_totais
HAVING pp.sessoes_usadas IS DISTINCT FROM count(u.id)::integer
    OR pp.sessoes_usadas < 0
    OR pp.sessoes_usadas > pp.sessoes_totais;

-- 6) Recebível duplicado por atendimento (índice único deve impedir novos casos).
SELECT
  clinic_id,
  appointment_id,
  count(*) AS duplicate_count,
  array_agg(id ORDER BY created_at) AS payment_ids
FROM public.payments
WHERE tipo = 'receber'
  AND appointment_id IS NOT NULL
GROUP BY clinic_id, appointment_id
HAVING count(*) > 1;

-- 7) Pagamento liquidado sem método.
SELECT id, clinic_id, patient_id, appointment_id, valor, status, metodo
FROM public.payments
WHERE status = 'pago'
  AND metodo IS NULL;

-- 8) Valores financeiros inválidos.
SELECT id, clinic_id, patient_id, appointment_id, tipo, valor, status
FROM public.payments
WHERE valor <= 0;

-- 9) Recebível vinculado a atendimento/paciente/clínica incompatível.
SELECT
  p.id AS payment_id,
  p.clinic_id AS payment_clinic_id,
  p.patient_id AS payment_patient_id,
  p.appointment_id,
  a.clinic_id AS appointment_clinic_id,
  a.paciente_id AS appointment_patient_id
FROM public.payments p
JOIN public.appointments a ON a.id = p.appointment_id
WHERE p.appointment_id IS NOT NULL
  AND (
    p.tipo <> 'receber'
    OR p.clinic_id IS DISTINCT FROM a.clinic_id
    OR p.patient_id IS DISTINCT FROM a.paciente_id
  );

-- 10) Histórico de status ausente para lançamentos que deveriam estar auditados.
-- Use esta consulta como sinal operacional; registros muito antigos podem anteceder a migration de auditoria.
SELECT
  p.id AS payment_id,
  p.clinic_id,
  p.status,
  p.created_at
FROM public.payments p
LEFT JOIN public.payment_status_history h ON h.payment_id = p.id
WHERE h.id IS NULL
ORDER BY p.created_at DESC;

-- 11) Sumário de saúde para decisão rápida de piloto.
SELECT
  (SELECT count(*) FROM public.appointments WHERE status = 'finalizado') AS finalized_appointments,
  (SELECT count(*) FROM public.payments WHERE tipo = 'receber' AND status IN ('pendente','atrasado')) AS open_receivables,
  (SELECT count(*) FROM public.payments WHERE status = 'pago') AS settled_payments,
  (SELECT count(*) FROM public.patient_packages WHERE status = 'ativo') AS active_patient_packages,
  (SELECT count(*) FROM public.package_session_usage) AS package_usages,
  (SELECT count(*) FROM public.payment_status_history) AS payment_audit_events;
