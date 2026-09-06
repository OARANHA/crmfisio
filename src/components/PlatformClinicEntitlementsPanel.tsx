import { useEffect, useMemo, useState } from 'react';
import {
  loadPlatformAuditLog,
  loadPlatformClinicEntitlements,
  resetPlatformClinicEntitlement,
  setPlatformClinicEntitlement,
  type PlatformAuditEntry,
  type PlatformClinicEntitlement,
  type PlatformClinicEntitlementKey,
  type PlatformClinicSummary,
} from '../lib/platformAdmin';

const SELECTED_CLINIC_STORAGE_KEY = 'medicspro-platform-selected-clinic';

const ENTITLEMENT_META: Record<PlatformClinicEntitlementKey, { title: string; description: string; icon: string }> = {
  'nexus.access': { title: 'Nexus', description: 'Clinical Intelligence Engine da clínica; capabilities profissionais continuam separadas.', icon: '✦' },
  'finance.access': { title: 'Financeiro', description: 'Módulos financeiros contratados pela clínica.', icon: '₿' },
  'crm.access': { title: 'CRM', description: 'CRM e fluxos de relacionamento internos da clínica.', icon: '↗' },
  'reports.access': { title: 'Relatórios', description: 'Relatórios e visões analíticas contratadas.', icon: '▥' },
  'assessments.custom': { title: 'Avaliações customizadas', description: 'Criação e publicação de avaliações próprias estruturadas.', icon: '◎' },
  'whatsapp.access': { title: 'WhatsApp', description: 'Mensageria habilitada; configuração do provedor permanece separada.', icon: '◌' },
};

type EntitlementMode = 'inherited' | 'enabled' | 'disabled';

type Props = {
  clinics: PlatformClinicSummary[];
  clinicsLoading?: boolean;
  onAuditChanged?: (items: PlatformAuditEntry[]) => void;
};

function modeOf(item: PlatformClinicEntitlement): EntitlementMode {
  if (!item.configured) return 'inherited';
  return item.enabled ? 'enabled' : 'disabled';
}

function modeLabel(item: PlatformClinicEntitlement): string {
  if (!item.configured) return item.key === 'nexus.access' ? 'Não configurado' : 'Herdado';
  return item.enabled ? 'Liberado' : 'Bloqueado';
}

