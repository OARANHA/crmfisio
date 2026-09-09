import type { AgendaStatusFilter } from '../../lib/clinicianDaily';
import { fmtBRL } from '../../lib/types';

type Summary = {
  total: number;
  confirmed: number;
  inService: number;
  finished: number;
  pending: number;
  missed: number;
  nominalValue: number;
};

type NavigationProps = {
  summary: Summary;
  activeFilter?: AgendaStatusFilter | null;
  onFilterChange?: (filter: AgendaStatusFilter) => void;
};

export function AgendaStatusNavigation({ summary, activeFilter = null, onFilterChange }: NavigationProps) {
  return (
    <section aria-label="Navegação por status" className="grid gap-2 sm:grid-cols-3">
      <StatusMetric label="Pendentes" value={summary.pending} tone="text-amber" border="border-amber/25" filter="pending" active={activeFilter === 'pending'} onActivate={onFilterChange} />
      <StatusMetric label="Em atendimento" value={summary.inService} tone="text-aqua" border="border-aqua/30" filter="in_service" active={activeFilter === 'in_service'} onActivate={onFilterChange} />
      <StatusMetric label="Finalizados" value={summary.finished} tone="text-mint" border="border-mint/25" filter="finished" active={activeFilter === 'finished'} onActivate={onFilterChange} />
    </section>
  );
}

export function AgendaAnalytics({ label, summary }: { label: string; summary: Summary }) {
  const attendanceBase = summary.finished + summary.missed;
  const attendanceRate = attendanceBase > 0 ? Math.round((summary.finished / attendanceBase) * 100) : 100;
  const confirmationBase = summary.confirmed + summary.pending;
  const confirmationRate = confirmationBase > 0 ? Math.round((summary.confirmed / confirmationBase) * 100) : 100;

  return (
    <section aria-label="Indicadores analíticos da agenda" className="grid gap-3 xl:grid-cols-[1.25fr_1fr_1fr_1.1fr]">
      <div className="rounded-[22px] border border-line/75 bg-panel p-5 shadow-[0_12px_36px_rgba(0,0,0,0.045)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fog">Fluxo do período</p>
            <p className="mt-2 font-display text-[34px] font-bold leading-none">{summary.total}</p>
            <p className="mt-2 text-[13px] text-fog">{label}</p>
          </div>
          <div className="rounded-2xl border border-line/70 bg-deep/45 px-3 py-2 text-right">
            <p className="text-[11px] text-fog">Valor nominal</p>
            <p className="mt-1 font-display text-lg font-semibold text-paper">{fmtBRL(summary.nominalValue)}</p>
          </div>
        </div>
      </div>

      <SignalCard label="Confirmação" value={`${confirmationRate}%`} sub={`${summary.confirmed} confirmados · ${summary.pending} aguardando`} progress={confirmationRate} />
      <SignalCard label="Comparecimento" value={`${attendanceRate}%`} sub={`${summary.missed} falta(s) registradas`} progress={attendanceRate} warning={attendanceRate < 85} />
      <div className="rounded-[22px] border border-line/75 bg-panel p-5 shadow-[0_12px_36px_rgba(0,0,0,0.045)]">
        <p className="text-[12px] font-semibold text-fog">Leitura rápida</p>
        <p className="mt-3 font-display text-xl font-semibold tracking-tight">
          {summary.inService > 0 ? `${summary.inService} atendimento${summary.inService > 1 ? 's' : ''} em andamento` : summary.pending > 0 ? `${summary.pending} aguardando confirmação` : 'Fluxo sob controle'}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-fog">
          {summary.missed > 0 ? `${summary.missed} ausência${summary.missed > 1 ? 's' : ''} merece${summary.missed > 1 ? 'm' : ''} atenção.` : 'Nenhuma falta no período selecionado.'}
        </p>
      </div>
    </section>
  );
}

/** @deprecated Compose AgendaStatusNavigation and AgendaAnalytics explicitly in the page. */
export function AgendaV3Summary({
  label,
  summary,
  activeFilter = null,
  onFilterChange,
}: { label: string; summary: Summary; activeFilter?: AgendaStatusFilter | null; onFilterChange?: (filter: AgendaStatusFilter) => void }) {
  return (
    <div className="space-y-3">
      <AgendaStatusNavigation summary={summary} activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <AgendaAnalytics label={label} summary={summary} />
    </div>
  );
}

function StatusMetric({
  label,
  value,
  tone,
  border,
  filter,
  active,
  onActivate,
}: {
  label: string;
  value: number;
  tone: string;
  border: string;
  filter: AgendaStatusFilter;
  active: boolean;
  onActivate?: (filter: AgendaStatusFilter) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Filtrar agenda por ${label.toLowerCase()}: ${value}`}
      onClick={() => onActivate?.(filter)}
      className={`rounded-[18px] border ${border} px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/60 ${active ? 'bg-raise shadow-sm ring-1 ring-aqua/30' : 'bg-panel hover:bg-raise/65'}`}
    >
      <p className="text-[11.5px] font-semibold text-fog">{label}</p>
      <p className={`mt-1 font-display text-[24px] font-bold leading-none ${tone}`}>{value}</p>
    </button>
  );
}

function SignalCard({ label, value, sub, progress, warning = false }: { label: string; value: string; sub: string; progress: number; warning?: boolean }) {
  return (
    <div className="rounded-[22px] border border-line/75 bg-panel p-5 shadow-[0_12px_36px_rgba(0,0,0,0.045)]">
      <p className="text-[12px] font-semibold text-fog">{label}</p>
      <p className={`mt-3 font-display text-[30px] font-bold leading-none ${warning ? 'text-amber' : 'text-paper'}`}>{value}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-raise">
        <div className="h-full rounded-full bg-mint transition-[width] duration-500" style={{ width: `${Math.max(4, Math.min(100, progress))}%` }} />
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-fog">{sub}</p>
    </div>
  );
}
