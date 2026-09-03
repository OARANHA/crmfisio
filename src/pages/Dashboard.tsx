import { useMemo } from 'react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useApp, useUnitFilter } from '../lib/store';
import { fmtBRL, STATUS_META, dayOf } from '../lib/types';
import { Card, CardHead, Chip, IconAlert, IconChevronR } from '../lib/ui';
import { Reveal, CountUp } from '../components/Reveal';
import { Ecg } from '../components/Ecg';
import { RevenueRecovery } from '../components/RevenueRecovery';
import { OperationalHealthCard } from '../components/dashboards/OperationalHealthCard';
import { RecoveryImpactCard } from '../components/dashboards/RecoveryImpactCard';
import { buildChurnRiskList } from '../lib/churnRisk';
import { DashboardMetricGrid, DashboardQuickActions } from '../components/dashboards/DashboardMetricGrid';

export function Dashboard() {
  const { user, appointments, transactions, patients, patientPackages, surveys, consents, users, unidadeSel, unidades } = useApp();
  const inUnit = useUnitFilter();

  const mes = format(new Date(), 'yyyy-MM');
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const unidade = unidades.find((u) => u.id === unidadeSel);

  const k = useMemo(() => {
    const prodMes = appointments.filter((a) => a.status === 'finalizado' && dayOf(a).startsWith(mes) && inUnit(a));
    const producao = prodMes.reduce((s, a) => s + a.valor, 0);
    const aReceber = transactions.filter((t) => t.tipo === 'receber' && t.status !== 'pago').reduce((s, t) => s + t.valor, 0);
    const faltas = appointments.filter((a) => a.status === 'faltou' && dayOf(a).startsWith(mes) && inUnit(a)).length;
    const realizadas = prodMes.length;
    const comparecimento = realizadas + faltas > 0 ? Math.round((realizadas / (realizadas + faltas)) * 100) : 100;
    const novos = patients.filter((p) => p.createdAt.startsWith(mes) && !p.anonimizado).length;
    const notas = surveys.filter((s) => s.nota !== null && s.data.startsWith(mes)).map((s) => s.nota as number);
    const nps = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : 0;
    return { producao, aReceber, comparecimento, novos, nps, realizadas, faltas };
  }, [appointments, transactions, patients, surveys, mes, inUnit]);

  const semana = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), i - 6), 'yyyy-MM-dd'));
    return days.map((dIso) => ({
      dIso,
      label: format(new Date(dIso + 'T12:00'), 'EEE', { locale: ptBR }).replace('.', ''),
      valor: transactions
        .filter((t) => t.tipo === 'receber' && t.status === 'pago' && t.paidAt?.startsWith(dIso))
        .reduce((s, t) => s + t.valor, 0),
    }));
  }, [transactions]);
  const maxSemana = Math.max(...semana.map((s) => s.valor), 1);

  const prod = useMemo(
    () =>
      users
        .filter((u) => u.role === 'fisio')
        .map((f) => {
          const fin = appointments.filter((a) => a.fisioId === f.id && a.status === 'finalizado' && dayOf(a).startsWith(mes) && inUnit(a));
          const falt = appointments.filter((a) => a.fisioId === f.id && a.status === 'faltou' && dayOf(a).startsWith(mes) && inUnit(a)).length;
          const valor = fin.reduce((s, a) => s + a.valor, 0);
          const comp = fin.length + falt > 0 ? Math.round((fin.length / (fin.length + falt)) * 100) : 100;
          return { f, sessoes: fin.length, valor, comp };
        }),
    [appointments, users, mes, inUnit]
  );
  const maxProd = Math.max(...prod.map((p) => p.valor), 1);
  const churnRisks = useMemo(
    () => buildChurnRiskList(patients, appointments, patientPackages, transactions).filter((risk) => risk.level !== 'baixo'),
    [patients, appointments, patientPackages, transactions],
  );

  const pendencias = [
    ...transactions.filter((t) => t.status === 'atrasado').map((t) => ({ icon: '💸', txt: `Cobrança atrasada: ${t.descricao} (${fmtBRL(t.valor)})`, to: '/financeiro' })),
    ...consents.filter((c) => !c.assinado).map((c) => ({ icon: '✍️', txt: `Termo pendente — ${patients.find((p) => p.id === c.pacienteId)?.nome ?? ''}`, to: `/pacientes/${c.pacienteId}` })),
    ...churnRisks.map((risk) => ({ icon: '⚠️', txt: `Risco ${risk.level}: ${risk.patientName} — ${risk.reasons[0] ?? 'continuidade comprometida'}`, to: '/crm' })),
  ].slice(0, 5);

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Olá, {user?.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ')[0]}
            </h1>
            <p className="text-fog text-[13px] mt-0.5">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · visão do gestor
            </p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            <Chip className={unidadeSel === 'all' ? 'border-line2 text-fog' : 'border-mint/40 text-mint'}>
              {unidade ? unidade.nome : 'Consolidado · todas as unidades'}
            </Chip>
            <DashboardQuickActions actions={[{ label: 'Abrir agenda', to: '/agenda', primary: true }, { label: 'Pacientes', to: '/pacientes' }, { label: 'Financeiro', to: '/financeiro' }]} />
          </div>
        </div>
      </Reveal>

      <Reveal delay={70}>
        <DashboardMetricGrid items={[
          { label: 'Produção do mês', value: <>R$ <CountUp to={Math.round(k.producao / 100)} /></>, tone: 'text-mint', sub: `${k.realizadas} sessões finalizadas${unidade ? ' · unidade selecionada' : ''}`, to: '/relatorios' },
          { label: 'A receber', value: <>R$ <CountUp to={Math.round(k.aReceber / 100)} /></>, tone: 'text-amber', sub: 'consolidado da clínica', to: '/financeiro' },
          { label: 'Comparecimento', value: <CountUp to={k.comparecimento} suffix="%" />, tone: k.comparecimento >= 85 ? 'text-mint' : 'text-pulse', sub: `${k.faltas} falta(s) registradas${unidade ? ' · unidade selecionada' : ''}`, to: '/agenda' },
          { label: 'Novos pacientes', value: <CountUp to={k.novos} />, tone: 'text-aqua', sub: 'consolidado da clínica · mês corrente', to: '/pacientes' },
          { label: 'NPS médio', value: k.nps.toLocaleString('pt-BR'), sub: `nota média de 0 a 10 · mês corrente`, to: '/relatorios' },
        ]} />
      </Reveal>

      <Reveal delay={95}>
        <RevenueRecovery />
      </Reveal>

      <Reveal delay={105}>
        <RecoveryImpactCard />
      </Reveal>

      <Reveal delay={110}>
        <OperationalHealthCard />
      </Reveal>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <Reveal delay={120}>
          <Card className="lg:col-span-2">
            <CardHead title="Recebimentos — últimos 7 dias" sub="data efetiva da baixa · consolidado da clínica" />
            <div className="p-5">
              <div className="flex items-end gap-2 h-40">
                {semana.map((s) => (
                  <div key={s.dIso} className="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end">
                    <span className="font-mono text-[9.5px] text-fog opacity-0 group-hover:opacity-100 transition-opacity">
                      {s.valor ? fmtBRL(s.valor) : '—'}
                    </span>
                    <div className="w-full bg-mint/70 group-hover:bg-mint transition-colors bar-anim" style={{ height: `${Math.max((s.valor / maxSemana) * 100, 3)}%` }} />
                    <span className="font-mono text-[10px] text-fog uppercase">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={160}>
          <Card>
            <CardHead title="Exigem ação" sub="prioridades de hoje" right={<IconAlert className="w-4.5 h-4.5 text-amber" />} />
            <ul className="divide-y divide-line/70">
              {pendencias.length === 0 && <li className="px-5 py-8 text-center font-mono text-[11.5px] text-fog">Tudo em dia. 💚</li>}
              {pendencias.map((p, i) => (
                <li key={i}>
                  <Link to={p.to} className="flex items-center gap-3 px-5 py-3 hover:bg-raise/50 transition-colors group">
                    <span className="text-[15px]">{p.icon}</span>
                    <span className="text-[12.5px] flex-1 leading-snug">{p.txt}</span>
                    <IconChevronR className="w-3.5 h-3.5 text-fog group-hover:text-mint transition-colors shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={200}>
        <Card>
          <CardHead title="Produtividade por fisioterapeuta" sub={`competência ${format(new Date(), 'MMMM/yyyy', { locale: ptBR })} · ${unidade ? unidade.nome : 'todas as unidades'}`} />
          <div className="p-5 space-y-4">
            {prod.length === 0 && <p className="font-mono text-[11px] text-fog py-5 text-center">Nenhum fisioterapeuta ativo com produção no período.</p>}
            {prod.map((p) => (
              <div key={p.f.id} className="grid grid-cols-[auto_1fr] sm:grid-cols-[220px_1fr_auto] items-center gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-full grid place-items-center font-display font-bold text-[11px] text-on-accent shrink-0" style={{ background: p.f.cor }}>
                    {p.f.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-[13.5px] truncate">{p.f.nome}</p>
                    <p className="font-mono text-[10px] text-fog">{p.f.registro}</p>
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="h-5 bg-deep border border-line relative overflow-hidden">
                    <div className="h-full bar-anim" style={{ width: `${(p.valor / maxProd) * 100}%`, background: `${p.f.cor}cc` }} />
                    <span className="absolute inset-0 grid place-items-center font-mono text-[10px] text-paper/90">{p.sessoes} sessão{p.sessoes !== 1 ? 'ões' : ''} · {fmtBRL(p.valor)}</span>
                  </div>
                </div>
                <div className="text-right"><Chip className={p.comp >= 85 ? 'border-mint/40 text-mint' : 'border-amber/45 text-amber'}>{p.comp}% pres.</Chip></div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={240}>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((s) => {
            const n = appointments.filter((a) => a.status === s && dayOf(a) === hoje && inUnit(a)).length;
            return <Chip key={s} className={STATUS_META[s].chip}><span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_META[s].dot }} />{STATUS_META[s].label}: {n} hoje</Chip>;
          })}
        </div>
      </Reveal>

      <Reveal delay={260}>
        <div className="h-16 overflow-hidden opacity-70 border-y border-line/50"><Ecg className="w-full h-full" /></div>
      </Reveal>
    </div>
  );
}
