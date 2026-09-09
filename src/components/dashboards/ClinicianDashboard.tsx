import { useMemo, type ReactNode } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useAgenda } from '../../lib/agendaContext';
import { useCurrentUserAccess } from '../../lib/currentUserAccess';
import { usePatients } from '../../lib/patientContext';
import { useClinical } from '../../lib/clinicalContext';
import { usePackages } from '../../lib/packageContext';
import {
  activeEncounterStartedLabel,
  clinicianEncounterPath,
  resolveProfessionalActiveEncounter,
} from '../../lib/clinicianDaily';
import { professionalIdOf } from '../../lib/professionalReference';
import { STATUS_META } from '../../lib/types';
import { Btn, Card, CardHead, Chip, IconAlert, IconChevronR } from '../../lib/ui';
import { Reveal } from '../Reveal';
import { DashboardMetricGrid, DashboardQuickActions } from './DashboardMetricGrid';

export function ClinicianDashboard({ nexusContext = null }: { nexusContext?: ReactNode }) {
  const { user } = useCurrentUserAccess();
  const { patients } = usePatients();
  const { appointments } = useAgenda();
  const { evolutions } = useClinical();
  const { patientPackages, packages } = usePackages();
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');

  const ownAppointments = useMemo(
    () => appointments.filter((appointment) => professionalIdOf(appointment) === user?.id),
    [appointments, user?.id],
  );

  const activeEncounter = useMemo(
    () => resolveProfessionalActiveEncounter(appointments, user?.id),
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
      return !evolutions.some((evolution) => evolution.sessionId === appointment.id);
    }),
    [todayAppointments, evolutions],
  );

  const continuityRisks = useMemo(() => patients
    .filter((patient) => !patient.anonimizado && patient.funilStage === 'tratamento')
    .map((patient) => {
      const history = ownAppointments
        .filter((appointment) => appointment.pacienteId === patient.id && appointment.status === 'finalizado' && appointment.data <= today)
        .sort((a, b) => b.data.localeCompare(a.data));
      const last = history[0];
      if (!last) return null;
      const future = ownAppointments.some((appointment) => appointment.pacienteId === patient.id
        && appointment.data >= today
        && ['agendado', 'confirmado', 'em_atendimento'].includes(appointment.status));
      const days = differenceInCalendarDays(new Date(`${today}T12:00:00`), parseISO(last.data));
      if (future || days < 21) return null;
      const patientPackage = patientPackages.find((item) => item.pacienteId === patient.id && item.status === 'ativo');
      const pkg = patientPackage ? packages.find((item) => item.id === patientPackage.pacoteId) : null;
      const remaining = patientPackage ? Math.max(patientPackage.sessoesTotais - patientPackage.sessoesUsadas, 0) : null;
      return { patient, last, days, remaining, packageName: pkg?.nome ?? null };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.days - a.days)
    .slice(0, 6), [patients, ownAppointments, patientPackages, packages, today]);

  const confirmed = todayAppointments.filter((appointment) => appointment.status === 'confirmado').length;
  const inServiceToday = todayAppointments.filter((appointment) => appointment.status === 'em_atendimento').length;
  const finished = todayAppointments.filter((appointment) => appointment.status === 'finalizado').length;
  const next = todayAppointments.find((appointment) =>
    ['agendado', 'confirmado'].includes(appointment.status)
    && appointment.inicio >= format(now, 'HH:mm'));
  const activePatient = activeEncounter ? patients.find((patient) => patient.id === activeEncounter.pacienteId) : null;
  const nextPatient = next ? patients.find((patient) => patient.id === next.pacienteId) : null;
  const firstName = user?.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ')[0] ?? 'Profissional';

  return <div className="space-y-5">
    <Reveal>
      <section className="overflow-hidden rounded-[26px] border border-line/70 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-mint)_8%,var(--color-panel)),var(--color-panel)_55%,color-mix(in_srgb,var(--color-aqua)_5%,var(--color-panel)))] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.06)] sm:p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-[260px] flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mint">Seu dia está aqui</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-[34px]">Olá, {firstName}</h1>
            <p className="mt-1 text-[13px] capitalize text-fog">{format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-fog">Atendimentos, próximo movimento e pendências clínicas em uma única visão para você decidir rápido o que fazer agora.</p>
          </div>
          <DashboardQuickActions actions={[
            { label: 'Abrir Agenda', to: '/agenda', primary: true },
            { label: 'Pacientes', to: '/pacientes' },
          ]} />
        </div>
      </section>
    </Reveal>

    {activeEncounter && (
      <Reveal delay={35}>
        <section className="rounded-[22px] border border-aqua/35 bg-aqua/[0.055] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.045)]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-aqua">Atendimento em andamento</p>
              <h2 className="mt-2 truncate font-display text-[22px] font-bold text-paper">{activePatient?.preferredName || activePatient?.nome || 'Paciente'}</h2>
              <p className="mt-1 text-[12.5px] text-fog">{activeEncounterStartedLabel(activeEncounter, now)} · {activeEncounter.tipo}</p>
              {activeEncounter.data !== today && <p className="mt-2 text-[11.5px] text-amber">Este atendimento segue aberto de uma data anterior e precisa de continuidade clínica.</p>}
            </div>
            <Link to={clinicianEncounterPath(activeEncounter)}>
              <Btn>Continuar atendimento</Btn>
            </Link>
          </div>
        </section>
      </Reveal>
    )}

    <Reveal delay={55}>
      <DashboardMetricGrid items={[
        { label: 'Atendimentos hoje', value: todayAppointments.length, sub: next ? `próximo às ${next.inicio.slice(0, 5)}` : 'sem próximo pendente', to: '/agenda' },
        { label: 'Confirmados', value: confirmed, sub: 'aguardando atendimento', tone: confirmed ? 'text-amber' : 'text-fog', to: '/agenda' },
        { label: 'Em atendimento', value: inServiceToday, sub: 'no período de hoje', tone: inServiceToday ? 'text-aqua' : 'text-fog', to: '/agenda' },
        { label: 'Finalizados', value: finished, sub: 'no dia', tone: 'text-mint', to: '/agenda' },
        { label: 'Evoluções pendentes', value: missingEvolution.length, sub: 'sessões finalizadas hoje', tone: missingEvolution.length ? 'text-amber' : 'text-mint', to: '/agenda' },
      ]} />
    </Reveal>

    <div className="grid items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
      <Reveal delay={90}>
        <Card>
          <CardHead title="Próximo movimento" sub={activeEncounter ? 'continue o atendimento que já está aberto' : 'o que vem agora na sua agenda'} />
          {activeEncounter ? (
            <Link to={clinicianEncounterPath(activeEncounter)} className="group flex items-center gap-3 px-5 py-5 transition-colors hover:bg-raise/50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-aqua/30 bg-aqua/10 text-aqua">▶</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[14px] font-semibold">Continuar — {activePatient?.preferredName || activePatient?.nome || 'Paciente'}</span>
                <span className="mt-1 block text-[11px] text-fog">{activeEncounterStartedLabel(activeEncounter, now)}</span>
              </span>
              <IconChevronR className="h-4 w-4 text-fog group-hover:text-aqua" />
            </Link>
          ) : next ? (
            <Link to={clinicianEncounterPath(next)} className="group flex items-center gap-3 px-5 py-5 transition-colors hover:bg-raise/50">
              <span className="font-mono text-[13px] font-semibold text-aqua">{next.inicio.slice(0, 5)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[14px] font-semibold">{nextPatient?.preferredName || nextPatient?.nome || 'Paciente'}</span>
                <span className="mt-1 block truncate text-[11px] text-fog">{next.tipo} · preparar prontuário</span>
              </span>
              <IconChevronR className="h-4 w-4 text-fog group-hover:text-aqua" />
            </Link>
          ) : (
            <div className="px-5 py-8 text-center text-[12.5px] text-fog">Sem próximo atendimento pendente hoje. Consulte a Agenda para os próximos dias.</div>
          )}

          <div className="border-t border-line/65">
            <p className="px-5 pt-4 text-[11px] font-semibold uppercase tracking-[0.09em] text-fog">Agenda de hoje</p>
            <div className="divide-y divide-line/60">
              {todayAppointments.slice(0, 5).map((appointment) => {
                const patient = patients.find((item) => item.id === appointment.pacienteId);
                const meta = STATUS_META[appointment.status];
                return <Link key={appointment.id} to={clinicianEncounterPath(appointment)} className="grid grid-cols-[58px_1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-raise/50">
                  <span className="font-mono text-[11.5px] text-fog">{appointment.inicio.slice(0, 5)}</span>
                  <span className="min-w-0"><span className="block truncate text-[12.5px] font-semibold">{patient?.preferredName || patient?.nome || 'Paciente'}</span><span className="block truncate text-[10.5px] text-fog">{appointment.tipo}</span></span>
                  <Chip className={meta.chip}>{meta.label}</Chip>
                </Link>;
              })}
              {todayAppointments.length === 0 && <p className="px-5 py-6 text-center text-[12px] text-fog">Nenhum atendimento na agenda de hoje.</p>}
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={120}>
        <Card>
          <CardHead title="Prioridades" sub="pendências que merecem sua atenção" right={<IconAlert className="h-4.5 w-4.5 text-amber" />} />
          <div className="divide-y divide-line/70">
            {missingEvolution.length === 0 && continuityRisks.length === 0 && <p className="py-10 text-center text-[12px] text-fog">Sem pendências clínicas relevantes.</p>}
            {missingEvolution.slice(0, 3).map((appointment) => {
              const patient = patients.find((item) => item.id === appointment.pacienteId);
              return <Link key={`evo-${appointment.id}`} to={clinicianEncounterPath(appointment)} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-raise/50"><span className="grid h-8 w-8 place-items-center rounded-full border border-amber/30 bg-amber/10 text-amber">!</span><span className="flex-1 text-[12.5px]">Registrar evolução — {patient?.preferredName || patient?.nome || 'Paciente'}</span><IconChevronR className="h-3.5 w-3.5 text-fog group-hover:text-mint" /></Link>;
            })}
            {continuityRisks.slice(0, 3).map((risk) => <Link key={`risk-${risk.patient.id}`} to={`/pacientes/${risk.patient.id}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-raise/50"><span className="grid h-8 w-8 place-items-center rounded-full border border-amber/30 bg-amber/10 text-amber">!</span><span className="flex-1 text-[12.5px]"><strong className="font-semibold">{risk.patient.preferredName || risk.patient.nome}</strong><span className="block text-[10.5px] text-fog">{risk.days} dias sem sessão{risk.remaining !== null ? ` · ${risk.remaining} restante(s)${risk.packageName ? ` em ${risk.packageName}` : ''}` : ''}</span></span><IconChevronR className="h-3.5 w-3.5 text-fog group-hover:text-mint" /></Link>)}
          </div>
        </Card>
      </Reveal>
    </div>

    {nexusContext}
  </div>;
}
