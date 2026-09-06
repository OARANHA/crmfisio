import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/store';
import { usePackages } from '../lib/packageContext';
import { buildChurnRiskList } from '../lib/churnRisk';
import { fmtBRL } from '../lib/types';
import { Card, CardHead, Btn, Chip, IconAlert } from '../lib/ui';

const LEVEL_META = {
  alto: { label: 'alto risco', cls: 'border-pulse/45 text-pulse bg-pulse/10' },
  medio: { label: 'atenção', cls: 'border-amber/45 text-amber bg-amber/10' },
  baixo: { label: 'baixo risco', cls: 'border-aqua/35 text-aqua bg-aqua/10' },
} as const;

export function TreatmentContinuityWatch() {
  const { patients, appointments, transactions } = useApp();
  const { patientPackages } = usePackages();

  const risks = useMemo(
    () => buildChurnRiskList(patients, appointments, patientPackages, transactions),
    [patients, appointments, patientPackages, transactions],
  );

  const high = risks.filter((item) => item.level === 'alto').length;
  const medium = risks.filter((item) => item.level === 'medio').length;

  return (
    <Card>
      <CardHead
        title="Risco de interrupção / churn"
        sub="score transparente baseado em continuidade, faltas, pacote e financeiro — não é modelo de IA"
        right={high || medium ? <IconAlert className="w-4.5 h-4.5 text-amber" /> : undefined}
      />

      {risks.length > 0 && (
        <div className="grid grid-cols-3 gap-px bg-line border-b border-line">
          <div className="bg-panel px-4 py-3"><p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-fog">alto risco</p><p className="font-display text-xl font-bold text-pulse mt-1">{high}</p></div>
          <div className="bg-panel px-4 py-3"><p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-fog">atenção</p><p className="font-display text-xl font-bold text-amber mt-1">{medium}</p></div>
          <div className="bg-panel px-4 py-3"><p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-fog">monitorados</p><p className="font-display text-xl font-bold text-aqua mt-1">{risks.length}</p></div>
        </div>
      )}

      {risks.length === 0 ? (
        <div className="px-5 py-8 text-center font-mono text-[11.5px] text-fog">Nenhum sinal relevante de risco de interrupção identificado.</div>
      ) : (
        <ul className="divide-y divide-line/70">
          {risks.map((risk) => {
            const meta = LEVEL_META[risk.level];
            return (
              <li key={risk.patientId} className="px-5 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><Link to={`/pacientes/${risk.patientId}`} className="font-display font-semibold text-[13.5px] hover:text-mint transition-colors">{risk.patientName}</Link><Chip className={meta.cls}>{meta.label} · {risk.score}/100</Chip></div>
                    <p className="font-mono text-[10.5px] text-fog mt-1">{risk.completed} realizada(s) · {risk.missed} falta(s){risk.packageRemaining !== null ? ` · ${risk.packageRemaining} sessão(ões) restantes` : ''}{risk.overdueAmount > 0 ? ` · ${fmtBRL(risk.overdueAmount)} em atraso` : ''}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">{risk.reasons.map((reason) => <span key={reason} className="font-mono text-[9.5px] px-2 py-1 border border-line text-fog bg-deep">{reason}</span>)}</div>
                    <p className="font-mono text-[9.5px] text-fog/70 mt-2">{risk.lastVisit ? `Última sessão: ${risk.lastVisit}` : 'Sem sessão finalizada'}{risk.hasFutureAppointment ? ' · já possui próxima sessão' : ' · sem próxima sessão'}</p>
                  </div>
                  <div className="flex gap-2"><Link to={`/pacientes/${risk.patientId}`}><Btn variant="ghost" className="!px-3 !py-1.5 !text-[11.5px]">Ver paciente</Btn></Link>{!risk.hasFutureAppointment && <Link to={`/agenda?patient=${risk.patientId}`}><Btn variant="subtle" className="!px-3 !py-1.5 !text-[11.5px]">Agendar continuidade</Btn></Link>}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="px-5 py-3 border-t border-line font-mono text-[10.5px] text-fog">O score é uma regra operacional explicável. Serve para priorizar contato humano e renovação; não substitui decisão clínica.</div>
    </Card>
  );
}
