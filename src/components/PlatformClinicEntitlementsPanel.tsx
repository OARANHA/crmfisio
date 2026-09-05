import { useEffect, useMemo, useState } from 'react';
import {
  loadPlatformAuditLog,
  loadPlatformClinicEntitlements,
  loadPlatformClinics,
  resetPlatformClinicEntitlement,
  setPlatformClinicEntitlement,
  type PlatformAuditEntry,
  type PlatformClinicEntitlement,
  type PlatformClinicEntitlementKey,
  type PlatformClinicSummary,
} from '../lib/platformAdmin';

const SELECTED_CLINIC_STORAGE_KEY = 'medicspro-platform-selected-clinic';

const ENTITLEMENT_META: Record<PlatformClinicEntitlementKey, { title: string; description: string }> = {
  'nexus.access': { title: 'Nexus', description: 'Disponibiliza o Clinical Intelligence Engine para a clínica; capabilities continuam separadas.' },
  'finance.access': { title: 'Financeiro', description: 'Disponibiliza os módulos financeiros contratados para a clínica.' },
  'crm.access': { title: 'CRM', description: 'Disponibiliza CRM e fluxos comerciais/relacionais para a clínica.' },
  'reports.access': { title: 'Relatórios', description: 'Disponibiliza relatórios e visões analíticas contratadas.' },
  'assessments.custom': { title: 'Avaliações customizadas', description: 'Permite à clínica manter e publicar suas próprias avaliações estruturadas.' },
  'whatsapp.access': { title: 'WhatsApp', description: 'Disponibiliza recursos de mensageria; configuração do provedor permanece separada.' },
};

type EntitlementMode = 'inherited' | 'enabled' | 'disabled';

function modeOf(item: PlatformClinicEntitlement): EntitlementMode {
  if (!item.configured) return 'inherited';
  return item.enabled ? 'enabled' : 'disabled';
}

function modeLabel(item: PlatformClinicEntitlement): string {
  if (!item.configured) return item.key === 'nexus.access' ? 'Não configurado · Nexus bloqueado' : 'Herdado · rollout compatível';
  return item.enabled ? 'Liberado explicitamente' : 'Bloqueado explicitamente';
}

