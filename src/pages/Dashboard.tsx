import { useMemo } from 'react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useClinicModuleEntitlementVisibility } from '../hooks/useClinicModuleEntitlementVisibility';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { usePatients } from '../lib/patientContext';
import { useAgenda } from '../lib/agendaContext';
import { useFinance } from '../lib/financeContext';
import { useClinicDirectory } from '../lib/clinicDirectoryContext';
import { useClinical } from '../lib/clinicalContext';
import { usePackages } from '../lib/packageContext';
import { useInfrastructure, useUnitFilter } from '../lib/infrastructureContext';
import { hasClinicalDirectoryIdentity } from '../lib/professionalIdentity';
import { professionalIdOf } from '../lib/professionalReference';
import { fmtBRL, STATUS_META, dayOf } from '../lib/types';
import {
  Card,
  CardHead,
  Chip,
  IconAlert,
  IconCalendar,
  IconChevronR,
  IconClock,
  IconTrend,
  IconUsers,
} from '../lib/ui';
import { Reveal, CountUp } from '../components/Reveal';
import { Ecg } from '../components/Ecg';
import { RevenueRecovery } from '../components/RevenueRecovery';
import { OperationalHealthCard } from '../components/dashboards/OperationalHealthCard';
import { RecoveryImpactCard } from '../components/dashboards/RecoveryImpactCard';
import { buildChurnRiskList } from '../lib/churnRisk';
import { DashboardMetricGrid, DashboardQuickActions } from '../components/dashboards/DashboardMetricGrid';

const inactiveAppointmentStatuses = new Set(['cancelado', 'faltou', 'finalizado']);

