import { useMemo, useState } from 'react';
import {
  loadPlatformClinics,
  reactivatePlatformClinic,
  suspendPlatformClinic,
  type PlatformClinicSummary,
} from '../lib/platformAdmin';

type Props = {
  clinics: PlatformClinicSummary[];
  loading?: boolean;
  onClinicsChanged: (items: PlatformClinicSummary[]) => void;
};

export function PlatformClinicLifecyclePanel({ clinics, loading = false, onClinicsChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const refresh = async () => {
    const items = await loadPlatformClinics();
    onClinicsChanged(items);
  };

  const visibleClinics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return clinics.filter((clinic) => {
      if (filter !== 'all' && clinic.lifecycleStatus !== filter) return false;
      if (!normalized) return true;
      return `${clinic.name} ${clinic.cnpj ?? ''} ${clinic.id}`.toLowerCase().includes(normalized);
    });
  }, [clinics, filter, query]);

  const changeStatus = async (clinic: PlatformClinicSummary) => {
    if (busyId) return;
    const suspending = clinic.lifecycleStatus === 'active';
    const action = suspending ? 'suspender' : 'reativar';
    const reason = window.prompt(`Motivo para ${action} ${clinic.name}:`)?.trim();
    if (!reason) return;

    const confirmed = window.confirm(
      suspending
        ? `Suspender ${clinic.name}? Os usuários da clínica perderão acesso tenant imediatamente e as automações locais serão pausadas.`
        : `Reativar ${clinic.name}? O acesso tenant volta a funcionar, mas as automações locais continuarão pausadas até revisão da clínica.`,
    );
    if (!confirmed) return;

    setBusyId(clinic.id);
    setError(null);
    try {
      if (suspending) await suspendPlatformClinic(clinic.id, reason);
      else await reactivatePlatformClinic(clinic.id, reason);
      await refresh();
    } catch (cause) {
      console.error('[Platform Admin] clinic lifecycle mutation:', cause);
      setError('Não foi possível alterar o estado da clínica. O estado anterior foi preservado.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-[22px] border border-line bg-panel p-5 md:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-pulse">Lifecycle</p>
          <h2 className="mt-1 font-display text-[19px] font-bold">Acesso operacional das clínicas</h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">Suspensão bloqueia o tenant no servidor sem apagar dados. Reativação devolve o acesso, mas não religa automações locais automaticamente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'suspended'] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl border px-3 py-2 text-[10.5px] font-semibold transition ${filter === value ? 'border-aqua/35 bg-aqua/[0.07] text-aqua' : 'border-line bg-deep/45 text-fog hover:text-paper'}`}>{value === 'all' ? 'Todas' : value === 'active' ? 'Ativas' : 'Suspensas'}</button>)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-line/60 pt-4">
        <div className="min-w-[220px] flex-1">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar clínica, CNPJ ou ID…" className="w-full rounded-xl border border-line bg-deep/55 px-4 py-3 text-[11.5px] outline-none transition focus:border-aqua" />
        </div>
        <div className="rounded-xl border border-line bg-deep/45 px-3.5 py-3 text-[10.5px] text-fog"><span className="font-semibold text-paper">{visibleClinics.length}</span> resultado(s)</div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-amber/35 bg-amber/5 p-3 text-[12.5px] text-amber">{error}</div>}

      <div className="mt-4 grid gap-2.5 xl:grid-cols-2">
        {visibleClinics.map((clinic) => {
          const suspended = clinic.lifecycleStatus === 'suspended';
          return (
            <article key={clinic.id} className="rounded-2xl border border-line/70 bg-deep/45 p-4 transition hover:border-aqua/25">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-[12px] font-bold ${suspended ? 'border-amber/25 bg-amber/[0.06] text-amber' : 'border-mint/25 bg-mint/[0.06] text-mint'}`}>{clinic.name.slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-display text-[13.5px] font-semibold">{clinic.name}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${suspended ? 'border-amber/30 bg-amber/[0.06] text-amber' : 'border-mint/30 bg-mint/[0.06] text-mint'}`}>{suspended ? 'Suspensa' : 'Ativa'}</span>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-fog">{clinic.cnpj ? `CNPJ ${clinic.cnpj}` : 'CNPJ não informado'}</p>
                </div>
                <button type="button" disabled={loading || busyId !== null} onClick={() => void changeStatus(clinic)} className={`rounded-xl border px-3.5 py-2.5 text-[10.5px] font-semibold transition disabled:cursor-wait disabled:opacity-50 ${suspended ? 'border-mint/35 text-mint hover:bg-mint/10' : 'border-amber/35 text-amber hover:bg-amber/10'}`}>{busyId === clinic.id ? 'Aplicando…' : suspended ? 'Reativar' : 'Suspender'}</button>
              </div>
              <p className="mt-3 border-t border-line/50 pt-2 font-mono text-[9px] text-fog/60">{clinic.id}</p>
            </article>
          );
        })}
        {!loading && visibleClinics.length === 0 && <div className="xl:col-span-2 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[11.5px] text-fog">Nenhuma clínica encontrada com este filtro.</div>}
      </div>
    </section>
  );
}
