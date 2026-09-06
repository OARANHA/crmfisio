import { useMemo } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useClinical } from '../../lib/clinicalContext';
import { usePackages } from '../../lib/packageContext';
import { STATUS_META } from '../../lib/types';
import { Card, CardHead, Chip, IconAlert, IconChevronR } from '../../lib/ui';
import { Reveal } from '../Reveal';
import { DashboardMetricGrid, DashboardQuickActions } from './DashboardMetricGrid';

export function ClinicianDashboard() {
  const { user, appointments, patients } = useApp();
  const { evolutions } = useClinical();
  const { patientPackages, packages } = usePackages();
  const today = format(new Date(), 'yyyy-MM-dd');

  const ownAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.fisioId === user?.id),
    [appointments, user?.id],
  );

  const todayAppointments = useMemo(
    () => ownAppointments
      .filter((appointment) => appointment.data === today)
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [ownAppointments, today],
  );

  const missingEvolution = useMemo(
    () => todayAppointments.filter((appointment) => {
      if (appointment.status !== 'finalizado') return false;
      return !evolutions.some((evolution) => evolution.fisioId === user?.id && evolution.pacienteId === appointment.pacienteId && evolution.data === today);
    }),
    [todayAppointments, evolutions, user?.id, today],
  );

  const continuityRisks = useMemo(() => {
    return patients
      .filter((patient) => !patient.anonimizado && patient.funilStage === 'tratamento')
      .map((patient) => {
        const history = ownAppointments
          .filter((appointment) => appointment.pacienteId === patient.id && appointment.status === 'finalizado' && appointment.data <= today)
          .sort((a, b) => b.data.localeCompare(a.data));
        const last = history[0];
        if (!last) return null;
        const future = ownAppointments.some((appointment) => appointment.pacienteId === patient.id && appointment.data >= today && ['agendado', 'confirmado', 'em_atendimento'].includes(appointment.status));
        const days = differenceInCalendarDays(new Date(today + 'T12:00:00'), parseISO(last.data));
        if (future || days < 21) return null;
        const patientPackage = patientPackages.find((item) => item.pacienteId === patient.id && item.status === 'ativo');
        const pkg = patientPackage ? packages.find((item) => item.id === patientPackage.pacoteId) : null;
        const remaining = patientPackage ? Math.max(patientPackage.sessoesTotais - patientPackage.sessoesUsadas, 0) : null;
        return { patient, last, days, remaining, packageName: pkg?.nome ?? null };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.days - a.days)
      .slice(0, 6);
  }, [patients, ownAppointments, patientPackages, packages, today]);

  const confirmed = todayAppointments.filter((appointment) => appointment.status === 'confirmado').length;
  const inService = todayAppointments.filter((appointment) => appointment.status === 'em_atendimento').length;
  const finished = todayAppointments.filter((appointment) => appointment.status === 'finalizado').length;
  const next = todayAppointments.find((appointment) => ['agendado', 'confirmado'].includes(appointment.status) && appointment.inicio >= format(new Date(), 'HH:mm'));

  return <div className="space-y-4">
    <Reveal>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Olá, {user?.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ')[0]}</h1>
          <p className="text-fog text-[13px] mt-0.5">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · visão clínica do dia</p>
        </div>
        <div className="ml-auto"><DashboardQuickActions actions={[{ label: 'Minha fila de hoje', to: '/hoje', primary: true }, { label: 'Agenda completa', to: '/agenda' }]} /></div>
      </div>
    </Reveal>

    <Reveal delay={60}>
      <DashboardMetricGrid items={[
        { label: 'Sessões hoje', value: todayAppointments.length, sub: next ? `próxima às ${next.inicio.slice(0, 5)}` : 'sem próxima pendente', to: '/agenda' },
        { label: 'Confirmados', value: confirmed, sub: 'aguardando atendimento', tone: 'text-mint', to: '/hoje' },
        { label: 'Em atendimento', value: inService, sub: 'agora', tone: inService ? 'text-aqua' : 'text-fog', to: '/hoje' },
        { label: 'Finalizados', value: finished, sub: 'no dia', tone: 'text-mint', to: '/agenda' },
        { label: 'Evoluções pendentes', value: missingEvolution.length, sub: 'sessões finalizadas hoje', tone: missingEvolution.length ? 'text-amber' : 'text-mint', to: '/hoje' },
      ]} />
    </Reveal>

    <div className="grid xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
      <Reveal delay={100}>
        <Card>
          <CardHead title="Minha agenda clínica" sub="atendimentos de hoje em ordem cronológica" />
          <div className="divide-y divide-line/70">
            {todayAppointments.length === 0 && <p className="font-mono text-[11px] text-fog text-center py-10">Nenhum atendimento para hoje.</p>}
            {todayAppointments.map((appointment) => {
              const patient = patients.find((item) => item.id === appointment.pacienteId);
              const meta = STATUS_META[appointment.status];
              return <Link key={appointment.id} to="/agenda" className="grid grid-cols-[62px_1fr_auto] gap-3 items-center px-5 py-3 hover:bg-raise/50 transition-colors">
                <span className="font-mono text-[12px] text-mint">{appointment.inicio.slice(0, 5)}</span>
                <span className="min-w-0"><span className="block font-display font-semibold text-[13px] truncate">{patient?.nome ?? 'Paciente'}</span><span className="block font-mono text-[10px] text-fog truncate">{appointment.tipo}</span></span>
                <Chip className={meta.chip}>{meta.label}</Chip>
              </Link>;
            })}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={140}>
        <Card>
          <CardHead title="Pendências clínicas" sub="o que merece ação do profissional" right={<IconAlert className="w-4.5 h-4.5 text-amber" />} />
          <div className="divide-y divide-line/70">
            {missingEvolution.length === 0 && continuityRisks.length === 0 && <p className="font-mono text-[11px] text-fog text-center py-10">Sem pendências clínicas relevantes. ✓</p>}
            {missingEvolution.slice(0, 3).map((appointment) => {
              const patient = patients.find((item) => item.id === appointment.pacienteId);
              return <Link key={`evo-${appointment.id}`} to={`/pacientes/${appointment.pacienteId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-raise/50 transition-colors group"><span>📝</span><span className="text-[12.5px] flex-1">Registrar evolução — {patient?.nome ?? 'Paciente'}</span><IconChevronR className="w-3.5 h-3.5 text-fog group-hover:text-mint" /></Link>;
            })}
            {continuityRisks.slice(0, 3).map((risk) => <Link key={`risk-${risk.patient.id}`} to={`/pacientes/${risk.patient.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-raise/50 transition-colors group"><span>⚠️</span><span className="text-[12.5px] flex-1"><strong className="font-semibold">{risk.patient.nome}</strong><span className="block font-mono text-[10px] text-fog">{risk.days} dias sem sessão{risk.remaining !== null ? ` · ${risk.remaining} restante(s)${risk.packageName ? ` em ${risk.packageName}` : ''}` : ''}</span></span><IconChevronR className="w-3.5 h-3.5 text-fog group-hover:text-mint" /></Link>)}
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
      </div>
    </Reveal>
  </div>;
}
