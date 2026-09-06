import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { PlatformClinicEntitlementsPanel } from '../components/PlatformClinicEntitlementsPanel';
import { PlatformClinicLifecyclePanel } from '../components/PlatformClinicLifecyclePanel';
import { loadPlatformClinics, type PlatformClinicSummary } from '../lib/platformAdmin';
import { getCachedPlatformAdminAccess, validatePlatformAdminAccess } from '../lib/platformAdminAccess';
import { platformSupabase } from '../lib/platformSupabaseClient';

export function PlatformClinicModulesPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(() => getCachedPlatformAdminAccess());
  const [clinics, setClinics] = useState<PlatformClinicSummary[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoadingClinics(true);
    setError(null);
    try {
      setClinics(await loadPlatformClinics());
    } catch (cause) {
      console.error('[Platform Admin] clients overview:', cause);
      setError('Não foi possível carregar o resumo da base de clientes.');
    } finally {
      setLoadingClinics(false);
    }
  };

  useEffect(() => {
    let active = true;
    const validate = async () => {
      try {
        const allowed = await validatePlatformAdminAccess();
        if (!active) return;
        setAuthorized(allowed);
        if (allowed) void loadOverview();
      } catch (cause) {
        console.error('[Platform Admin] modules authorization:', cause);
        if (active) setAuthorized(false);
      }
    };
    void platformSupabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) setAuthorized(false);
      else void validate();
    });
    const { data: listener } = platformSupabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setAuthorized(false);
        setClinics([]);
      } else void validate();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const activeClinics = useMemo(() => clinics.filter((clinic) => clinic.lifecycleStatus === 'active').length, [clinics]);
  const suspendedClinics = clinics.length - activeClinics;
  const newestClinic = useMemo(() => [...clinics].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] ?? null, [clinics]);

  if (authorized === null) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando privilégios da plataforma…</div>;

  if (!authorized) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <div className="w-full max-w-lg rounded-2xl border border-pulse/30 bg-panel p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse">Acesso negado</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Esta área exige Platform Admin</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-fog">Lifecycle e entitlements são governança SaaS e não pertencem aos papéis internos da clínica.</p>
          <Link to="/platform" className="mt-6 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar para a central</Link>
        </div>
      </div>
    );
  }

  return (
    <PlatformAdminShell
      eyebrow="Clientes & Plataforma"
      title="Base de clientes"
      description="Gerencie lifecycle, módulos contratados e fronteiras de acesso sem misturar governança SaaS com permissões internas do tenant."
      actions={<button type="button" onClick={() => void loadOverview()} disabled={loadingClinics} className="rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[11px] font-semibold text-fog transition hover:border-mint/35 hover:text-paper disabled:opacity-50">{loadingClinics ? 'Atualizando…' : 'Atualizar base'}</button>}
    >
      {error && <div className="rounded-xl border border-amber/35 bg-amber/[0.05] px-4 py-3 text-[12px] text-amber">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.7fr]">
        <div className="relative overflow-hidden rounded-[26px] border border-aqua/20 bg-gradient-to-br from-aqua/[0.09] via-panel to-panel p-6 md:p-7">
          <div className="pointer-events-none absolute -right-14 -top-20 h-60 w-60 rounded-full bg-aqua/[0.08] blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-aqua">Control plane</p>
            <h2 className="mt-2 font-display text-[27px] font-bold leading-tight tracking-tight md:text-[31px]">Cada clínica com acesso, módulos e lifecycle sob controle explícito.</h2>
            <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-fog">Nexus, Financeiro, CRM, Relatórios, Avaliações customizadas e WhatsApp continuam separados do papel que cada usuário exerce dentro da clínica.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/platform/provisionar" className="rounded-xl bg-mint px-4 py-3 text-[11.5px] font-semibold text-on-accent">Novo onboarding →</Link>
              <Link to="/platform/governanca" className="rounded-xl border border-line bg-panel/80 px-4 py-3 text-[11.5px] font-semibold text-paper">Abrir governança</Link>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-line bg-panel p-5.5 shadow-[0_14px_36px_rgba(3,16,48,0.045)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Base atual</p>
          <p className="mt-2 font-display text-[34px] font-bold tracking-tight">{clinics.length}</p>
          <p className="mt-1 text-[11px] text-fog">clínica(s) cadastrada(s)</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniMetric label="Ativas" value={String(activeClinics)} tone="text-mint" />
            <MiniMetric label="Suspensas" value={String(suspendedClinics)} tone={suspendedClinics ? 'text-amber' : 'text-fog'} />
          </div>
          <div className="mt-4 border-t border-line/60 pt-3 text-[10.5px] text-fog">
            {newestClinic ? <>Última entrada: <span className="font-semibold text-paper">{newestClinic.name}</span></> : 'Nenhuma clínica disponível.'}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <FlowCard step="01" title="Onboarding" text="Solicitação aprovada cria tenant e primeiro owner com trilha auditável." />
        <FlowCard step="02" title="Lifecycle" text="Ativar, suspender e reativar o acesso SaaS sem apagar dados do tenant." />
        <FlowCard step="03" title="Entitlements" text="Definir exatamente quais módulos a clínica contratou e pode utilizar." />
      </section>

      <PlatformClinicLifecyclePanel />
      <PlatformClinicEntitlementsPanel />
    </PlatformAdminShell>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="rounded-2xl border border-line/70 bg-deep/50 p-3.5"><p className="text-[10px] text-fog">{label}</p><p className={`mt-1 font-display text-[22px] font-bold ${tone}`}>{value}</p></div>;
}

function FlowCard({ step, title, text }: { step: string; title: string; text: string }) {
  return <article className="rounded-[20px] border border-line bg-panel p-4.5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-aqua/20 bg-aqua/[0.06] text-[10px] font-bold text-aqua">{step}</span><div><p className="font-display text-[13.5px] font-semibold">{title}</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-fog">{text}</p></div></div></article>;
}
