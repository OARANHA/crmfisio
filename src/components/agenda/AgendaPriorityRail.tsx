import { STATUS_META } from '../../lib/types';

export type AgendaPrioritySummary = {
  total: number;
  confirmed: number;
  inService: number;
  finished: number;
  pending: number;
  missed: number;
  nominalValue: number;
};

export function AgendaPriorityRail({ summary, label }: { summary: AgendaPrioritySummary; label: string }) {
  const attention = summary.inService > 0
    ? `${summary.inService} em atendimento`
    : summary.pending > 0
      ? `${summary.pending} aguardando confirmação`
      : summary.missed > 0
        ? `${summary.missed} falta${summary.missed > 1 ? 's' : ''} registrada${summary.missed > 1 ? 's' : ''}`
        : 'Fluxo sob controle';

  return (
    <section className="rounded-[24px] border border-line/70 bg-panel p-5 shadow-[0_16px_42px_rgba(0,0,0,0.055)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mint">Leitura rápida</p>
      <p className="mt-2 font-display text-[22px] font-bold leading-tight text-paper">{attention}</p>
      <p className="mt-1 text-[12.5px] text-fog">{label}</p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Metric label="Total" value={summary.total} />
        <Metric label="Confirmados" value={summary.confirmed} tone="text-aqua" />
        <Metric label="Aguardando" value={summary.pending} tone="text-amber" />
        <Metric label="Finalizados" value={summary.finished} tone="text-mint" />
      </div>

      <div className="mt-5 border-t border-line/60 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fog">Estados da agenda</p>
        <div className="mt-3 grid gap-2">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-line/55 bg-deep/30 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12.5px] font-medium text-paper/90">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.dot }} />
                {meta.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = 'text-paper' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line/60 bg-deep/35 p-3.5">
      <p className="text-[11px] text-fog">{label}</p>
      <p className={`mt-1 font-display text-[24px] font-bold ${tone}`}>{value}</p>
    </div>
  );
}
