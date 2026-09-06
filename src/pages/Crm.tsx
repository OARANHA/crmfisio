import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { useClinical } from '../lib/clinicalContext';
import { usePackages } from '../lib/packageContext';
import { STAGE_META, type FunilStage, type Patient } from '../lib/types';
import { Card, CardHead, Btn, Chip, IconStar, IconPhone, IconAlert } from '../lib/ui';
import { IconWhats, IconSend, IconArrow } from '../components/icons';
import { Reveal, CountUp } from '../components/Reveal';
import { buildChurnRiskList } from '../lib/churnRisk';

const STAGES: FunilStage[] = ['lead', 'avaliacao', 'tratamento', 'alta'];

export function Crm() {
  const { patients, appointments, transactions, setFunilStage, toast } = useApp();
  const { surveys } = useClinical();
  const { patientPackages } = usePackages();
  const navigate = useNavigate();
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

  const latestNpsByPatient = useMemo(() => {
    const latest = new Map<string, number | null>();
    [...surveys]
      .sort((a, b) => b.data.localeCompare(a.data))
      .forEach((survey) => {
        if (!latest.has(survey.pacienteId)) latest.set(survey.pacienteId, survey.nota);
      });
    return latest;
  }, [surveys]);

  const churnRisks = useMemo(
    () => buildChurnRiskList(patients, appointments, patientPackages, transactions)
      .filter((risk) => risk.level !== 'baixo'),
    [patients, appointments, patientPackages, transactions],
  );

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">CRM · Jornada do Paciente</h1>
            <p className="text-fog text-[13px] mt-0.5">funil de captação, retenção e satisfação</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn variant="subtle" onClick={() => navigate('/mensagens')}><IconWhats className="w-4 h-4" /> Selecionar confirmações</Btn>
            <Btn variant="subtle" onClick={() => navigate('/mensagens')}><IconSend className="w-4 h-4" /> Selecionar NPS</Btn>
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
                    const nota = latestNpsByPatient.get(p.id);
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
                          {nota !== undefined && nota !== null && (
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
              sub={`${nps.total} resposta(s) registrada(s) pós-atendimento`}
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
              title="Risco de abandono"
              sub="classificação automática por continuidade, faltas, pacote e financeiro"
              right={churnRisks.length > 0 ? <IconAlert className="w-4.5 h-4.5 text-pulse" /> : undefined}
            />
            <ul className="divide-y divide-line/70">
              {churnRisks.length === 0 && <li className="px-5 py-8 text-center font-mono text-[11.5px] text-fog">Nenhum tratamento com risco médio ou alto. 💚</li>}
              {churnRisks.map((risk) => {
                const p = patients.find((patient) => patient.id === risk.patientId);
                if (!p) return null;
                return (
                  <li key={p.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/pacientes/${p.id}`} className="font-display font-semibold text-[13.5px] hover:text-mint transition-colors">{p.nome}</Link>
                      <p className="font-mono text-[10.5px] text-fog mt-0.5">
                        risco {risk.level} · {risk.score} pontos · {risk.reasons.join(' · ')}
                      </p>
                    </div>
                    <Btn variant="subtle" className="!px-3 !py-1.5 !text-[11.5px]" onClick={() => navigate('/mensagens')}>
                      <IconWhats className="w-3.5 h-3.5" /> Ver reativação
                    </Btn>
                  </li>
                );
              })}
            </ul>
            {churnRisks.length > 0 && (
              <div className="px-5 py-3 border-t border-line flex items-center justify-between">
                <span className="font-mono text-[10.5px] text-fog">{churnRisks.length} tratamento(s) exigem atenção</span>
                <Btn variant="ghost" className="!px-3 !py-1.5 !text-[11.5px]" onClick={() => navigate('/mensagens')}>
                  Selecionar campanha
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
