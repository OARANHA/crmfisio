import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignPlatformClinicPlan,
  cancelPlatformClinicPlan,
  createPlatformPlan,
  loadPlatformClinicPlanAssignment,
  loadPlatformPlans,
  publishPlatformPlanVersion,
  setPlatformPlanActive,
  PlatformPlanCatalogUnavailableError,
  type PlatformClinicEntitlementKey,
  type PlatformClinicPlanAssignment,
  type PlatformClinicPlanStatus,
  type PlatformClinicSummary,
  type PlatformPlanEntitlements,
  type PlatformPlanSummary,
} from '../lib/platformAdmin';

const ENTITLEMENTS: Array<{ key: PlatformClinicEntitlementKey; label: string }> = [
  { key: 'finance.access', label: 'Financeiro' },
  { key: 'crm.access', label: 'CRM' },
  { key: 'reports.access', label: 'Relatórios' },
  { key: 'whatsapp.access', label: 'WhatsApp' },
  { key: 'assessments.custom', label: 'Avaliações customizadas' },
  { key: 'nexus.access', label: 'Nexus' },
];
const emptyEntitlements = (): PlatformPlanEntitlements => ({
  'nexus.access': false,
  'finance.access': false,
  'crm.access': false,
  'reports.access': false,
  'assessments.custom': false,
  'whatsapp.access': false,
});

