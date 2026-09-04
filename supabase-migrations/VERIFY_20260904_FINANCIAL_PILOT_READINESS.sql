-- MEDICSPRO — verificação somente-leitura para prontidão financeira em piloto
-- Objetivo: encontrar violações dos invariantes já estabelecidos pelo ciclo financeiro.

-- 1) Recebíveis duplicados para o mesmo atendimento.
select appointment_id, count(*) as duplicates
from public.payments
where tipo = 'receber' and appointment_id is not null
group by appointment_id
having count(*) > 1;

-- 2) Lançamentos liquidados sem método ou sem data efetiva de liquidação.
select id, clinic_id, patient_id, appointment_id, valor, metodo, paid_at
from public.payments
where status = 'pago'
  and (metodo is null or paid_at is null);

-- 3) Pendentes vencidos que ainda não foram marcados como atrasados.
select id, clinic_id, patient_id, vencimento, valor
from public.payments
where status = 'pendente'
  and vencimento < current_date;

-- 4) Recebível de atendimento apontando para paciente/clínica incompatível.
select p.id as payment_id, p.clinic_id as payment_clinic, p.patient_id as payment_patient,
       a.clinic_id as appointment_clinic, a.paciente_id as appointment_patient
from public.payments p
join public.appointments a on a.id = p.appointment_id
where p.appointment_id is not null
  and (p.clinic_id is distinct from a.clinic_id or p.patient_id is distinct from a.paciente_id);

-- 5) Atendimento finalizado avulso com valor positivo sem recebível correspondente.
select a.id as appointment_id, a.clinic_id, a.paciente_id, a.data, a.valor
from public.appointments a
left join public.payments p
  on p.clinic_id = a.clinic_id
 and p.appointment_id = a.id
 and p.tipo = 'receber'
where a.status = 'finalizado'
  and a.valor > 0
  and a.pacote_id is null
  and p.id is null;

-- 6) Uso de pacote duplicado por atendimento.
select appointment_id, count(*) as usage_count
from public.package_session_usage
group by appointment_id
having count(*) > 1;

-- 7) Contador de sessões divergente do ledger real de consumo.
select pp.id as patient_package_id,
       pp.sessoes_usadas as stored_used,
       count(psu.id)::integer as ledger_used
from public.patient_packages pp
left join public.package_session_usage psu on psu.patient_package_id = pp.id
group by pp.id, pp.sessoes_usadas
having pp.sessoes_usadas <> count(psu.id)::integer;

-- 8) Pacote marcado ativo sem saldo.
select id, clinic_id, patient_id, sessoes_totais, sessoes_usadas, status
from public.patient_packages
where status = 'ativo'
  and sessoes_usadas >= sessoes_totais;

-- 9) Histórico de status ausente para pagamentos existentes.
select p.id as payment_id, p.status
from public.payments p
left join public.payment_status_history h on h.payment_id = p.id
where h.id is null;

-- Critério: todas as consultas acima devem retornar zero linhas antes de liberar piloto financeiro.
