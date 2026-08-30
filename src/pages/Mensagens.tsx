import { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import { dayOf, type WaLog, type WaStatus } from '../lib/types';
import { Card, CardHead, Btn, Chip, Textarea, IconAlert } from '../lib/ui';
import { IconWhats, IconSend, IconCheck, IconEye } from '../components/icons';
import { Reveal, CountUp } from '../components/Reveal';

const WA_STATUS_META: Record<WaStatus, { label: string; chip: string; dot: string }> = {
  enviando: { label: 'enviando…', chip: 'border-amber/45 text-amber', dot: '#f2b441' },
  enviado: { label: 'enviado', chip: 'border-steel/40 text-steel', dot: '#9ab8c9' },
  entregue: { label: 'entregue ✓', chip: 'border-aqua/40 text-aqua', dot: '#6ec1e4' },
  lido: { label: 'lido ✓✓', chip: 'border-mint/40 text-mint', dot: '#4fd1a5' },
};

const TPL_LABEL: Record<WaLog['template'], string> = {
  confirmacao: 'Confirmação de sessão',
  nps: 'Pesquisa NPS',
  reativacao: 'Reativação de inativo',
};

export function Mensagens() {
  const { patients, appointments, surveys, waLogs, access, enviarLembretes, enviarNps, reativarInativos, toast } = useApp();
  const canSend = access('mensagens') === 'full';

  const [tpls, setTpls] = useState({
    confirmacao: 'Olá, {nome}! Tudo bem? Sua sessão de {tipo} está marcada para {data} às {hora}. Responda *SIM* para confirmar. 💚',
    nps: 'Olá, {nome}! Como você avalia seu atendimento recente? Responda de 0 a 10 — sua opinião direciona nosso cuidado. 🩺',
    reativacao: 'Olá, {nome}! Sentimos sua falta no Coração. Que tal retomar seu tratamento? Temos horários disponíveis esta semana. 💚',
  });

  const counts = useMemo(() => {
    const hoje = format(new Date(), 'yyyy-MM-dd');
    const limite = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    const lembretes = appointments.filter(
      (a) =>
        (a.status === 'agendado' || a.status === 'confirmado') &&
        dayOf(a) >= hoje && dayOf(a) <= limite &&
        patients.find((p) => p.id === a.pacienteId)?.optInWhats
    ).length;

    const corte = format(addDays(new Date(), -7), 'yyyy-MM-dd');
    const recentes = appointments.filter((a) => a.status === 'finalizado' && dayOf(a) >= corte && dayOf(a) <= hoje);
    const vistos = new Set<string>();
    let pendNps = 0;
    recentes.forEach((a) => {
      if (vistos.has(a.pacienteId)) return;
      vistos.add(a.pacienteId);
      const p = patients.find((x) => x.id === a.pacienteId);
      if (p?.optInWhats && !surveys.some((s) => s.pacienteId === p.id && s.nota === null)) pendNps++;
    });

    const pendInativos = patients.filter((p) => p.status === 'inativo' && p.optInWhats && !p.anonimizado).length;
    return { lembretes, nps: pendNps, inativos: pendInativos };
  }, [appointments, patients, surveys]);

  const enviandoAgora = waLogs.filter((w) => w.status === 'enviando').length;
  const entregues = waLogs.filter((w) => w.status === 'entregue' || w.status === 'lido').length;
  const taxaEntrega = waLogs.length ? Math.round((entregues / waLogs.length) * 100) : 0;
  const lidas = waLogs.filter((w) => w.status === 'lido').length;
  const taxaLeitura = waLogs.length ? Math.round((lidas / waLogs.length) * 100) : 0;

  const automations = [
    {
      icon: <IconWhats className="w-4.5 h-4.5" />,
      title: 'Confirmação de sessões (próximas 48h)',
      desc: 'Dispara o modelo de confirmação para sessões agendadas/confirmadas nos próximos 2 dias.',
      count: counts.lembretes,
      run: () => {
        const n = enviarLembretes();
        toast(n ? `${n} confirmaç${n > 1 ? 'ões' : 'ão'} enfileirada${n > 1 ? 's' : ''} no WhatsApp` : 'Nenhuma confirmação pendente na janela', n ? 'ok' : 'info');
      },
    },
    {
      icon: <IconSend className="w-4.5 h-4.5" />,
      title: 'Pesquisa NPS pós-atendimento',
      desc: 'Para sessões finalizadas nos últimos 7 dias que ainda não receberam pesquisa.',
      count: counts.nps,
      run: () => {
        const n = enviarNps();
        toast(n ? `${n} pesquisa${n > 1 ? 's' : ''} NPS disparada${n > 1 ? 's' : ''}` : 'Nenhuma pesquisa NPS pendente', n ? 'ok' : 'info');
      },
    },
    {
      icon: <IconAlert className="w-4.5 h-4.5" />,
      title: 'Reativação de pacientes inativos',
      desc: 'Mensagem de retorno para quem abandonou o tratamento (alerta do CRM).',
      count: counts.inativos,
      run: () => {
        const n = reativarInativos();
        toast(n ? `${n} mensagem${n > 1 ? 's' : ''} de reativação disparada${n > 1 ? 's' : ''}` : 'Nenhum paciente inativo elegível', n ? 'ok' : 'info');
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Mensagens</h1>
            <p className="text-fog text-[13px] mt-0.5">
              automação WhatsApp · Evolution API (produção) · disparos respeitam opt-in e janela 08h–20h (LGPD)
            </p>
          </div>
          {enviandoAgora > 0 && (
            <Chip className="border-amber/50 text-amber ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-amber dot-live" />
              {enviandoAgora} em envio
            </Chip>
          )}
        </div>
      </Reveal>

      <Reveal delay={70}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {[
            { v: waLogs.length, s: '', l: 'disparos no período', c: 'text-paper' },
            { v: taxaEntrega, s: '%', l: 'taxa de entrega', c: 'text-aqua' },
            { v: taxaLeitura, s: '%', l: 'taxa de leitura', c: 'text-mint' },
            { v: enviandoAgora, s: '', l: 'na fila agora', c: 'text-amber' },
          ].map((k) => (
            <div key={k.l} className="bg-panel px-5 py-4 hover:bg-raise/60 transition-colors">
              <CountUp to={k.v} suffix={k.s} className={`font-display text-3xl font-bold ${k.c}`} />
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog mt-1">{k.l}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 items-start">
        <div className="space-y-4">
          <Reveal delay={120}>
            <Card>
              <CardHead title="Gatilhos de automação" sub={canSend ? 'um clique enfileira os disparos' : 'seu perfil é somente leitura (RBAC)'} />
              <ul className="divide-y divide-line/70">
                {automations.map((a) => (
                  <li key={a.title} className="px-5 py-4">
                    <div className="flex items-start gap-3.5">
                      <span className={`w-9 h-9 grid place-items-center border shrink-0 ${a.count > 0 ? 'border-mint/40 text-mint bg-mint/5' : 'border-line text-fog/60'}`}>
                        {a.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-[14px] leading-tight">{a.title}</p>
                        <p className="text-[12px] text-fog mt-1 leading-relaxed">{a.desc}</p>
                        <p className={`font-mono text-[10.5px] mt-1.5 ${a.count > 0 ? 'text-amber' : 'text-fog/60'}`}>
                          {a.count > 0 ? `▸ ${a.count === 1 ? '1 pendência' : `${a.count} pendências`}` : '— nada pendente agora'}
                        </p>
                      </div>
                      <Btn
                        className="!px-3 !py-1.5 !text-[12px] shrink-0"
                        disabled={!canSend || a.count === 0}
                        onClick={a.run}
                        title={!canSend ? 'Sem permissão para disparar' : undefined}
                      >
                        <IconWhats className="w-3.5 h-3.5" /> Disparar
                      </Btn>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>

          <Reveal delay={180}>
            <Card>
              <CardHead
                title="Modelos de mensagem"
                sub="variáveis: {nome} {tipo} {data} {hora}"
                right={
                  <Btn variant="subtle" className="!px-3 !py-1.5 !text-[12px]" onClick={() => toast('Modelos atualizados — valem para os próximos disparos')}>
                    <IconCheck className="w-3.5 h-3.5" /> Salvar
                  </Btn>
                }
              />
              <div className="p-5 space-y-4">
                {(Object.keys(tpls) as (keyof typeof tpls)[]).map((k) => (
                  <div key={k}>
                    <p className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-fog mb-1.5 flex items-center gap-2">
                      <IconEye className="w-3.5 h-3.5 text-mint" /> {TPL_LABEL[k]}
                    </p>
                    <Textarea
                      value={tpls[k]}
                      onChange={(e) => setTpls((t) => ({ ...t, [k]: e.target.value }))}
                      className="!min-h-[72px] !text-[12.5px]"
                    />
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={140}>
          <Card>
            <CardHead
              title="Atividade recente"
              sub="fila de disparos com status em tempo real"
              right={
                <div className="hidden md:flex items-center gap-3">
                  {(['enviando', 'enviado', 'entregue', 'lido'] as WaStatus[]).map((s) => (
                    <span key={s} className="flex items-center gap-1.5 font-mono text-[10px] text-fog">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: WA_STATUS_META[s].dot }} />
                      {WA_STATUS_META[s].label.replace('…', '')}
                    </span>
                  ))}
                </div>
              }
            />
            <ul className="divide-y divide-line/70 max-h-[720px] overflow-y-auto">
              {waLogs.length === 0 && (
                <li className="px-5 py-10 text-center font-mono text-[11.5px] text-fog">Nenhum disparo registrado ainda.</li>
              )}
              {waLogs.map((w) => {
                const p = patients.find((x) => x.id === w.pacienteId);
                const sm = WA_STATUS_META[w.status];
                return (
                  <li key={w.id} className="px-5 py-3.5 flex items-start gap-3.5 hover:bg-raise/40 transition-colors">
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${w.status === 'enviando' ? 'dot-live' : ''}`}
                      style={{ background: sm.dot }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="font-display font-semibold text-[13px]">{p?.nome ?? 'Paciente'}</span>
                        <span className="font-mono text-[10px] text-fog uppercase tracking-wide">{TPL_LABEL[w.template]}</span>
                        <span className="font-mono text-[10px] text-fog/70 ml-auto tabular-nums">
                          {format(new Date(w.enviadoEm), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-[12px] text-paper/80 leading-relaxed mt-1 line-clamp-2">{w.mensagem}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Chip className={sm.chip}>{sm.label}</Chip>
                        {p && !p.optInWhats && <Chip className="border-pulse/40 text-pulse">sem opt-in</Chip>}
                        <span className="font-mono text-[10px] text-fog/70">{p?.telefone}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
