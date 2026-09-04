import { useEffect, useMemo, useState } from 'react';
import {
  loadPlatformAuditLog,
  loadPlatformClinicEntitlements,
  loadPlatformClinics,
  setPlatformClinicEntitlement,
  type PlatformAuditEntry,
  type PlatformClinicEntitlement,
  type PlatformClinicEntitlementKey,
  type PlatformClinicSummary,
} from '../lib/platformAdmin';

const ENTITLEMENT_META: Record<PlatformClinicEntitlementKey, { title: string; description: string }> = {
  'nexus.access': { title: 'Nexus', description: 'Disponibiliza o Clinical Intelligence Engine para a clínica; capabilities continuam separadas.' },
  'finance.access': { title: 'Financeiro', description: 'Disponibiliza os módulos financeiros contratados para a clínica.' },
  'crm.access': { title: 'CRM', description: 'Disponibiliza CRM e fluxos comerciais/relacionais para a clínica.' },
  'reports.access': { title: 'Relatórios', description: 'Disponibiliza relatórios e visões analíticas contratadas.' },
  'assessments.custom': { title: 'Avaliações customizadas', description: 'Permite à clínica manter e publicar suas próprias avaliações estruturadas.' },
  'whatsapp.access': { title: 'WhatsApp', description: 'Disponibiliza recursos de mensageria; configuração do provedor permanece separada.' },
};

function Switch({ enabled, disabled, onClick }: { enabled: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" role="switch" aria-checked={enabled} disabled={disabled} onClick={onClick} className={`relative h-7 w-12 rounded-full border transition-colors disabled:cursor-wait disabled:opacity-60 ${enabled ? 'border-mint/60 bg-mint/25' : 'border-line bg-deep'}`}><span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${enabled ? 'left-6 bg-mint' : 'left-1 bg-fog/70'}`} /></button>;
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
      setClinicId((current) => current || items[0]?.id || '');
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

  const toggle = async (item: PlatformClinicEntitlement) => {
    if (!clinicId || busyKey) return;
    const next = !item.enabled;
    if (item.key === 'nexus.access' && !next && !window.confirm(`Desativar Nexus para ${selectedClinic?.name ?? 'esta clínica'}? Isto não altera capabilities, mas remove o entitlement contratual quando o enforcement for conectado.`)) return;

    setBusyKey(item.key);
    setError(null);
    try {
      const updated = await setPlatformClinicEntitlement({ clinicId, key: item.key, enabled: next, source: 'manual' });
      setEntitlements((current) => current.map((entry) => entry.key === updated.key ? updated : entry));
      onAuditChanged?.(await loadPlatformAuditLog(40));
    } catch (cause) {
      console.error('[Platform Admin] entitlement:', cause);
      setError('Não foi possível alterar o módulo. O estado anterior foi preservado.');
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

    {selectedClinic && <div className="mt-4 rounded-xl border border-line/70 bg-deep/55 px-4 py-3"><p className="font-display text-[13px] font-semibold">{selectedClinic.name}</p><p className="mt-1 font-mono text-[9.5px] text-fog">{selectedClinic.id}{selectedClinic.cnpj ? ` · CNPJ ${selectedClinic.cnpj}` : ''}</p></div>}
    {error && <div className="mt-4 rounded-xl border border-amber/35 bg-amber/5 p-3 text-[12.5px] text-amber">{error}</div>}

    <div className="mt-4 divide-y divide-line/60">
      {entitlements.map((item) => {
        const meta = ENTITLEMENT_META[item.key];
        return <div key={item.key} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><p className="font-display text-[14px] font-semibold">{meta.title}</p><span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] text-fog">{item.source}</span></div><p className="mt-1 text-[12px] leading-relaxed text-fog">{meta.description}</p><p className="mt-1 font-mono text-[9.5px] text-fog/60">{item.key}{item.updatedAt !== '1970-01-01T00:00:00+00:00' ? ` · atualizado ${new Date(item.updatedAt).toLocaleString('pt-BR')}` : ' · ainda não configurado'}</p></div>
          <div className="flex items-center gap-2 md:justify-end"><span className={`text-[11px] font-semibold ${item.enabled ? 'text-mint' : 'text-fog'}`}>{item.enabled ? 'Liberado' : 'Bloqueado'}</span><Switch enabled={item.enabled} disabled={busyKey !== null || loading} onClick={() => void toggle(item)} /></div>
        </div>;
      })}
      {!loading && clinicId && entitlements.length === 0 && <p className="py-5 text-[12px] text-fog">Nenhum entitlement retornado para esta clínica.</p>}
      {!loading && clinics.length === 0 && <p className="py-5 text-[12px] text-fog">Nenhuma clínica ativa encontrada.</p>}
    </div>
  </section>;
}
