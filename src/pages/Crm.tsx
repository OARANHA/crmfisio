import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAgenda } from '../lib/agendaContext';
import { useFinance } from '../lib/financeContext';
import { usePatients } from '../lib/patientContext';
import { useClinical } from '../lib/clinicalContext';
import { usePackages } from '../lib/packageContext';
import { Card, CardHead, Btn, IconAlert } from '../lib/ui';
import { IconWhats, IconSend } from '../components/icons';
import { CommercialCrmBoard } from '../components/CommercialCrmBoard';
import { Reveal, CountUp } from '../components/Reveal';
import { buildChurnRiskList } from '../lib/churnRisk';

export function Crm() {
  const { transactions } = useFinance();
  const { patients } = usePatients();
  const { appointments } = useAgenda();
  const { surveys } = useClinical();
  const { patientPackages } = usePackages();
  const navigate = useNavigate();

  const nps = useMemo(() => {
    const notas = surveys.filter((survey) => survey.nota !== null).map((survey) => survey.nota as number);
    const prom = notas.filter((nota) => nota >= 9).length;
    const neut = notas.filter((nota) => nota === 7 || nota === 8).length;
    const det = notas.filter((nota) => nota <= 6).length;
    const score = notas.length ? Math.round(((prom - det) / notas.length) * 100) : 0;
    return { prom, neut, det, score, total: notas.length };
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
            <h1 className="medicspro-page-title">CRM</h1>
            <p className="medicspro-page-subtitle">pipeline comercial e relacionamento com pacientes em domínios separados</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn variant="subtle" onClick={() => navigate('/mensagens')}><IconWhats className="w-4 h-4" /> Selecionar confirmações</Btn>
            <Btn variant="subtle" onClick={() => navigate('/mensagens')}><IconSend className="w-4 h-4" /> Selecionar NPS</Btn>
          </div>
        </div>
      </Reveal>

      <Reveal delay={70}>
        <CommercialCrmBoard />
      </Reveal>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Reveal delay={140}>
          <Card>
            <CardHead
              title="Pesquisa de satisfação (NPS)"
              sub={nps.total + ' resposta(s) registrada(s) pós-atendimento'}
              right={
                <span className={'font-display text-2xl font-bold ' + (nps.score >= 50 ? 'text-mint' : nps.score >= 0 ? 'text-amber' : 'text-pulse')}>
                  {nps.score}
                </span>
              }
            />
            <div className="p-5 space-y-3.5">
              {[
                { l: 'Promotores (9–10)', n: nps.prom, c: '#4fd1a5' },
                { l: 'Neutros (7–8)', n: nps.neut, c: '#f2b441' },
                { l: 'Detratores (0–6)', n: nps.det, c: '#f2545b' },
              ].map((item) => (
                <div key={item.l}>
                  <div className="flex justify-between font-mono text-[11px] text-fog mb-1">
                    <span>{item.l}</span><span>{item.n}</span>
                  </div>
                  <div className="h-2 bg-deep border border-line overflow-hidden">
                    <div className="h-full bar-anim" style={{ width: (nps.total ? (item.n / nps.total) * 100 : 0) + '%', background: item.c }} />
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
                const patient = patients.find((candidate) => candidate.id === risk.patientId);
                if (!patient) return null;
                return (
                  <li key={patient.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={'/pacientes/' + patient.id} className="font-display font-semibold text-[13.5px] hover:text-mint transition-colors">{patient.nome}</Link>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line border border-line">
          {[
            { v: appointments.filter((appointment) => appointment.status === 'confirmado').length, l: 'sessões confirmadas' },
            { v: patients.filter((patient) => patient.optInWhats && !patient.anonimizado).length, l: 'opt-ins WhatsApp' },
            { v: nps.total, l: 'respostas NPS' },
          ].map((item) => (
            <div key={item.l} className="bg-panel px-5 py-4 hover:bg-raise/60 transition-colors">
              <CountUp to={item.v} className="font-display text-3xl font-bold text-mint" />
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog mt-1">{item.l}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
