import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useClinical } from '../../lib/clinicalContext';
import { STATUS_META } from '../../lib/types';
import { Card, CardHead, Chip, IconAlert, IconChevronR } from '../../lib/ui';
import { Reveal } from '../Reveal';
import { DashboardMetricGrid, DashboardQuickActions } from './DashboardMetricGrid';

const NEXUS_DOMAINS = [
  { title: 'Saúde Mental', sub: 'PHQ-9 e GAD-7 no fluxo de autoavaliação segura; outros rastreios seguem em expansão', status: 'ativo parcial' },
  { title: 'Exame do Estado Mental', sub: 'EEM estruturado, narrativa e integração ao SOAP', status: 'ativo' },
  { title: 'Psicofarmacologia', sub: 'trocas, monitoramento e evidências com regra clínica versionada', status: 'restrito' },
  { title: 'Cognição', sub: 'MEEM, domínios cognitivos e comparação longitudinal', status: 'em integração' },
  { title: 'Evolução longitudinal', sub: 'baseline, tendência por escala e comparação entre consultas', status: 'ativo' },
  { title: 'Evidências', sub: 'fontes, versões, validações e proveniência clínica', status: 'fundação' },
] as const;

export function PsychiatryNexusDashboard() {
  const { user, appointments, patients } = useApp();
  const { evolutions } = useClinical();
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

  const pendingNotes = useMemo(
    () => todayAppointments.filter((appointment) => appointment.status === 'finalizado'
      && !evolutions.some((evolution) => evolution.fisioId === user?.id
        && evolution.pacienteId === appointment.pacienteId
        && evolution.data === today)),
    [todayAppointments, evolutions, user?.id, today],
  );

  const next = todayAppointments.find((appointment) =>
    ['agendado', 'confirmado'].includes(appointment.status)
    && appointment.inicio >= format(new Date(), 'HH:mm'));
  const inService = todayAppointments.filter((appointment) => appointment.status === 'em_atendimento').length;
  const finished = todayAppointments.filter((appointment) => appointment.status === 'finalizado').length;

  const firstName = user?.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ')[0] ?? 'Doutor(a)';

  return <div className="space-y-5">
    <Reveal>
      <section className="relative overflow-hidden rounded-[22px] border border-aqua/25 bg-panel p-5 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aqua/70 to-transparent" />
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Chip className="border-aqua/35 bg-aqua/10 text-aqua">Nexus Clinical Engine</Chip>
              <Chip className="border-mint/30 bg-mint/8 text-mint">Psiquiatria</Chip>
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Olá, {firstName}</h1>
            <p className="mt-1 text-[13px] text-fog">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · visão clínica orientada à psiquiatria</p>
            <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-paper/80">
              O MedicsPro organiza a rotina; o Nexus concentra inteligência clínica, instrumentos, EEM, tendências e evidências no contexto do mesmo paciente e prontuário.
            </p>
          </div>
          <DashboardQuickActions actions={[
            { label: 'Nexus', to: '/nexus', primary: true },
            { label: 'Pacientes', to: '/pacientes' },
            { label: 'Agenda clínica', to: '/agenda' },
          ]} />
        </div>
      </section>
    </Reveal>

    <Reveal delay={50}>
      <DashboardMetricGrid items={[
        { label: 'Consultas hoje', value: todayAppointments.length, sub: next ? `próxima às ${next.inicio.slice(0, 5)}` : 'sem próxima pendente', to: '/agenda' },
        { label: 'Em atendimento', value: inService, sub: 'consulta ativa', tone: inService ? 'text-aqua' : 'text-fog', to: '/hoje' },
        { label: 'Finalizadas', value: finished, sub: 'no dia', tone: 'text-mint', to: '/agenda' },
        { label: 'Registros pendentes', value: pendingNotes.length, sub: 'finalizadas sem evolução hoje', tone: pendingNotes.length ? 'text-amber' : 'text-mint', to: '/hoje' },
      ]} />
    </Reveal>

    <div className="grid xl:grid-cols-[1.15fr_1fr] gap-4 items-start">
      <Reveal delay={90}>
        <Card>
          <CardHead title="Minha agenda clínica" sub="consultas de hoje com acesso direto ao paciente" />
          <div className="divide-y divide-line/70">
            {todayAppointments.length === 0 && <p className="py-10 text-center font-mono text-[11px] text-fog">Nenhuma consulta para hoje.</p>}
            {todayAppointments.map((appointment) => {
              const patient = patients.find((item) => item.id === appointment.pacienteId);
              const meta = STATUS_META[appointment.status];
              return <Link key={appointment.id} to={`/pacientes/${appointment.pacienteId}`} className="grid grid-cols-[62px_1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-raise/50">
                <span className="font-mono text-[12px] text-aqua">{appointment.inicio.slice(0, 5)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-[13px] font-semibold">{patient?.nome ?? 'Paciente'}</span>
                  <span className="block truncate font-mono text-[10px] text-fog">{appointment.tipo}</span>
                </span>
                <Chip className={meta.chip}>{meta.label}</Chip>
              </Link>;
            })}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={120}>
        <Card>
          <CardHead title="Prioridades clínicas" sub="itens que merecem atenção antes de encerrar o dia" right={<IconAlert className="h-4.5 w-4.5 text-amber" />} />
          <div className="divide-y divide-line/70">
            {pendingNotes.length === 0 && <div className="px-5 py-8 text-center text-[12px] text-fog">Sem registros clínicos pendentes de hoje.</div>}
            {pendingNotes.slice(0, 5).map((appointment) => {
              const patient = patients.find((item) => item.id === appointment.pacienteId);
              return <Link key={appointment.id} to={`/pacientes/${appointment.pacienteId}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-raise/50">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-amber/30 bg-amber/8 text-amber">!</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">Finalizar registro — {patient?.nome ?? 'Paciente'}</span>
                  <span className="block font-mono text-[10px] text-fog">consulta finalizada às {appointment.fim.slice(0, 5)}</span>
                </span>
                <IconChevronR className="h-3.5 w-3.5 text-fog group-hover:text-mint" />
              </Link>;
            })}
          </div>
        </Card>
      </Reveal>
    </div>

    <Reveal delay={150}>
      <div>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <p className="font-display text-[17px] font-semibold">Nexus no fluxo psiquiátrico</p>
            <p className="mt-1 text-[12px] text-fog">Domínios clínicos preservados como uma camada especializada dentro do MedicsPro.</p>
          </div>
          <Link to="/nexus" className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-aqua hover:text-paper">Abrir biblioteca Nexus <IconChevronR className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {NEXUS_DOMAINS.map((domain) => (
            <Link to="/nexus" key={domain.title} className="rounded-2xl border border-line/80 bg-panel p-4 transition-colors hover:border-aqua/35 hover:bg-raise/30">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[14px] font-semibold">{domain.title}</p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-fog">{domain.sub}</p>
                </div>
                <Chip className="shrink-0 border-aqua/25 text-aqua">{domain.status}</Chip>
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-fog">acesso real continua sujeito a capability + entitlement</p>
      </div>
    </Reveal>

    <Reveal delay={180}>
      <div className="rounded-2xl border border-line/70 bg-deep/50 px-4 py-3 text-[10.5px] leading-relaxed text-fog">
        <strong className="font-semibold text-paper/80">Nexus Clinical Engine.</strong> Conteúdo e arquitetura clínica: Dr. Adolfo Aranha · Médico Psiquiatra. O motor oferece suporte à decisão baseado em regras e evidências; autoria e decisão clínica permanecem do profissional responsável.
      </div>
    </Reveal>
  </div>;
}
