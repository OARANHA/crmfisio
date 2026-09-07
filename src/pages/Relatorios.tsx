import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { userName } from '../lib/displayNames';
import { useToast } from '../lib/toastContext';
import { useAgenda } from '../lib/agendaContext';
import { useFinance } from '../lib/financeContext';
import { useClinicDirectory } from '../lib/clinicDirectoryContext';
import { useClinical } from '../lib/clinicalContext';
import { useInfrastructure, useUnitFilter } from '../lib/infrastructureContext';
import { calculateAttendanceRate, calculateNpsSummary } from '../lib/reportMetrics';
import { fmtBRL, dayOf } from '../lib/types';
import { Card, CardHead, Btn, Chip, Input, IconDownload, IconChart } from '../lib/ui';
import { Reveal, CountUp } from '../components/Reveal';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function Relatorios() {
  const { access } = useCurrentUserAccess();
  const { toast } = useToast();
  const { transactions } = useFinance();
  const { appointments } = useAgenda();
  const { users } = useClinicDirectory();
  const { surveys } = useClinical();
  const { unidadeSel, unidades } = useInfrastructure();
  const inUnit = useUnitFilter();
  const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM'));
  const canExport = access('relatorios') === 'full';
  const unidade = unidades.find((u) => u.id === unidadeSel);

  const dados = useMemo(() => {
    const noMes = appointments.filter((a) => dayOf(a).startsWith(mes) && inUnit(a));
    const fin = noMes.filter((a) => a.status === 'finalizado');
    const faltas = noMes.filter((a) => a.status === 'faltou');
    const producao = fin.reduce((s, a) => s + a.valor, 0);
    const comparecimento = calculateAttendanceRate(fin.length, faltas.length);

    const porProfissional = users
      .filter((u) => u.role === 'professional')
      .map((professional) => {
        const atendimentos = fin.filter((a) => a.fisioId === professional.id);
        const faltasProfissional = faltas.filter((a) => a.fisioId === professional.id).length;
        const valor = atendimentos.reduce((s, a) => s + a.valor, 0);
        return { professional, atendimentos: atendimentos.length, faltas: faltasProfissional, valor, ticket: atendimentos.length ? Math.round(valor / atendimentos.length) : 0 };
      });

    const sessoesPorDia = DIAS.map((_, i) => ({
      dia: DIAS[i],
      n: noMes.filter((a) => a.status !== 'cancelado' && new Date(dayOf(a) + 'T12:00').getDay() === i + 1).length,
    }));

    const porCategoria = new Map<string, number>();
    transactions
      .filter((t) => t.tipo === 'receber' && t.status === 'pago' && t.paidAt?.startsWith(mes))
      .forEach((t) => porCategoria.set(t.categoria, (porCategoria.get(t.categoria) ?? 0) + t.valor));

    const notas = surveys.filter((s) => s.nota !== null && s.data.startsWith(mes)).map((s) => s.nota as number);
    const nps = calculateNpsSummary(notas);

    return {
      fin,
      faltas,
      producao,
      comparecimento,
      porProfissional,
      sessoesPorDia,
      porCategoria: [...porCategoria.entries()],
      nps,
      ticketGeral: fin.length ? Math.round(producao / fin.length) : 0,
    };
  }, [appointments, transactions, surveys, users, mes, inUnit]);

  const maxProfissional = Math.max(...dados.porProfissional.map((p) => p.valor), 1);
  const maxDia = Math.max(...dados.sessoesPorDia.map((o) => o.n), 1);
  const maxCat = Math.max(...dados.porCategoria.map(([, v]) => v), 1);

  const exportCsv = () => {
    const brl = (v: number) => (v / 100).toFixed(2).replace('.', ',');
    const linhas = [
      'Profissional;Registro;Atendimentos finalizados;Faltas;Produção (R$);Ticket médio (R$)',
      ...dados.porProfissional.map((p) => `${p.professional.nome};${p.professional.registro};${p.atendimentos};${p.faltas};${brl(p.valor)};${brl(p.ticket)}`),
    ];
    const blob = new Blob(['\ufeff' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `producao-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Relatório CSV exportado (compatível com Excel pt-BR)');
  };

  const attendanceTone = dados.comparecimento === null
    ? 'text-fog'
    : dados.comparecimento >= 85 ? 'text-mint' : 'text-pulse';
  const npsTone = dados.nps.score === null
    ? 'text-fog'
    : dados.nps.score >= 50 ? 'text-mint'
      : dados.nps.score >= 0 ? 'text-amber'
        : 'text-pulse';

  const metrics = [
    {
      label: 'Produção do mês',
      value: <><span>R$ </span><CountUp to={Math.round(dados.producao / 100)} /></>,
      tone: 'text-mint',
      sub: `${dados.fin.length} atendimentos finalizados`,
    },
    {
      label: 'Ticket médio',
      value: <><span>R$ </span><CountUp to={Math.round(dados.ticketGeral / 100)} /></>,
      tone: 'text-aqua',
      sub: 'valor nominal por atendimento finalizado',
    },
    {
      label: 'Comparecimento',
      value: dados.comparecimento === null ? '—' : <CountUp to={dados.comparecimento} suffix="%" />,
      tone: attendanceTone,
      sub: dados.comparecimento === null
        ? 'sem atendimentos finalizados ou faltas na competência'
        : `${dados.fin.length + dados.faltas.length} atendimento(s) na amostra · ${dados.faltas.length} falta(s)`,
    },
    {
      label: 'NPS',
      value: dados.nps.score === null ? '—' : dados.nps.score.toLocaleString('pt-BR'),
      tone: npsTone,
      sub: dados.nps.responses === 0
        ? 'sem respostas válidas na competência'
        : `${dados.nps.responses} resposta(s) · média ${dados.nps.average?.toLocaleString('pt-BR')}/10`,
    },
  ];

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Relatórios de produção</h1>
            <p className="text-fog text-[13px] mt-0.5">
              {unidade ? unidade.nome : 'Consolidado · todas as unidades'} · competência {format(new Date(mes + '-01T12:00'), 'MMMM/yyyy', { locale: ptBR })}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="!w-44" />
            <Btn onClick={exportCsv} disabled={!canExport} title={!canExport ? 'Exportação restrita ao administrador (RBAC)' : undefined}>
              <IconDownload className="w-4 h-4" /> Exportar CSV
            </Btn>
          </div>
        </div>
      </Reveal>

      <Reveal delay={70}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {metrics.map((metric) => (
            <div key={metric.label} className="bg-panel px-5 py-4 hover:bg-raise/60 transition-colors">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog">{metric.label}</p>
              <p className={`font-display text-[26px] font-bold leading-tight mt-1 ${metric.tone}`}>{metric.value}</p>
              <p className="font-mono text-[10.5px] text-fog/80 mt-0.5">{metric.sub}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-4 items-start">
        <Reveal delay={120}>
          <Card className="overflow-x-auto">
            <CardHead title="Produção por profissional" sub="atendimentos finalizados na competência" right={<IconChart className="w-4.5 h-4.5 text-mint" />} />
            <div className="p-5 space-y-4">
              {dados.porProfissional.map((p) => (
                <div key={p.professional.id} className="grid grid-cols-[auto_1fr] sm:grid-cols-[220px_1fr_120px] items-center gap-x-4 gap-y-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-full grid place-items-center font-display font-bold text-[11px] text-on-accent shrink-0" style={{ background: p.professional.cor }}>
                      {p.professional.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-[13.5px] truncate">{userName(users, p.professional.id)}</p>
                      <p className="font-mono text-[10px] text-fog">{p.atendimentos} atendimentos · {p.faltas} falta(s)</p>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 order-3 sm:order-none">
                    <div className="h-5 bg-deep border border-line overflow-hidden">
                      <div className="h-full bar-anim" style={{ width: `${(p.valor / maxProfissional) * 100}%`, background: `${p.professional.cor}cc` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[13px] text-mint font-semibold">{fmtBRL(p.valor)}</p>
                    <p className="font-mono text-[10px] text-fog">ticket {fmtBRL(p.ticket)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={160}>
            <Card>
              <CardHead title="Atendimentos por dia da semana" sub="volume de atendimentos não cancelados na competência — não representa taxa de ocupação" />
              <div className="p-5">
                <div className="flex items-end gap-2.5 h-32">
                  {dados.sessoesPorDia.map((o) => (
                    <div key={o.dia} className="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end">
                      <span className="font-mono text-[10px] text-fog group-hover:text-aqua transition-colors">{o.n}</span>
                      <div className="w-full bg-aqua/70 group-hover:bg-aqua transition-colors bar-anim" style={{ height: `${Math.max((o.n / maxDia) * 100, 4)}%` }} />
                      <span className="font-mono text-[10px] text-fog uppercase">{o.dia}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={200}>
            <Card>
              <CardHead title="Recebimentos por categoria" sub={`data efetiva da baixa · consolidado da clínica${unidade ? ' (não filtrado por unidade)' : ''}`} />
              <div className="p-5 space-y-3">
                {dados.porCategoria.length === 0 && <p className="font-mono text-[11.5px] text-fog">Sem recebimentos baixados neste mês.</p>}
                {dados.porCategoria.map(([cat, v]) => (
                  <div key={cat}>
                    <div className="flex justify-between font-mono text-[11px] text-fog mb-1">
                      <span>{cat}</span><span className="text-mint">{fmtBRL(v)}</span>
                    </div>
                    <div className="h-2 bg-deep border border-line overflow-hidden">
                      <div className="h-full bg-mint/80 bar-anim" style={{ width: `${(v / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      <Reveal delay={240}>
        <Chip className="border-line2 text-fog">
          {canExport ? 'CSV usa ";" como separador (padrão Excel pt-BR) · produção usa valor nominal do atendimento · recebimentos usam data efetiva da baixa' : 'perfil sem permissão de exportação: visualização liberada, download restrito ao admin'}
        </Chip>
      </Reveal>
    </div>
  );
}
