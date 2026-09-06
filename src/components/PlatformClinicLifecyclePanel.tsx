import { useEffect, useState } from 'react';
import {
  loadPlatformClinics,
  reactivatePlatformClinic,
  suspendPlatformClinic,
  type PlatformClinicSummary,
} from '../lib/platformAdmin';

export function PlatformClinicLifecyclePanel() {
  const [clinics, setClinics] = useState<PlatformClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const items = await loadPlatformClinics();
    setClinics(items);
  };

  useEffect(() => {
    let active = true;
    void loadPlatformClinics()
      .then((items) => { if (active) setClinics(items); })
      .catch((cause) => {
        console.error('[Platform Admin] clinic lifecycle:', cause);
        if (active) setError('Não foi possível carregar o estado das clínicas.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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
    <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pulse">Clínicas · Lifecycle</p>
        <h2 className="mt-1 font-display text-xl font-bold">Acesso operacional da clínica</h2>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-fog">
          Suspensão é um bloqueio SaaS server-side: usuários deixam de resolver tenant e papel nas RLS. Reativação não religa automações automaticamente.
        </p>
      </div>

      {error && <div className="mt-4 rounded-xl border border-amber/35 bg-amber/5 p-3 text-[12.5px] text-amber">{error}</div>}

      <div className="mt-4 divide-y divide-line/60">
        {clinics.map((clinic) => {
          const suspended = clinic.lifecycleStatus === 'suspended';
          return (
            <div key={clinic.id} className="flex flex-wrap items-center gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-[14px] font-semibold">{clinic.name}</p>
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] ${suspended ? 'border-amber/40 text-amber' : 'border-mint/35 text-mint'}`}>
                    {suspended ? 'Suspensa' : 'Ativa'}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[9.5px] text-fog/70">{clinic.id}{clinic.cnpj ? ` · CNPJ ${clinic.cnpj}` : ''}</p>
              </div>
              <button
                type="button"
                disabled={loading || busyId !== null}
                onClick={() => void changeStatus(clinic)}
                className={`rounded-xl border px-3.5 py-2 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-50 ${suspended ? 'border-mint/35 text-mint hover:bg-mint/10' : 'border-amber/35 text-amber hover:bg-amber/10'}`}
              >
                {busyId === clinic.id ? 'Aplicando…' : suspended ? 'Reativar clínica' : 'Suspender clínica'}
              </button>
            </div>
          );
        })}
        {!loading && clinics.length === 0 && <p className="py-5 text-[12px] text-fog">Nenhuma clínica encontrada.</p>}
      </div>
    </section>
  );
}
