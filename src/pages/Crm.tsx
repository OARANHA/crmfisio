import { useMemo, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/store';
import { STAGE_META, type FunilStage, type Patient } from '../lib/types';
import { Card, CardHead, Btn, Chip, IconStar, IconPhone, IconAlert } from '../lib/ui';
import { IconWhats, IconSend, IconArrow } from '../components/icons';
import { Reveal, CountUp } from '../components/Reveal';

const STAGES: FunilStage[] = ['lead', 'avaliacao', 'tratamento', 'alta'];

export function Crm() {
  const { patients, appointments, setFunilStage, surveys, toast, enviarLembretes, enviarNps, reativarInativos } = useApp();
  const [dragId, setDragId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map = new Map<FunilStage, Patient[]>();
    STAGES.forEach((s) => map.set(s, []));
    patients.filter((p) => !p.anonimizado).forEach((p) => map.get(p.funilStage)?.push(p));
    return map;
  }, [patients]);

  const nps = useMemo(() => {
    const notas = surveys.filter((s) => s.nota !== null).map((s) => s.nota as number);
    const prom = notas.filter((n) => n >= 9).length;
    const neut = notas.filter((n) => n === 7 || n === 8).length;
    const det = notas.filter((n) => n <= 6).length;
    const score = notas.length ? Math.round(((prom - det) / notas.length) * 100) : 0;
    return { prom, neut, det, score, total: notas.length };
  }, [surveys]);

  const inativos = patients.filter((p) => p.status === 'inativo' && !p.anonimizado);

  const confirmarPendentes = () => {
    const n = enviarLembretes();
    toast(n ? `${n} confirmação(ões) enfileiradas no WhatsApp` : 'Nenhuma confirmação pendente', n ? 'ok' : 'info');
  };
  const dispararNps = () => {
    const n = enviarNps();
    toast(n ? `${n} pesquisa(s) NPS disparada(s)` : 'Nenhuma pesquisa pendente', n ? 'ok' : 'info');
  };

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">CRM · Jornada do Paciente</h1>
            <p className="text-fog text-[13px] mt-0.5">funil de captação, retenção e satisfação</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn variant="subtle" onClick={confirmarPendentes}><IconWhats className="w-4 h-4" /> Confirmar sessões</Btn>
            <Btn variant="subtle" onClick={dispararNps}><IconSend className="w-4 h-4" /> Disparar NPS</Btn>
          </div>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {STAGES.map((s) => {
            const meta = STAGE_META[s];
            const list = byStage.get(s) ?? [];
            return (
              <div
                key={s}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) {
                    setFunilStage(dragId, s);
                    toast(`Paciente movido para "${meta.label}"`);
                    setDragId(null);
                  }
                }}
                className="border border-line bg-deep/60"
              >
                <div className="px-4 py-3 border-b border-line flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: meta.bar }} />
                  <span className="font-display font-semibold text-[13.5px]">{meta.label}</span>
                  <span className="ml-auto font-mono text-[11px] text-fog">{list.length}</span>
                </div>
                <div className="h-1" style={{ background: meta.bar, opacity: 0.7 }} />
                <div className="p-2.5 space-y-2 min-h-[120px]">
                  {list.length === 0 && <p className="font-mono text-[10.5px] text-fog/60 text-center py-6">vazio</p>}
                  {list.map((p) => {
                    const nota = surveys.find((x) => x.pacienteId === p.id)?.nota;
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => setDragId(p.id)}
                        className="node-card border border-line bg-panel px-3 py-2.5 cursor-grab active:cursor-grabbing hover:border-line2"
                      >
                        <Link to={`/pacientes/${p.id}`} className="block font-display font-semibold text-[13px] hover:text-mint transition-colors truncate">{p.nome}</Link>
                        <p className="text-[11px] text-fog truncate mt-0.5">{p.queixaPrincipal}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {p.optInWhats ? <IconWhats className="w-3.5 h-3.5 text-mint" /> : <IconPhone className="w-3.5 h-3.5 text-fog/60" />}
                          <span className="font-mono text-[10px] text-fog truncate">{p.telefone}</span>
                          {nota !== undefined && (
                            <span className="ml-auto flex items-center gap-1 font-mono text-[10.5px] text-amber">
                              <IconStar className="w-3 h-3" filled />{nota}
                            </span>
                          )}
                        </div>
                        {STAGE_META[p.funilStage].next && (
                          <button
                            onClick={() => {
                              const next = STAGE_META[p.funilStage].next!;
                              setFunilStage(p.id, next);
                              toast(`${p.nome} avançou para "${STAGE_META[next].label}"`);
                            }}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 border border-line px-2 py-1 font-mono text-[10px] text-fog hover:text-mint hover:border-mint/40 transition-colors"
                          >
                            avançar <IconArrow className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="font-mono text-[10.5px] text-fog/70 mt-2">arraste os cards entre colunas ou use "avançar" · mudanças refletem no prontuário</p>
      </Reveal>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Reveal delay={140}>
          <Card>
            <CardHead
              title="Pesquisa de satisfação (NPS)"
              sub={`${nps.total} resposta(s) · disparo automático pós-atendimento`}
              right={
                <span className={`font-display text-2xl font-bold ${nps.score >= 50 ? 'text-mint' : nps.score >= 0 ? 'text-amber' : 'text-pulse'}`}>
                  {nps.score}
                </span>
              }
            />
            <div className="p-5 space-y-3.5">
              {[
                { l: 'Promotores (9–10)', n: nps.prom, c: '#4fd1a5' },
                { l: 'Neutros (7–8)', n: nps.neut, c: '#f2b441' },
                { l: 'Detratores (0–6)', n: nps.det, c: '#f2545b' },
              ].map((x) => (
                <div key={x.l}>
                  <div className="flex justify-between font-mono text-[11px] text-fog mb-1">
                    <span>{x.l}</span><span>{x.n}</span>
                  </div>
                  <div className="h-2 bg-deep border border-line overflow-hidden">
                    <div className="h-full bar-anim" style={{ width: `${nps.total ? (x.n / nps.total) * 100 : 0}%`, background: x.c }} />
                  </div>
                </div>
              ))}
              <p className="font-mono text-[10.5px] text-fog/70 pt-1 border-t border-line">
                NPS = % promotores − % detratores · faixa {nps.score >= 75 ? 'excelência' : nps.score >= 50 ? 'qualidade' : nps.score >= 0 ? 'aperfeiçoamento' : 'crítica'}
              </p>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={180}>
          <Card>
            <CardHead
              title="Alerta de pacientes inativos"
              sub="abandono de tratamento · reativação via WhatsApp"
              right={inativos.length > 0 ? <IconAlert className="w-4.5 h-4.5 text-pulse" /> : undefined}
            />
            <ul className="divide-y divide-line/70">
              {inativos.length === 0 && <li className="px-5 py-8 text-center font-mono text-[11.5px] text-fog">Nenhum paciente inativo. 💚</li>}
              {inativos.map((p) => {
                const dias = p.ultimaVisita ? differenceInDays(new Date(), new Date(p.ultimaVisita + 'T12:00')) : null;
                return (
                  <li key={p.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/pacientes/${p.id}`} className="font-display font-semibold text-[13.5px] hover:text-mint transition-colors">{p.nome}</Link>
                      <p className="font-mono text-[10.5px] text-fog mt-0.5">
                        {dias !== null ? `${dias} dias sem vir` : 'nunca compareceu'} · última visita {p.ultimaVisita ? format(new Date(p.ultimaVisita + 'T12:00'), 'dd/MM/yy', { locale: ptBR }) : '—'}
                      </p>
                    </div>
                    <Btn variant="subtle" className="!px-3 !py-1.5 !text-[11.5px]" onClick={() => { reativarInativos(); toast(`Mensagem de reativação enviada para ${p.nome}`); }}>
                      <IconWhats className="w-3.5 h-3.5" /> Reativar
                    </Btn>
                  </li>
                );
              })}
            </ul>
            {inativos.length > 0 && (
              <div className="px-5 py-3 border-t border-line flex items-center justify-between">
                <span className="font-mono text-[10.5px] text-fog">{inativos.length} paciente(s) em risco de perda</span>
                <Btn variant="ghost" className="!px-3 !py-1.5 !text-[11.5px]" onClick={() => { const n = reativarInativos(); toast(`${n} mensagem(ns) de reativação disparada(s)`); }}>
                  Campanha para todos
                </Btn>
              </div>
            )}
          </Card>
        </Reveal>
      </div>

      <Reveal delay={220}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {[
            { v: appointments.filter((a) => a.status === 'confirmado').length, l: 'sessões confirmadas' },
            { v: patients.filter((p) => p.optInWhats && !p.anonimizado).length, l: 'opt-ins WhatsApp' },
            { v: nps.total, l: 'respostas NPS' },
            { v: byStage.get('lead')?.length ?? 0, l: 'leads no funil' },
          ].map((x) => (
            <div key={x.l} className="bg-panel px-5 py-4 hover:bg-raise/60 transition-colors">
              <CountUp to={x.v} className="font-display text-3xl font-bold text-mint" />
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog mt-1">{x.l}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