export function PlatformClinicEntitlementsPanel({ onAuditChanged }: { onAuditChanged?: (items: PlatformAuditEntry[]) => void }) {
  const [clinics, setClinics] = useState<PlatformClinicSummary[]>([]);
  const [clinicId, setClinicId] = useState('');
  const [entitlements, setEntitlements] = useState<PlatformClinicEntitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<PlatformClinicEntitlementKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedClinic = useMemo(() => clinics.find((item) => item.id === clinicId) ?? null, [clinics, clinicId]);

  useEffect(() => {
    let active = true;
    void loadPlatformClinics().then((items) => {
      if (!active) return;
      setClinics(items);
      const storedClinicId = window.localStorage.getItem(SELECTED_CLINIC_STORAGE_KEY);
      const storedClinicStillExists = storedClinicId && items.some((item) => item.id === storedClinicId);
      setClinicId(storedClinicStillExists ? storedClinicId : (items[0]?.id || ''));
    }).catch((cause) => {
      console.error('[Platform Admin] clinics:', cause);
      if (active) setError('Não foi possível carregar as clínicas da plataforma.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!clinicId) {
      setEntitlements([]);
      return;
    }
    window.localStorage.setItem(SELECTED_CLINIC_STORAGE_KEY, clinicId);
    let active = true;
    setLoading(true);
    setError(null);
    void loadPlatformClinicEntitlements(clinicId).then((items) => {
      if (active) setEntitlements(items);
    }).catch((cause) => {
      console.error('[Platform Admin] entitlements:', cause);
      if (active) setError('Não foi possível carregar os módulos desta clínica.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clinicId]);

  const refreshAudit = async () => {
    if (onAuditChanged) onAuditChanged(await loadPlatformAuditLog(40));
  };

  const setMode = async (item: PlatformClinicEntitlement, nextMode: EntitlementMode) => {
    if (!clinicId || busyKey || modeOf(item) === nextMode) return;

    if (nextMode === 'inherited') {
      const message = item.key === 'nexus.access'
        ? `Voltar Nexus de ${selectedClinic?.name ?? 'esta clínica'} para “não configurado”? Nexus ficará bloqueado até uma liberação explícita.`
        : `Remover a decisão explícita de ${ENTITLEMENT_META[item.key].title} para ${selectedClinic?.name ?? 'esta clínica'} e voltar ao comportamento herdado do rollout?`;
      if (!window.confirm(message)) return;
    }

    setBusyKey(item.key);
    setError(null);
    try {
      if (nextMode === 'inherited') {
        await resetPlatformClinicEntitlement({ clinicId, key: item.key });
        const refreshed = await loadPlatformClinicEntitlements(clinicId);
        setEntitlements(refreshed);
      } else {
        const updated = await setPlatformClinicEntitlement({
          clinicId,
          key: item.key,
          enabled: nextMode === 'enabled',
          source: 'manual',
        });
        setEntitlements((current) => current.map((entry) => entry.key === updated.key ? updated : entry));
      }
      await refreshAudit();
    } catch (cause) {
      console.error('[Platform Admin] entitlement:', cause);
      setError('Não foi possível alterar o módulo. O estado anterior foi preservado. Verifique a sessão do Platform Admin.');
    } finally {
      setBusyKey(null);
    }
  };

  return <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Clínicas · Entitlements</p>
        <h2 className="mt-1 font-display text-xl font-bold">Módulos liberados por clínica</h2>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-fog">Control-plane SaaS. Entitlement define o que a clínica contratou; profissão, capability e configuração interna continuam independentes.</p>
      </div>
      <label className="w-full sm:w-80">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-fog">Clínica</span>
        <select value={clinicId} onChange={(event) => setClinicId(event.target.value)} disabled={loading || clinics.length === 0} className="mt-1.5 w-full rounded-xl border border-line bg-deep px-3 py-2.5 text-[12px] text-paper outline-none focus:border-aqua disabled:opacity-50">
          {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
        </select>
      </label>
    </div>

    <div className="mt-4 rounded-xl border border-aqua/20 bg-aqua/[0.04] px-4 py-3 text-[11.5px] leading-relaxed text-fog">
      <strong className="text-paper">Três estados:</strong> Herdado remove a decisão explícita. Nos módulos comuns, ausência de configuração mantém o rollout compatível; no Nexus, ausência de configuração é bloqueada por segurança.
    </div>

    {selectedClinic && <div className="mt-4 rounded-xl border border-line/70 bg-deep/55 px-4 py-3"><p className="font-display text-[13px] font-semibold">{selectedClinic.name}</p><p className="mt-1 font-mono text-[9.5px] text-fog">{selectedClinic.id}{selectedClinic.cnpj ? ` · CNPJ ${selectedClinic.cnpj}` : ''}</p></div>}
    {error && <div className="mt-4 rounded-xl border border-amber/35 bg-amber/5 p-3 text-[12.5px] text-amber">{error}</div>}

    <div className="mt-4 divide-y divide-line/60">
      {entitlements.map((item) => {
        const meta = ENTITLEMENT_META[item.key];
        const mode = modeOf(item);
        return <div key={item.key} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-[14px] font-semibold">{meta.title}</p>
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] ${!item.configured ? 'border-aqua/30 text-aqua' : item.enabled ? 'border-mint/30 text-mint' : 'border-line text-fog'}`}>{modeLabel(item)}</span>
              {item.source && <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] text-fog">{item.source}</span>}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-fog">{meta.description}</p>
            <p className="mt-1 font-mono text-[9.5px] text-fog/60">{item.key}{item.updatedAt ? ` · atualizado ${new Date(item.updatedAt).toLocaleString('pt-BR')}` : ' · sem decisão explícita'}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 lg:justify-end" role="group" aria-label={`Estado de ${meta.title}`}>
            {([
              ['inherited', 'Herdado'],
              ['enabled', 'Liberado'],
              ['disabled', 'Bloqueado'],
            ] as Array<[EntitlementMode, string]>).map(([candidate, label]) => (
              <button
                key={candidate}
                type="button"
                disabled={busyKey !== null || loading}
                onClick={() => void setMode(item, candidate)}
                className={`rounded-lg border px-3 py-2 text-[10.5px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-50 ${mode === candidate ? 'border-mint/50 bg-mint/10 text-mint' : 'border-line bg-deep text-fog hover:text-paper'}`}
                aria-pressed={mode === candidate}
              >{label}</button>
            ))}
          </div>
        </div>;
      })}
      {!loading && clinicId && entitlements.length === 0 && <p className="py-5 text-[12px] text-fog">Nenhum entitlement retornado para esta clínica.</p>}
      {!loading && clinics.length === 0 && <p className="py-5 text-[12px] text-fog">Nenhuma clínica ativa encontrada.</p>}
    </div>
  </section>;
}
