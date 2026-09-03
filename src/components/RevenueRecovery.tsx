import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/store';
import { fmtBRL } from '../lib/types';
import { Card, Chip, IconChevronR } from '../lib/ui';
import { buildChurnRiskList } from '../lib/churnRisk';

export function RevenueRecovery() {
  const { transactions, patients, appointments, patientPackages } = useApp();

  const recovery = useMemo(() => {
    const overdue = transactions.filter((t) => t.tipo === 'receber' && t.status === 'atrasado');
    const overdueValue = overdue.reduce((sum, t) => sum + t.valor, 0);

    const risks = buildChurnRiskList(patients, appointments, patientPackages, transactions);
    const relevantRisks = risks.filter((risk) => risk.level !== 'baixo');
    const withoutNextSession = relevantRisks.filter((risk) => !risk.hasFutureAppointment);

    return {
      overdueValue,
      overdueCount: overdue.length,
      riskCount: relevantRisks.length,
      withoutNextSessionCount: withoutNextSession.length,
    };
  }, [transactions, patients, appointments, patientPackages]);

  const hasOpportunity = recovery.overdueCount + recovery.riskCount + recovery.withoutNextSessionCount > 0;

  return (
    <Card className="overflow-hidden border-mint/25">
      <div className="p-5 md:p-6 bg-mint/[0.035]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-mint">Revenue Recovery</p>
              <Chip className="border-mint/35 text-mint">ação comercial</Chip>
            </div>
            <h2 className="font-display text-xl md:text-2xl font-bold mt-2">Dinheiro que a clínica pode recuperar agora</h2>
            <p className="text-fog text-[12.5px] mt-1 max-w-2xl">
              O MedicsPro cruza inadimplência e risco objetivo de abandono para orientar recuperação e continuidade.
            </p>
          </div>
          <div className="md:ml-auto text-left md:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fog">cobranças vencidas</p>
            <p className="font-display text-3xl font-bold text-mint mt-1">{fmtBRL(recovery.overdueValue)}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-px bg-line border border-line mt-5">
          <Link to="/financeiro" className="bg-panel/80 hover:bg-raise px-4 py-4 transition-colors group">
            <p className="font-mono text-[10px] uppercase text-fog">Cobranças atrasadas</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="font-display text-2xl font-bold text-amber">{recovery.overdueCount}</span>
              <IconChevronR className="w-4 h-4 ml-auto text-fog group-hover:text-mint" />
            </div>
          </Link>
          <Link to="/crm" className="bg-panel/80 hover:bg-raise px-4 py-4 transition-colors group">
            <p className="font-mono text-[10px] uppercase text-fog">Tratamentos em risco</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="font-display text-2xl font-bold text-aqua">{recovery.riskCount}</span>
              <IconChevronR className="w-4 h-4 ml-auto text-fog group-hover:text-mint" />
            </div>
          </Link>
          <Link to="/agenda" className="bg-panel/80 hover:bg-raise px-4 py-4 transition-colors group">
            <p className="font-mono text-[10px] uppercase text-fog">Riscos sem próxima sessão</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="font-display text-2xl font-bold text-pulse">{recovery.withoutNextSessionCount}</span>
              <IconChevronR className="w-4 h-4 ml-auto text-fog group-hover:text-mint" />
            </div>
          </Link>
        </div>

        {!hasOpportunity && (
          <p className="font-mono text-[11px] text-mint mt-4">Nenhuma oportunidade crítica detectada agora. Operação saudável.</p>
        )}
      </div>
    </Card>
  );
}
