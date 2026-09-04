import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { isPlatformAdmin } from '../lib/platformAdmin';

export function PlatformAdminHomePage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validate = async () => {
    try {
      setAuthorized(await isPlatformAdmin());
    } catch (cause) {
      console.error('[Platform Admin] home authorization:', cause);
      setAuthorized(false);
    }
  };

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) setAuthorized(false);
      else void validate();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) setAuthorized(false);
      else void validate();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(signInError.message);
      setAuthorized(false);
      return;
    }
    await validate();
  };

  if (authorized === null) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando sessão da plataforma…</div>;

  if (!authorized) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <form onSubmit={signIn} className="w-full max-w-md rounded-2xl border border-line bg-panel p-7 shadow-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mint">MedicsPro Platform</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Administração da plataforma</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-fog">Entrada separada das clínicas. Owner/admin de tenant não recebe privilégios SaaS.</p>
          {error && <div className="mt-5 rounded-xl border border-amber/35 bg-amber/5 p-3 text-[12.5px] text-amber">{error}</div>}
          <label className="mt-6 block text-[12px] font-semibold text-paper/80">Email
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="mt-4 block text-[12px] font-semibold text-paper/80">Senha
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="mt-6 w-full rounded-xl bg-mint px-4 py-3 font-display font-semibold text-on-accent disabled:opacity-50" disabled={!email || !password}>Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-surface min-h-screen">
      <header className="border-b border-line/70 bg-deep/90 px-5 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mint">MedicsPro Platform Admin</p>
            <h1 className="font-display text-xl font-bold">Central da plataforma</h1>
          </div>
          <button onClick={() => void supabase.auth.signOut()} className="ml-auto text-[11px] font-semibold text-pulse hover:underline">Encerrar sessão</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-5 md:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Link to="/platform/governanca" className="rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-aqua/50 hover:bg-raise">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Governança</p>
            <h2 className="mt-2 font-display text-xl font-bold">Automações e observabilidade</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-fog">Controles globais, saúde dos ciclos e trilha de auditoria da plataforma.</p>
          </Link>
          <Link to="/platform/modulos" className="rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-aqua/50 hover:bg-raise">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Entitlements</p>
            <h2 className="mt-2 font-display text-xl font-bold">Módulos por clínica</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-fog">Libere Nexus, Financeiro, CRM, Relatórios, Avaliações customizadas e WhatsApp sem misturar permissões clínicas.</p>
          </Link>
          <Link to="/platform/provisionar" className="rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-mint/50 hover:bg-raise">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mint">Onboarding</p>
            <h2 className="mt-2 font-display text-xl font-bold">Criar clínica e primeiro owner</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-fog">Provisionamento server-side idempotente, mantendo separação entre SaaS e tenant.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
