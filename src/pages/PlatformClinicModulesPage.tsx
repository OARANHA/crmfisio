import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { PlatformClinicEntitlementsPanel } from '../components/PlatformClinicEntitlementsPanel';
import { PlatformClinicLifecyclePanel } from '../components/PlatformClinicLifecyclePanel';
import { isPlatformAdmin } from '../lib/platformAdmin';
import { platformSupabase } from '../lib/platformSupabaseClient';

export function PlatformClinicModulesPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const validate = async () => {
      try {
        const allowed = await isPlatformAdmin();
        if (active) setAuthorized(allowed);
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
      if (!session) setAuthorized(false);
      else void validate();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (authorized === null) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando privilégios da plataforma…</div>;

  if (!authorized) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <div className="w-full max-w-lg rounded-2xl border border-pulse/30 bg-panel p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse">Acesso negado</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Esta área exige Platform Admin</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-fog">Entitlements e lifecycle são governança SaaS e não pertencem aos papéis internos da clínica.</p>
          <Link to="/platform" className="mt-6 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar para a central</Link>
        </div>
      </div>
    );
  }

  return (
    <PlatformAdminShell
      eyebrow="MedicsPro Platform Admin"
      title="Módulos e governança por clínica"
      description="Controle lifecycle e entitlements comerciais sem misturar governança SaaS com permissões internas do tenant."
    >
      <section className="overflow-hidden rounded-[22px] border border-aqua/20 bg-gradient-to-br from-aqua/[0.07] via-panel to-panel p-5 md:p-6">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-aqua">Controle comercial</p>
        <h2 className="mt-1 font-display text-[21px] font-bold tracking-tight">Defina o que cada clínica contratou e pode utilizar.</h2>
        <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-fog">Nexus, Financeiro, CRM, Relatórios, Avaliações customizadas e WhatsApp permanecem independentes do papel do usuário dentro da clínica.</p>
      </section>
      <PlatformClinicLifecyclePanel />
      <PlatformClinicEntitlementsPanel />
    </PlatformAdminShell>
  );
}
