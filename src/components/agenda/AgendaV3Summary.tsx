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

type Props = {
  label: string;
  summary: Summary;
  activeFilter?: AgendaStatusFilter | null;
  onFilterChange?: (filter: AgendaStatusFilter | null) => void;
};

export function AgendaV3Summary({ label, summary, activeFilter = null, onFilterChange }: Props) {
  const attendanceBase = summary.finished + summary.missed;
  const attendanceRate = attendanceBase > 0 ? Math.round((summary.finished / attendanceBase) * 100) : 100;
  const confirmationBase = summary.confirmed + summary.pending;
  const confirmationRate = confirmationBase > 0 ? Math.round((summary.confirmed / confirmationBase) * 100) : 100;

  return (
    <section className="grid gap-3 xl:grid-cols-[1.25fr_1fr_1fr_1.1fr]">
      <div className="rounded-[22px] border border-mint/20 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-mint)_10%,var(--color-panel)),var(--color-panel)_58%)] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.07)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mint/80">Fluxo do período</p>
            <p className="mt-2 font-display text-[34px] font-bold leading-none">{summary.total}</p>
            <p className="mt-2 text-[13px] text-fog">{label}</p>
          </div>
          <div className="rounded-2xl border border-line/70 bg-deep/45 px-3 py-2 text-right">
            <p className="text-[11px] text-fog">Valor nominal</p>
            <p className="mt-1 font-display text-lg font-semibold text-paper">{fmtBRL(summary.nominalValue)}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line/55 pt-4">
          <MetricMini label="Pendentes" value={summary.pending} tone="text-amber" filter="pending" active={activeFilter === 'pending'} onActivate={onFilterChange} />
          <MetricMini label="Em atendimento" value={summary.inService} tone="text-aqua" filter="in_service" active={activeFilter === 'in_service'} onActivate={onFilterChange} />
          <MetricMini label="Finalizados" value={summary.finished} tone="text-mint" filter="finished" active={activeFilter === 'finished'} onActivate={onFilterChange} />
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

function MetricMini({
  label,
  value,
  tone,
  filter,
  active,
  onActivate,
}: {
  label: string;
  value: number;
  tone: string;
  filter: AgendaStatusFilter;
  active: boolean;
  onActivate?: (filter: AgendaStatusFilter | null) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Filtrar agenda por ${label.toLowerCase()}: ${value}`}
      onClick={() => onActivate?.(active ? null : filter)}
      className={`rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/60 ${active ? 'bg-raise ring-1 ring-aqua/35' : 'hover:bg-raise/65'}`}
    >
      <p className="text-[11px] text-fog">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${tone}`}>{value}</p>
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
