import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  encounterCoveragePresentation,
  loadEncounterCoverageContext,
  type EncounterCoverageContext,
} from '../lib/encounterCoverageContext';
import { Chip } from '../lib/ui';

export function EncounterCoverageContextCard({ appointmentId }: { appointmentId: string }) {
  const [coverage, setCoverage] = useState<EncounterCoverageContext | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setStatus('loading');
    try {
      const next = await loadEncounterCoverageContext(appointmentId);
      if (request !== generation.current) return;
      setCoverage(next);
      setStatus('ready');
    } catch (error) {
      console.error('[MedicsPro] cobertura contextual do atendimento:', error);
      if (request !== generation.current) return;
      setCoverage(null);
      setStatus('error');
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
    return () => { generation.current += 1; };
  }, [load]);

  if (status === 'loading') {
    return <CoverageShell><p className="text-[13px] leading-relaxed text-fog">Confirmando a cobertura deste atendimento…</p></CoverageShell>;
  }

  if (status === 'error' || !coverage) {
    return <CoverageShell>
      <p className="font-display text-[15px] font-semibold text-amber">Cobertura não confirmada</p>
      <p className="mt-1 text-[13px] leading-relaxed text-fog">Não foi possível confirmar o contexto agora. A conclusão clínica permanece separada do acerto administrativo.</p>
      <button type="button" onClick={() => void load()} className="mt-3 text-[13px] font-semibold text-aqua hover:underline">Tentar novamente</button>
    </CoverageShell>;
  }

  const presentation = encounterCoveragePresentation(coverage);
  const stateClass = presentation.tone === 'attention'
    ? 'text-amber'
    : presentation.tone === 'success'
      ? 'text-mint'
      : 'text-paper';
  const chipClass = presentation.tone === 'attention'
    ? 'border-amber/35 text-amber'
    : presentation.tone === 'success'
      ? 'border-mint/35 text-mint'
      : 'border-aqua/30 text-aqua';

  return <CoverageShell>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className={`font-display text-[15px] font-semibold ${stateClass}`}>{presentation.stateLabel}</p>
      </div>
      <Chip className={chipClass}>{presentation.kindLabel}</Chip>
    </div>
    {coverage.coverageKind === 'package' && coverage.packageName && <p className="mt-2 text-[13px] font-medium text-paper/90">{coverage.packageName}</p>}
    <p className="mt-2 text-[13px] leading-relaxed text-fog">{presentation.detail}</p>
    {coverage.administrativeAttention && <p className="mt-2 text-[12px] font-semibold text-amber">Ajuste administrativo separado do cuidado clínico.</p>}
  </CoverageShell>;
}

function CoverageShell({ children }: { children: ReactNode }) {
  return <section aria-label="Cobertura deste atendimento" className="clinical-context-card rounded-[20px] border border-line/70 bg-panel p-4">
    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.11em] text-aqua">Cobertura deste atendimento</p>
    {children}
  </section>;
}