export function Dashboard() {
  const { user } = useCurrentUserAccess();
  const { transactions } = useFinance();
  const { patients } = usePatients();
  const { appointments } = useAgenda();
  const { users } = useClinicDirectory();
  const { surveys, consents } = useClinical();
  const { patientPackages } = usePackages();
  const { unidadeSel, unidades } = useInfrastructure();
  const inUnit = useUnitFilter();
  const { visibility, resolved } = useClinicModuleEntitlementVisibility();
  const financeAllowed = resolved && visibility.financeiro === true;
  const crmAllowed = resolved && visibility.crm === true;
  const reportsAllowed = resolved && visibility.relatorios === true;

  const mes = format(new Date(), 'yyyy-MM');
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const agora = format(new Date(), 'HH:mm');
  const unidade = unidades.find((u) => u.id === unidadeSel);

  const k = useMemo(() => {
    const prodMes = appointments.filter((a) => a.status === 'finalizado' && dayOf(a).startsWith(mes) && inUnit(a));
    const producao = prodMes.reduce((s, a) => s + a.valor, 0);
    const aReceber = financeAllowed ? transactions.filter((t) => t.tipo === 'receber' && t.status !== 'pago').reduce((s, t) => s + t.valor, 0) : 0;
    const faltas = appointments.filter((a) => a.status === 'faltou' && dayOf(a).startsWith(mes) && inUnit(a)).length;
    const realizadas = prodMes.length;
    const comparecimento = realizadas + faltas > 0 ? Math.round((realizadas / (realizadas + faltas)) * 100) : 100;
    const novos = patients.filter((p) => p.createdAt.startsWith(mes) && !p.anonimizado).length;
    const notas = reportsAllowed ? surveys.filter((s) => s.nota !== null && s.data.startsWith(mes)).map((s) => s.nota as number) : [];
    const nps = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : 0;
    return { producao, aReceber, comparecimento, novos, nps, realizadas, faltas };
  }, [appointments, transactions, patients, surveys, mes, inUnit, financeAllowed, reportsAllowed]);

  const agendaHoje = useMemo(
    () => appointments
      .filter((a) => dayOf(a) === hoje && inUnit(a))
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [appointments, hoje, inUnit],
  );

  const proximosHoje = agendaHoje.filter((a) => !inactiveAppointmentStatuses.has(a.status));
  const proximo = proximosHoje.find((a) => a.fim >= agora) ?? proximosHoje[0] ?? null;
  const pacienteProximo = proximo ? patients.find((p) => p.id === proximo.pacienteId) : null;
  const profissionalProximo = proximo ? users.find((u) => u.id === professionalIdOf(proximo)) : null;
  const finalizadosHoje = agendaHoje.filter((a) => a.status === 'finalizado').length;
  const aguardandoConfirmacao = agendaHoje.filter((a) => a.status === 'agendado').length;

  const semana = useMemo(() => {
    if (!financeAllowed) return [];
    const days = Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), i - 6), 'yyyy-MM-dd'));
    return days.map((dIso) => ({
      dIso,
      label: format(new Date(dIso + 'T12:00'), 'EEE', { locale: ptBR }).replace('.', ''),
      valor: transactions
        .filter((t) => t.tipo === 'receber' && t.status === 'pago' && t.paidAt?.startsWith(dIso))
        .reduce((s, t) => s + t.valor, 0),
    }));
  }, [transactions, financeAllowed]);
  const maxSemana = Math.max(...semana.map((s) => s.valor), 1);

  const prod = useMemo(() => {
    if (!reportsAllowed) return [];
    return users
      .filter((u) => u.ativo && hasClinicalDirectoryIdentity(u.professionalType))
      .map((professional) => {
        const fin = appointments.filter((a) => professionalIdOf(a) === professional.id && a.status === 'finalizado' && dayOf(a).startsWith(mes) && inUnit(a));
        const falt = appointments.filter((a) => professionalIdOf(a) === professional.id && a.status === 'faltou' && dayOf(a).startsWith(mes) && inUnit(a)).length;
        const valor = fin.reduce((s, a) => s + a.valor, 0);
        const comp = fin.length + falt > 0 ? Math.round((fin.length / (fin.length + falt)) * 100) : 100;
        return { professional, atendimentos: fin.length, valor, comp };
      });
  }, [appointments, users, mes, inUnit, reportsAllowed]);
  const maxProd = Math.max(...prod.map((p) => p.valor), 1);
  const churnRisks = useMemo(
    () => crmAllowed ? buildChurnRiskList(patients, appointments, patientPackages, transactions).filter((risk) => risk.level !== 'baixo') : [],
    [patients, appointments, patientPackages, transactions, crmAllowed],
  );

  const pendencias = [
    ...(financeAllowed ? transactions.filter((t) => t.status === 'atrasado').map((t) => ({ icon: '💸', txt: `Cobrança atrasada: ${t.descricao} (${fmtBRL(t.valor)})`, to: '/financeiro' })) : []),
    ...consents.filter((c) => !c.assinado).map((c) => ({ icon: '✍️', txt: `Termo pendente — ${patients.find((p) => p.id === c.pacienteId)?.nome ?? ''}`, to: `/pacientes/${c.pacienteId}` })),
    ...(crmAllowed ? churnRisks.map((risk) => ({ icon: '⚠️', txt: `Risco ${risk.level}: ${risk.patientName} — ${risk.reasons[0] ?? 'continuidade comprometida'}`, to: '/crm' })) : []),
  ].slice(0, 5);

  const firstName = user?.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ')[0] ?? '';

  return (
    <div className="space-y-5">
      <Reveal>
        <section className="relative overflow-hidden rounded-[28px] border border-line/70 bg-panel shadow-[0_24px_70px_rgba(4,12,9,0.09)]">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-mint/[0.07] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-aqua/[0.055] blur-3xl" />

          <div className="relative grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.18fr_.82fr] xl:p-7">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/[0.06] px-3 py-1.5 text-[12px] font-semibold text-mint">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" />Central operacional
                </span>
                <Chip className={unidadeSel === 'all' ? 'border-line2/80 text-fog' : 'border-mint/35 text-mint'}>{unidade ? unidade.nome : 'Todas as unidades'}</Chip>
              </div>

              <div className="mt-5 max-w-3xl">
                <p className="text-[13px] font-medium text-fog">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                <h1 className="mt-1 font-display text-[34px] font-bold tracking-[-0.045em] sm:text-[40px]">Olá, {firstName}. <span className="text-fog/70">Seu dia está aqui.</span></h1>
                <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-fog">Agenda, prioridades operacionais e sinais financeiros em uma única visão para decidir o que merece atenção agora.</p>
              </div>

              <div className="mt-6 grid gap-3 lg:grid-cols-[1.35fr_.65fr]">
                <Link to="/agenda" className="group relative overflow-hidden rounded-[22px] border border-line/70 bg-deep/70 p-4.5 transition-all hover:border-mint/35 hover:bg-raise/35">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-mint/20 bg-mint/[0.08] text-mint"><IconClock className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fog">Próximo movimento</p>
                        {proximo ? <>
                          <p className="mt-1 truncate font-display text-[20px] font-bold tracking-[-0.02em]">{proximo.inicio} · {pacienteProximo?.nome ?? 'Paciente'}</p>
                          <p className="mt-1 truncate text-[13px] text-fog">{profissionalProximo?.nome ?? 'Profissional'} · {STATUS_META[proximo.status].label}</p>
                        </> : <>
                          <p className="mt-1 font-display text-[20px] font-bold tracking-[-0.02em]">Agenda sob controle</p>
                          <p className="mt-1 text-[13px] text-fog">Nenhum atendimento pendente para hoje.</p>
                        </>}
                      </div>
                    </div>
                    <IconChevronR className="mt-1 h-4.5 w-4.5 shrink-0 text-fog/50 transition-all group-hover:translate-x-0.5 group-hover:text-mint" />
                  </div>
                  {proximo && <div className="mt-4 h-1 overflow-hidden rounded-full bg-raise"><div className="h-full w-2/3 rounded-full bg-mint/75" /></div>}
                </Link>

                <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                  <div className="rounded-2xl border border-line/65 bg-deep/55 px-3.5 py-3">
                    <div className="flex items-center gap-2 text-fog"><IconCalendar className="h-4 w-4" /><span className="text-[11px] font-semibold">Hoje</span></div>
                    <p className="mt-1.5 font-display text-[22px] font-bold">{agendaHoje.length}</p>
                  </div>
                  <div className="rounded-2xl border border-line/65 bg-deep/55 px-3.5 py-3">
                    <div className="flex items-center gap-2 text-fog"><IconTrend className="h-4 w-4" /><span className="text-[11px] font-semibold">Finalizados</span></div>
                    <p className="mt-1.5 font-display text-[22px] font-bold text-mint">{finalizadosHoje}</p>
                  </div>
                  <div className="rounded-2xl border border-line/65 bg-deep/55 px-3.5 py-3">
                    <div className="flex items-center gap-2 text-fog"><IconUsers className="h-4 w-4" /><span className="text-[11px] font-semibold">A confirmar</span></div>
                    <p className="mt-1.5 font-display text-[22px] font-bold text-amber">{aguardandoConfirmacao}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col rounded-[22px] border border-line/70 bg-deep/55 p-4.5 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fog">Ações rápidas</p>
                  <h2 className="mt-1 font-display text-[20px] font-bold tracking-[-0.02em]">Menos procura. Mais execução.</h2>
                </div>
                <span className={`grid h-10 min-w-10 place-items-center rounded-2xl border px-2 font-display text-[16px] font-bold ${pendencias.length ? 'border-amber/25 bg-amber/[0.08] text-amber' : 'border-mint/25 bg-mint/[0.08] text-mint'}`}>{pendencias.length}</span>
              </div>

              <div className="mt-5">
                <DashboardQuickActions actions={[
                  { label: 'Abrir agenda', to: '/agenda', primary: true },
                  { label: 'Pacientes', to: '/pacientes' },
                  { label: 'Financeiro', to: '/financeiro' },
                ]} />
              </div>

              <div className="mt-5 border-t border-line/60 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-paper">Prioridades abertas</p>
                    <p className="mt-0.5 text-[12px] text-fog">pendências clínicas, financeiras e de continuidade</p>
                  </div>
                  <IconAlert className={`h-5 w-5 ${pendencias.length ? 'text-amber' : 'text-mint'}`} />
                </div>
                <div className="mt-3 space-y-2">
                  {pendencias.length === 0 && <div className="rounded-xl border border-mint/15 bg-mint/[0.05] px-3.5 py-3 text-[12px] text-mint">Tudo em dia. Nenhuma ação crítica aberta.</div>}
                  {pendencias.slice(0, 2).map((p, i) => (
                    <Link key={i} to={p.to} className="group flex items-center gap-3 rounded-xl border border-line/60 bg-panel/50 px-3.5 py-3 transition-colors hover:border-line2 hover:bg-raise/40">
                      <span>{p.icon}</span><span className="min-w-0 flex-1 truncate text-[12.5px]">{p.txt}</span><IconChevronR className="h-3.5 w-3.5 shrink-0 text-fog/50 group-hover:text-mint" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal delay={70}>
        <DashboardMetricGrid items={[
          { label: 'Produção do mês', value: <>R$ <CountUp to={Math.round(k.producao / 100)} /></>, tone: 'text-mint', sub: `${k.realizadas} atendimentos finalizados${unidade ? ' · unidade selecionada' : ''}`, to: '/relatorios' },
          { label: 'A receber', value: <>R$ <CountUp to={Math.round(k.aReceber / 100)} /></>, tone: 'text-amber', sub: 'consolidado financeiro da clínica', to: '/financeiro' },
          { label: 'Comparecimento', value: <CountUp to={k.comparecimento} suffix="%" />, tone: k.comparecimento >= 85 ? 'text-mint' : 'text-pulse', sub: `${k.faltas} falta(s) registradas${unidade ? ' · unidade selecionada' : ''}`, to: '/agenda' },
          { label: 'Novos pacientes', value: <CountUp to={k.novos} />, tone: 'text-aqua', sub: 'entradas registradas no mês corrente', to: '/pacientes' },
          { label: 'NPS médio', value: k.nps.toLocaleString('pt-BR'), sub: 'experiência percebida · nota de 0 a 10', to: '/relatorios' },
        ]} />
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-3">
        <Reveal delay={95}><RevenueRecovery /></Reveal>
        <Reveal delay={105}><RecoveryImpactCard /></Reveal>
        <Reveal delay={110}><OperationalHealthCard /></Reveal>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {financeAllowed && <Reveal delay={120}>
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHead title="Fluxo de recebimentos" sub="últimos 7 dias · pela data efetiva da baixa" right={<Chip className="border-mint/25 bg-mint/[0.04] text-mint">Financeiro vivo</Chip>} />
            <div className="p-5 sm:p-6">
              <div className="flex h-44 items-end gap-2.5">
                {semana.map((s) => (
                  <div key={s.dIso} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="font-mono text-[10px] text-fog opacity-0 transition-opacity group-hover:opacity-100">{s.valor ? fmtBRL(s.valor) : '—'}</span>
                    <div className="relative w-full overflow-hidden rounded-t-lg bg-raise/60" style={{ height: `${Math.max((s.valor / maxSemana) * 100, 5)}%` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-mint/45 to-mint/85 transition-all group-hover:brightness-110" />
                    </div>
                    <span className="font-mono text-[10px] uppercase text-fog">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>}

        <Reveal delay={160}>
          <Card className="overflow-hidden">
            <CardHead title="Exigem ação" sub="prioridades que não deveriam virar amanhã" right={<IconAlert className="h-4.5 w-4.5 text-amber" />} />
            <ul className="divide-y divide-line/60">
              {pendencias.length === 0 && <li className="px-5 py-9 text-center text-[12px] text-fog">Tudo em dia. O operacional está limpo. 💚</li>}
              {pendencias.map((p, i) => (
                <li key={i}><Link to={p.to} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-raise/40"><span className="text-[15px]">{p.icon}</span><span className="flex-1 text-[12.5px] leading-snug">{p.txt}</span><IconChevronR className="h-3.5 w-3.5 shrink-0 text-fog/45 transition-colors group-hover:text-mint" /></Link></li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      {reportsAllowed && <Reveal delay={200}>
        <Card className="overflow-hidden">
          <CardHead title="Pulso da equipe" sub={`produção e presença · ${format(new Date(), 'MMMM/yyyy', { locale: ptBR })} · ${unidade ? unidade.nome : 'todas as unidades'}`} />
          <div className="space-y-4 p-5 sm:p-6">
            {prod.length === 0 && <p className="py-5 text-center text-[12px] text-fog">Nenhum profissional ativo com produção no período.</p>}
            {prod.map((p) => (
              <div key={p.professional.id} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-2xl border border-line/55 bg-deep/35 p-3.5 sm:grid-cols-[230px_1fr_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-[11px] font-bold text-on-accent shadow-sm" style={{ background: p.professional.cor }}>{p.professional.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <div className="min-w-0"><p className="truncate font-display text-[13.5px] font-semibold">{p.professional.nome}</p><p className="font-mono text-[10px] text-fog">{p.professional.registro}</p></div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="relative h-6 overflow-hidden rounded-lg bg-raise/70"><div className="bar-anim h-full rounded-lg" style={{ width: `${(p.valor / maxProd) * 100}%`, background: `${p.professional.cor}cc` }} /><span className="absolute inset-0 grid place-items-center font-mono text-[10px] text-paper/90">{p.atendimentos} atendimento{p.atendimentos !== 1 ? 's' : ''} · {fmtBRL(p.valor)}</span></div>
                </div>
                <div className="text-right"><Chip className={p.comp >= 85 ? 'border-mint/35 bg-mint/[0.04] text-mint' : 'border-amber/40 bg-amber/[0.04] text-amber'}>{p.comp}% pres.</Chip></div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>}

      <Reveal delay={240}>
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-5 py-4">
            <div className="mr-2">
              <p className="text-[12px] font-semibold text-paper">Ritmo de hoje</p>
              <p className="text-[11px] text-fog">situação da agenda em tempo real</p>
            </div>
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((s) => {
              const n = appointments.filter((a) => a.status === s && dayOf(a) === hoje && inUnit(a)).length;
              return <Chip key={s} className={`${STATUS_META[s].chip} bg-deep/35`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[s].dot }} />{STATUS_META[s].label}: {n}</Chip>;
            })}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={260}><div className="h-14 overflow-hidden rounded-2xl border-y border-line/40 opacity-55"><Ecg className="h-full w-full" /></div></Reveal>
    </div>
  );
}
