import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformClinicEntitlementsPanel } from '../components/PlatformClinicEntitlementsPanel';
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
          <p className="mt-3 text-[13px] leading-relaxed text-fog">Entitlements são governança SaaS e não pertencem aos papéis internos da clínica.</p>
          <Link to="/platform" className="mt-6 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar para a central</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-surface min-h-screen">
      <header className="border-b border-line/70 bg-deep/90 px-5 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mint">MedicsPro Platform Admin</p>
            <h1 className="font-display text-xl font-bold">Módulos por clínica</h1>
          </div>
          <Link to="/platform" className="ml-auto text-[11px] font-semibold text-aqua hover:underline">Central da plataforma</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
        <PlatformClinicEntitlementsPanel />
      </main>
    </div>
  );
}
