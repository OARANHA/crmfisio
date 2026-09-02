import { useMemo } from 'react';
import { buildTreatmentContext } from '../lib/treatmentContext';
import { useApp } from '../lib/store';
import { Bar, Chip } from '../lib/ui';
import { fmtBRL, type Appointment, type Patient } from '../lib/types';

export function TreatmentJourneyContext({ patient, appointment }: { patient?: Patient; appointment: Appointment }) {
  const { appointments, patientPackages, packages, transactions } = useApp();
  const context = useMemo(() => buildTreatmentContext({
    patient,
    appointment,
    appointments,
    patientPackages,
    packages,
    transactions,
  }), [patient, appointment, appointments, patientPackages, packages, transactions]);

  const financeClass = context.financialState === 'atrasado'
    ? 'border-pulse/40 text-pulse'
    : context.financialState === 'pendente'
      ? 'border-amber/40 text-amber'
      : 'border-mint/35 text-mint';
  const financeLabel = context.financialState === 'atrasado'
    ? `Em atraso · ${fmtBRL(context.overdueAmount)}`
    : context.financialState === 'pendente'
      ? `Pendente · ${fmtBRL(context.pendingAmount)}`
      : 'Financeiro em dia';

  return (
    <div className="border border-line bg-deep/50 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] uppercase text-fog">Jornada do tratamento</p>
          <p className="text-[12px] mt-1">{context.stageLabel}</p>
        </div>
        <Chip className={financeClass}>{financeLabel}</Chip>
      </div>

      {context.sessionTotal ? (
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display font-semibold text-[14px]">
                Sessão {context.sessionCurrent}/{context.sessionTotal}
              </p>
              <p className="font-mono text-[9px] text-fog mt-0.5">
                {context.packageName} · {context.sessionsUsed} usadas · {context.sessionsRemaining} restantes
              </p>
            </div>
            <span className="font-mono text-[10px] text-mint">{context.progressPct}%</span>
          </div>
          <Bar pct={context.progressPct ?? 0} />
        </div>
      ) : (
        <p className="text-[11px] text-fog">Sem pacote ativo vinculado; acompanhamento baseado no histórico de sessões.</p>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="border border-line/70 p-2">
          <span className="block font-display font-semibold text-[15px]">{context.completed}</span>
          <span className="font-mono text-[8.5px] uppercase text-fog">realizadas</span>
        </div>
        <div className="border border-line/70 p-2">
          <span className="block font-display font-semibold text-[15px]">{context.missed}</span>
          <span className="font-mono text-[8.5px] uppercase text-fog">faltas</span>
        </div>
        <div className="border border-line/70 p-2">
          <span className="block font-display font-semibold text-[15px]">{context.future}</span>
          <span className="font-mono text-[8.5px] uppercase text-fog">futuras</span>
        </div>
      </div>

      {context.interruptionRisk && (
        <div className="border border-amber/35 bg-amber/[0.06] px-3 py-2 text-[11px] text-amber">
          Atenção: paciente em tratamento, com sessões realizadas e sem continuidade futura registrada. Avaliar interrupção/retomada.
        </div>
      )}
    </div>
  );
}