export function PlatformClinicEntitlementsPanel({ clinics, clinicsLoading = false, onAuditChanged }: Props) {
  const [clinicId, setClinicId] = useState('');
  const [entitlements, setEntitlements] = useState<PlatformClinicEntitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<PlatformClinicEntitlementKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedClinic = useMemo(() => clinics.find((item) => item.id === clinicId) ?? null, [clinics, clinicId]);
  const enabledCount = useMemo(() => entitlements.filter((item) => item.configured && item.enabled).length, [entitlements]);
  const blockedCount = useMemo(() => entitlements.filter((item) => item.configured && !item.enabled).length, [entitlements]);
  const inheritedCount = entitlements.length - enabledCount - blockedCount;

  useEffect(() => {
    if (clinicsLoading) return;
    const storedClinicId = window.localStorage.getItem(SELECTED_CLINIC_STORAGE_KEY);
    const storedClinicStillExists = storedClinicId && clinics.some((item) => item.id === storedClinicId);
    setClinicId((current) => {
      if (current && clinics.some((item) => item.id === current)) return current;
      return storedClinicStillExists ? storedClinicId : (clinics[0]?.id || '');
    });
  }, [clinics, clinicsLoading]);

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
        setEntitlements(await loadPlatformClinicEntitlements(clinicId));
      } else {
        const updated = await setPlatformClinicEntitlement({ clinicId, key: item.key, enabled: nextMode === 'enabled', source: 'manual' });
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

  return <section className="rounded-[22px] border border-line bg-panel p-5 md:p-6">
    <div className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-aqua">Entitlements</p>
        <h2 className="mt-1 font-display text-[19px] font-bold">Módulos contratados por clínica</h2>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">Entitlement define o produto contratado. Papel do usuário, profissão, capability e configuração interna continuam sendo controles independentes.</p>
      </div>
      <label className="w-full sm:w-[340px]">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-fog">Clínica selecionada</span>
        <select value={clinicId} onChange={(event) => setClinicId(event.target.value)} disabled={clinicsLoading || loading || clinics.length === 0} className="mt-1.5 w-full rounded-xl border border-line bg-deep/55 px-3.5 py-3 text-[11.5px] text-paper outline-none transition focus:border-aqua disabled:opacity-50">
          {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
        </select>
      </label>
    </div>

    {selectedClinic && <div className="mt-4 grid gap-3 border-t border-line/60 pt-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-display text-[14px] font-semibold">{selectedClinic.name}</p><p className="mt-1 text-[10px] text-fog">{selectedClinic.cnpj ? `CNPJ ${selectedClinic.cnpj}` : 'CNPJ não informado'} · {selectedClinic.lifecycleStatus === 'active' ? 'clínica ativa' : 'clínica suspensa'}</p></div><div className="flex flex-wrap gap-2"><SummaryChip label="Liberados" value={enabledCount} tone="mint" /><SummaryChip label="Bloqueados" value={blockedCount} tone="amber" /><SummaryChip label="Herdados" value={inheritedCount} tone="aqua" /></div></div>}

    <div className="mt-4 rounded-2xl border border-aqua/20 bg-aqua/[0.04] px-4 py-3 text-[11px] leading-relaxed text-fog"><strong className="text-paper">Regra importante:</strong> módulos comuns podem herdar o rollout quando não configurados. Nexus permanece bloqueado sem liberação explícita.</div>
    {error && <div className="mt-4 rounded-xl border border-amber/35 bg-amber/5 p-3 text-[12.5px] text-amber">{error}</div>}

    <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {entitlements.map((item) => {
        const meta = ENTITLEMENT_META[item.key];
        const mode = modeOf(item);
        const statusClass = mode === 'enabled' ? 'border-mint/30 bg-mint/[0.06] text-mint' : mode === 'disabled' ? 'border-amber/30 bg-amber/[0.06] text-amber' : 'border-aqua/25 bg-aqua/[0.05] text-aqua';
        return <article key={item.key} className="rounded-2xl border border-line/70 bg-deep/45 p-4 transition hover:border-aqua/25">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-aqua/20 bg-aqua/[0.06] text-[14px] text-aqua">{meta.icon}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-display text-[13.5px] font-semibold">{meta.title}</p><span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${statusClass}`}>{modeLabel(item)}</span></div><p className="mt-1.5 text-[10.5px] leading-relaxed text-fog">{meta.description}</p></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1.5" role="group" aria-label={`Estado de ${meta.title}`}>
            {([['inherited', 'Herdado'], ['enabled', 'Liberado'], ['disabled', 'Bloqueado']] as Array<[EntitlementMode, string]>).map(([candidate, label]) => <button key={candidate} type="button" disabled={busyKey !== null || loading} onClick={() => void setMode(item, candidate)} className={`rounded-lg border px-2 py-2.5 text-[10px] font-semibold transition disabled:cursor-wait disabled:opacity-50 ${mode === candidate ? candidate === 'enabled' ? 'border-mint/45 bg-mint/[0.08] text-mint' : candidate === 'disabled' ? 'border-amber/45 bg-amber/[0.08] text-amber' : 'border-aqua/40 bg-aqua/[0.07] text-aqua' : 'border-line bg-panel/40 text-fog hover:text-paper'}`} aria-pressed={mode === candidate}>{label}</button>)}
          </div>
          <p className="mt-3 border-t border-line/50 pt-2 text-[9.5px] text-fog/65">{item.source ? `Fonte: ${item.source}` : 'Sem decisão explícita'}{item.updatedAt ? ` · atualizado ${new Date(item.updatedAt).toLocaleString('pt-BR')}` : ''}</p>
        </article>;
      })}
      {!loading && clinicId && entitlements.length === 0 && <div className="lg:col-span-2 2xl:col-span-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[11.5px] text-fog">Nenhum entitlement retornado para esta clínica.</div>}
      {!clinicsLoading && !loading && clinics.length === 0 && <div className="lg:col-span-2 2xl:col-span-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[11.5px] text-fog">Nenhuma clínica encontrada.</div>}
    </div>
  </section>;
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: 'mint' | 'amber' | 'aqua' }) {
  const className = tone === 'mint' ? 'text-mint' : tone === 'amber' ? 'text-amber' : 'text-aqua';
  return <span className="rounded-xl border border-line bg-deep/55 px-3 py-2 text-[10px] text-fog"><strong className={`mr-1 font-display text-[14px] ${className}`}>{value}</strong>{label}</span>;
}
