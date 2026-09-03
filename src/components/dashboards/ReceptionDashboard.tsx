import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useApp, useUnitFilter } from '../../lib/store';
import { STATUS_META, fmtBRL } from '../../lib/types';
import { Card, CardHead, Chip, IconAlert, IconChevronR } from '../../lib/ui';
import { Reveal } from '../Reveal';
import { buildChurnRiskList } from '../../lib/churnRisk';

type ActionItem = {
  icon: string;
  label: string;
  to: string;
  tone: string;
};

export function ReceptionDashboard() {
  const { user, appointments, patients, patientPackages, consents, transactions, users, unidadeSel, unidades } = useApp();
  const inUnit = useUnitFilter();
  const today = format(new Date(), 'yyyy-MM-dd');
  const unit = unidades.find((item) => item.id === unidadeSel);

  const todayAppointments = useMemo(
    () => appointments
      .filter((appointment) => appointment.data === today && inUnit(appointment))
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [appointments, today, inUnit],
  );

  const operational = useMemo(() => {
    const pendingConfirmation = todayAppointments.filter((appointment) => appointment.status === 'agendado').length;
    const confirmed = todayAppointments.filter((appointment) => appointment.status === 'confirmado').length;
    const inService = todayAppointments.filter((appointment) => appointment.status === 'em_atendimento').length;
    const pendingConsents = consents.filter((consent) => !consent.assinado).length;
    const overdue = transactions.filter((transaction) => transaction.tipo === 'receber' && transaction.status === 'atrasado');
    return {
      pendingConfirmation,
      confirmed,
      inService,
      pendingConsents,
      overdueCount: overdue.length,
      overdueValue: overdue.reduce((sum, item) => sum + item.valor, 0),
    };
  }, [todayAppointments, consents, transactions]);

  const actions = useMemo<ActionItem[]>(() => {
    const result: ActionItem[] = [];
    consents.filter((consent) => !consent.assinado).slice(0, 3).forEach((consent) => {
      const patient = patients.find((item) => item.id === consent.pacienteId);
      if (patient) result.push({ icon: '✍️', label: `Coletar consentimento — ${patient.nome}`, to: `/pacientes/${patient.id}`, tone: 'text-amber' });
    });
    transactions.filter((transaction) => transaction.tipo === 'receber' && transaction.status === 'atrasado').slice(0, 3).forEach((transaction) => {
      result.push({ icon: '💸', label: `Cobrança vencida — ${transaction.descricao} (${fmtBRL(transaction.valor)})`, to: '/financeiro', tone: 'text-pulse' });
    });
    buildChurnRiskList(patients, appointments, patientPackages, transactions)
      .filter((risk) => risk.level !== 'baixo').slice(0, 2).forEach((risk) => {
      result.push({ icon: '📞', label: `Risco ${risk.level} — ${risk.patientName}`, to: '/crm', tone: 'text-aqua' });
    });
    return result.slice(0, 6);
  }, [consents, transactions, patients, appointments, patientPackages]);

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Bom trabalho, {user?.nome.split(' ')[0]}</h1>
            <p className="text-fog text-[13px] mt-0.5">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · central operacional da recepção
            </p>
          </div>
          <Chip className={`ml-auto ${unidadeSel === 'all' ? 'border-line2 text-fog' : 'border-mint/40 text-mint'}`}>
            {unit ? unit.nome : 'Todas as unidades'}
          </Chip>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-line border border-line">
          {[
            { label: 'Agenda hoje', value: todayAppointments.length, sub: 'atendimentos previstos', tone: 'text-paper' },
            { label: 'A confirmar', value: operational.pendingConfirmation, sub: 'pedem contato', tone: operational.pendingConfirmation ? 'text-amber' : 'text-mint' },
            { label: 'Confirmados', value: operational.confirmed, sub: 'presenças esperadas', tone: 'text-mint' },
            { label: 'Consentimentos', value: operational.pendingConsents, sub: 'pendentes de aceite', tone: operational.pendingConsents ? 'text-amber' : 'text-mint' },
            { label: 'Cobranças vencidas', value: operational.overdueCount, sub: operational.overdueValue ? fmtBRL(operational.overdueValue) : 'nenhuma pendência', tone: operational.overdueCount ? 'text-pulse' : 'text-mint' },
          ].map((item) => (
            <div key={item.label} className="bg-panel px-5 py-4">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog">{item.label}</p>
              <p className={`font-display text-[26px] font-bold leading-tight mt-1 ${item.tone}`}>{item.value}</p>
              <p className="font-mono text-[10.5px] text-fog/80 mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <Reveal delay={100}>
          <Card>
            <CardHead title="Agenda operacional de hoje" sub="quem chega, horário, profissional e status" />
            <div className="divide-y divide-line/70">
              {todayAppointments.length === 0 && (
                <p className="font-mono text-[11px] text-fog text-center py-10">Nenhum atendimento agendado para hoje.</p>
              )}
              {todayAppointments.map((appointment) => {
                const patient = patients.find((item) => item.id === appointment.pacienteId);
                const professional = users.find((item) => item.id === appointment.fisioId);
                const status = STATUS_META[appointment.status];
                return (
                  <Link key={appointment.id} to="/agenda" className="grid grid-cols-[64px_1fr_auto] gap-3 items-center px-5 py-3 hover:bg-raise/50 transition-colors">
                    <span className="font-mono text-[12px] text-mint">{appointment.inicio}</span>
                    <span className="min-w-0">
                      <span className="block font-display font-semibold text-[13px] truncate">{patient?.nome ?? 'Paciente'}</span>
                      <span className="block font-mono text-[10px] text-fog truncate">{professional?.nome ?? 'Profissional'} · {appointment.tipo}</span>
                    </span>
                    <Chip className={status.chip}>{status.label}</Chip>
                  </Link>
                );
              })}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={140}>
          <Card>
            <CardHead title="Exigem ação" sub="pendências operacionais" right={<IconAlert className="w-4.5 h-4.5 text-amber" />} />
            <div className="divide-y divide-line/70">
              {actions.length === 0 && <p className="font-mono text-[11px] text-fog text-center py-10">Operação em dia. ✓</p>}
              {actions.map((item, index) => (
                <Link key={`${item.to}-${index}`} to={item.to} className="flex items-center gap-3 px-5 py-3 hover:bg-raise/50 transition-colors group">
                  <span>{item.icon}</span>
                  <span className={`text-[12.5px] flex-1 leading-snug ${item.tone}`}>{item.label}</span>
                  <IconChevronR className="w-3.5 h-3.5 text-fog group-hover:text-mint" />
                </Link>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={180}>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((statusKey) => {
            const count = todayAppointments.filter((appointment) => appointment.status === statusKey).length;
            return <Chip key={statusKey} className={STATUS_META[statusKey].chip}>{STATUS_META[statusKey].label}: {count}</Chip>;
          })}
          <Chip className="border-aqua/30 text-aqua">Em atendimento agora: {operational.inService}</Chip>
        </div>
      </Reveal>
    </div>
  );
}