type Props = {
  clinics: PlatformClinicSummary[];
  clinicId: string;
  onClinicIdChange: (clinicId: string) => void;
  onAssignmentChanged?: () => void;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

export function PlatformClinicPlanPanel({ clinics, clinicId, onClinicIdChange, onAssignmentChanged }: Props) {
  const [plans, setPlans] = useState<PlatformPlanSummary[]>([]);
  const [assignment, setAssignment] = useState<PlatformClinicPlanAssignment | null>(null);
  const [catalogAvailable, setCatalogAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [status, setStatus] = useState<PlatformClinicPlanStatus>('active');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planKey, setPlanKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entitlements, setEntitlements] = useState<PlatformPlanEntitlements>(() => emptyEntitlements());

  const activePlans = useMemo(() => plans.filter((plan) => plan.active), [plans]);
  const selectedClinic = useMemo(() => clinics.find((clinic) => clinic.id === clinicId) ?? null, [clinics, clinicId]);

  const refreshPlans = useCallback(async (): Promise<boolean> => {
    try {
      const next = await loadPlatformPlans();
      setPlans(next);
      setSelectedVersionId((current) => next.some((plan) => plan.active && plan.versionId === current)
        ? current
        : next.find((plan) => plan.active)?.versionId || '');
      return true;
    } catch (cause) {
      if (cause instanceof PlatformPlanCatalogUnavailableError) {
        setPlans([]);
        setSelectedVersionId('');
        return false;
      }
      throw cause;
    }
  }, []);

  const refreshAssignment = useCallback(async (): Promise<boolean> => {
    if (!clinicId) { setAssignment(null); return true; }
    try {
      setAssignment(await loadPlatformClinicPlanAssignment(clinicId));
      return true;
    } catch (cause) {
      if (cause instanceof PlatformPlanCatalogUnavailableError) {
        setAssignment(null);
        return false;
      }
      throw cause;
    }
  }, [clinicId]);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null); setCatalogAvailable(null);
    try {
      const [plansAvailable, assignmentAvailable] = await Promise.all([refreshPlans(), refreshAssignment()]);
      setCatalogAvailable(plansAvailable && assignmentAvailable);
    } catch (cause) {
      console.error('[Platform Admin] plan catalog:', cause);
      setError('Não foi possível carregar o catálogo de planos.');
    } finally {
      setLoading(false);
    }
  }, [refreshPlans, refreshAssignment]);

  useEffect(() => { void refresh(); }, [refresh]);

  const resetPlanForm = () => {
    setEditingPlanId(null);
    setPlanKey('');
    setName('');
    setDescription('');
    setEntitlements(emptyEntitlements());
  };

  const startVersion = (plan: PlatformPlanSummary) => {
    setEditingPlanId(plan.planId);
    setPlanKey(plan.planKey);
    setName(plan.name);
    setDescription(plan.description);
    setEntitlements({ ...plan.entitlements });
  };
  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || (!editingPlanId && !planKey.trim()) || busy) return;
    setBusy(true); setError(null);
    try {
      if (editingPlanId) {
        await publishPlatformPlanVersion({ planId: editingPlanId, name: name.trim(), description, entitlements });
      } else {
        await createPlatformPlan({ planKey: planKey.trim(), name: name.trim(), description, entitlements, active: true });
      }
      resetPlanForm();
      await refreshPlans();
    } catch (cause) {
      console.error('[Platform Admin] plan save:', cause);
      setError('Não foi possível salvar o plano. Verifique chave, versão e sessão do Platform Admin.');
    } finally {
      setBusy(false);
    }
  };

  const togglePlan = async (plan: PlatformPlanSummary) => {
    if (busy) return;
    if (plan.active && !window.confirm(`Desativar “${plan.name}” para novas atribuições? Assignments existentes permanecem históricos e efetivos.`)) return;
    setBusy(true); setError(null);
    try { await setPlatformPlanActive(plan.planId, !plan.active); await refreshPlans(); }
    catch (cause) { console.error('[Platform Admin] plan active:', cause); setError('Não foi possível alterar o estado do plano.'); }
    finally { setBusy(false); }
  };
  const assign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clinicId || !selectedVersionId || busy) return;
    if (status === 'trialing' && !trialEndsAt) { setError('Informe o fim do trial.'); return; }
    setBusy(true); setError(null);
    try {
      await assignPlatformClinicPlan({
        clinicId,
        planVersionId: selectedVersionId,
        status,
        trialEndsAt: status === 'trialing' ? new Date(trialEndsAt).toISOString() : null,
        reason: reason.trim() || null,
      });
      setReason('');
      await refreshAssignment();
      onAssignmentChanged?.();
    } catch (cause) {
      console.error('[Platform Admin] clinic plan assignment:', cause);
      setError('Não foi possível atribuir o plano. O estado anterior foi preservado.');
    } finally { setBusy(false); }
  };

  const cancelAssignment = async () => {
    if (!clinicId || !assignment || busy) return;
    if (!window.confirm(`Encerrar o plano atual de ${selectedClinic?.name ?? 'esta clínica'}? Overrides explícitos permanecem preservados.`)) return;
    setBusy(true); setError(null);
    try { await cancelPlatformClinicPlan(clinicId, 'Encerrado pelo Platform Admin'); await refreshAssignment(); onAssignmentChanged?.(); }
    catch (cause) { console.error('[Platform Admin] cancel assignment:', cause); setError('Não foi possível encerrar o plano atual.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-[22px] border border-line bg-panel p-5 md:p-6">
    <div className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-mint">Plano comercial</p>
        <h2 className="mt-1 font-display text-[19px] font-bold">Catálogo versionado + assignment da clínica</h2>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">O plano define a baseline comercial dos módulos. Overrides explícitos continuam separados e sempre vencem a baseline.</p>
      </div>
      <label className="w-full sm:w-[340px]">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-fog">Clínica selecionada</span>
        <select value={clinicId} onChange={(event) => onClinicIdChange(event.target.value)} disabled={loading || clinics.length === 0} className="mt-1.5 w-full rounded-xl border border-line bg-deep/55 px-3.5 py-3 text-[11.5px] text-paper outline-none focus:border-mint disabled:opacity-50">
          {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
        </select>
      </label>
    </div>

    {error && <div className="mt-4 rounded-xl border border-amber/35 bg-amber/[0.05] p-3 text-[12px] text-amber">{error}</div>}
    {catalogAvailable === null && !error && <div className="mt-4 rounded-2xl border border-line bg-deep/35 px-4 py-4 text-[11px] text-fog">Verificando contrato do Plan Catalog…</div>}
    {catalogAvailable === false && <div className="mt-4 rounded-2xl border border-aqua/25 bg-aqua/[0.05] px-4 py-4 text-[11px] leading-relaxed text-fog"><strong className="text-paper">Catálogo aguardando promoção do backend.</strong> Os entitlements existentes continuam disponíveis abaixo pelo contrato anterior, mas criar, versionar ou atribuir planos permanece desabilitado até a migration do Control Plane estar presente.</div>}

    {catalogAvailable === true && <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-2xl border border-line/70 bg-deep/35 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-aqua">Assignment atual</p>
        {assignment ? <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-mint/20 bg-mint/[0.05] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-[15px] font-semibold">{assignment.name}</p>
              <span className="rounded-full border border-mint/25 px-2 py-0.5 text-[9px] font-semibold text-mint">v{assignment.version}</span>
              <span className="rounded-full border border-aqua/25 px-2 py-0.5 text-[9px] font-semibold text-aqua">{assignment.status === 'trialing' ? 'trial' : 'ativo'}</span>
            </div>
            <p className="mt-1 text-[10px] text-fog">{assignment.planKey} · desde {formatDate(assignment.startsAt)}</p>
            {assignment.trialEndsAt && <p className="mt-1 text-[10px] text-amber">Trial até {formatDate(assignment.trialEndsAt)}</p>}
          </div>
          <button type="button" onClick={() => void cancelAssignment()} disabled={busy} className="w-full rounded-xl border border-amber/30 px-3 py-2.5 text-[10.5px] font-semibold text-amber disabled:opacity-50">Encerrar assignment</button>
        </div> : <div className="mt-3 rounded-xl border border-dashed border-line p-5 text-center text-[11px] text-fog">Sem plano atribuído. Os módulos seguem overrides explícitos ou rollout legado.</div>}

        <form onSubmit={assign} className="mt-4 space-y-3 border-t border-line/60 pt-4">
          <select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)} disabled={busy || !activePlans.length} className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-[11px] outline-none">
            <option value="">Selecione um plano ativo</option>
            {activePlans.map((plan) => <option key={plan.versionId} value={plan.versionId}>{plan.name} · v{plan.version}</option>)}
          </select>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={status} onChange={(event) => setStatus(event.target.value as PlatformClinicPlanStatus)} className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[11px] outline-none">
              <option value="active">Plano ativo</option>
              <option value="trialing">Trial</option>
            </select>
            <input type="datetime-local" value={trialEndsAt} onChange={(event) => setTrialEndsAt(event.target.value)} disabled={status !== 'trialing'} className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[11px] outline-none disabled:opacity-40" />
          </div>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo / observação (opcional)" className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-[11px] outline-none" />
          <button type="submit" disabled={busy || !clinicId || !selectedVersionId} className="w-full rounded-xl bg-mint px-3 py-2.5 text-[11px] font-semibold text-on-accent disabled:opacity-50">Atribuir plano</button>
        </form>
      </div>

      <div className="rounded-2xl border border-line/70 bg-deep/35 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-aqua">Catálogo</p><p className="mt-1 text-[11px] text-fog">Versões publicadas são imutáveis; mudanças comerciais geram nova versão.</p></div>
          <button type="button" onClick={resetPlanForm} disabled={busy} className="rounded-xl border border-line px-3 py-2 text-[10px] font-semibold text-paper">Novo plano</button>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {plans.map((plan) => <article key={plan.planId} className="rounded-xl border border-line/70 bg-panel/55 p-3.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><p className="font-display text-[13px] font-semibold">{plan.name}</p><p className="mt-0.5 text-[9.5px] text-fog">{plan.planKey} · v{plan.version}</p></div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${plan.active ? 'border-mint/25 text-mint' : 'border-fog/25 text-fog'}`}>{plan.active ? 'ativo' : 'inativo'}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">{ENTITLEMENTS.map(({ key, label }) => <span key={key} className={`rounded-full border px-2 py-1 text-[8.5px] ${plan.entitlements[key] ? 'border-aqua/25 text-aqua' : 'border-line text-fog/60'}`}>{label}</span>)}</div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => startVersion(plan)} disabled={busy} className="flex-1 rounded-lg border border-line px-2 py-2 text-[9.5px] font-semibold text-paper">Nova versão</button>
              <button type="button" onClick={() => void togglePlan(plan)} disabled={busy} className="rounded-lg border border-line px-2 py-2 text-[9.5px] font-semibold text-fog">{plan.active ? 'Desativar' : 'Ativar'}</button>
            </div>
          </article>)}
          {!plans.length && <div className="lg:col-span-2 rounded-xl border border-dashed border-line p-5 text-center text-[11px] text-fog">Nenhum plano publicado ainda.</div>}
        </div>

        <form onSubmit={savePlan} className="mt-4 border-t border-line/60 pt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={planKey} onChange={(event) => setPlanKey(event.target.value)} disabled={Boolean(editingPlanId)} placeholder="chave-estavel" className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[11px] outline-none disabled:opacity-50" />
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome comercial" className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[11px] outline-none" />
          </div>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição curta (opcional)" rows={2} className="mt-2 w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-[11px] outline-none" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ENTITLEMENTS.map(({ key, label }) => <label key={key} className="flex items-center gap-2 rounded-xl border border-line bg-panel/45 px-3 py-2.5 text-[10px] text-fog">
              <input type="checkbox" checked={entitlements[key]} onChange={(event) => setEntitlements((current) => ({ ...current, [key]: event.target.checked }))} />
              <span>{label}</span>
            </label>)}
          </div>
          <div className="mt-3 flex gap-2">
            {editingPlanId && <button type="button" onClick={resetPlanForm} disabled={busy} className="rounded-xl border border-line px-3 py-2.5 text-[10.5px] font-semibold text-fog">Cancelar versão</button>}
            <button type="submit" disabled={busy || !name.trim() || (!editingPlanId && !planKey.trim())} className="flex-1 rounded-xl border border-aqua/30 bg-aqua/[0.06] px-3 py-2.5 text-[10.5px] font-semibold text-aqua disabled:opacity-50">{editingPlanId ? 'Publicar nova versão' : 'Criar plano'}</button>
          </div>
        </form>
      </div>
    </div>}

    <div className="mt-4 rounded-xl border border-aqua/20 bg-aqua/[0.04] px-4 py-3 text-[10.5px] leading-relaxed text-fog"><strong className="text-paper">Boundary:</strong> plano/entitlement define produto disponível; não concede role, capability, identidade clínica nem acesso a prontuário.</div>
  </section>;
}
