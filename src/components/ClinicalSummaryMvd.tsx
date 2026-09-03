type ReadinessItem = {
  label: string;
  ok: boolean;
};

type ClinicalSummaryMvdProps = {
  complaint: string;
  cid: string;
  objective: string;
  plan: string;
  lastSession: string;
  nextSession: string;
  hasNextSession: boolean;
  readiness: ReadinessItem[];
  activeSessionTime?: string | null;
};

export function ClinicalSummaryMvd({
  complaint,
  cid,
  objective,
  plan,
  lastSession,
  nextSession,
  hasNextSession,
  readiness,
  activeSessionTime,
}: ClinicalSummaryMvdProps) {
  const readyCount = readiness.filter((item) => item.ok).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-line/70 bg-panel/70">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line/60 px-5 py-4">
        <div>
          <h2 className="font-display text-[17px] font-semibold">Visão clínica</h2>
          <p className="mt-0.5 text-[13px] text-fog">O essencial para entender o paciente antes de atender.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[12.5px]">
          <span className="font-semibold text-paper/90">Prontidão {readyCount}/{readiness.length}</span>
          {readiness.map((item) => (
            <span
              key={item.label}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${item.ok ? 'bg-mint/[0.08] text-mint' : 'bg-amber/[0.08] text-amber'}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${item.ok ? 'bg-mint' : 'bg-amber'}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_.8fr]">
        <div className="px-5 py-5 lg:border-r lg:border-line/60">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <ClinicalDatum label="Queixa principal" value={complaint} className="sm:col-span-2" emphasis />
            <ClinicalDatum label="CID-10" value={cid} />
            <ClinicalDatum label="Objetivo terapêutico" value={objective} />
            <ClinicalDatum label="Plano terapêutico" value={plan} className="sm:col-span-2" />
          </div>
        </div>

        <div className="px-5 py-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-fog">Linha do cuidado</p>
          <div className="mt-3 divide-y divide-line/60">
            <SessionDatum label="Última sessão" value={lastSession} />
            <SessionDatum label="Próxima sessão" value={nextSession} alert={!hasNextSession} />
          </div>
          {activeSessionTime && (
            <div className="mt-4 rounded-xl bg-amber/[0.07] px-3.5 py-3 text-[13px] leading-relaxed text-amber">
              Atendimento em andamento desde {activeSessionTime}. Registre a evolução antes de finalizar.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ClinicalDatum({ label, value, className = '', emphasis = false }: { label: string; value: string; className?: string; emphasis?: boolean }) {
  return (
    <div className={className}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-fog">{label}</p>
      <p className={`mt-1.5 leading-relaxed ${emphasis ? 'text-[15.5px] font-medium text-paper' : 'text-[14px] text-paper/90'}`}>{value}</p>
    </div>
  );
}

function SessionDatum({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-[13px] text-fog">{label}</span>
      <span className={`text-right text-[13.5px] font-medium ${alert ? 'text-amber' : 'text-paper/90'}`}>{value}</span>
    </div>
  );
}
