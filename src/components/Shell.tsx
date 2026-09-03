import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp, type Toast } from '../lib/store';
import { useAuth } from '../lib/useAuth';
import { ROLE_META, type ModuleKey } from '../lib/types';
import { PulseMark } from './Ecg';
import {
  IconDashboard, IconCalendar, IconUsers, IconWallet, IconTrend, IconSettings,
  IconLogout, IconMenu, IconBell, Select, IconAlert,
} from '../lib/ui';
import { IconLock, IconX, IconShield, IconWhats, IconCheck } from './icons';

const NAV: { key: ModuleKey; to: string; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { key: 'agenda', to: '/agenda', label: 'Agenda', Icon: IconCalendar },
  { key: 'pacientes', to: '/pacientes', label: 'Pacientes', Icon: IconUsers },
  { key: 'financeiro', to: '/financeiro', label: 'Financeiro', Icon: IconWallet },
  { key: 'crm', to: '/crm', label: 'CRM', Icon: IconTrend },
  { key: 'mensagens', to: '/mensagens', label: 'Mensagens', Icon: IconWhats },
  { key: 'relatorios', to: '/relatorios', label: 'Relatórios', Icon: IconTrend },
  { key: 'config', to: '/config', label: 'Configurações', Icon: IconSettings },
];

function Login() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <div className="fixed inset-0 bg-vignette pointer-events-none" />
      <div className="relative w-full max-w-md border border-line2 bg-panel shadow-2xl">
        <div className="px-7 pt-7">
          <div className="flex items-center gap-2.5">
            <PulseMark className="w-8 h-7" />
            <span className="font-display font-bold text-xl tracking-tight">MEDICSPRO<span className="text-pulse">.</span></span>
          </div>
          <h1 className="font-display text-2xl font-bold mt-4 leading-tight">Acesse o consultório</h1>
          <p className="text-fog text-[13px] mt-1.5 leading-relaxed">
            Autenticação segura com Supabase Auth. Use seu email e senha cadastrados.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rv is-in border border-amber/50 text-amber bg-deep/95 backdrop-blur px-4 py-3 shadow-xl flex items-start gap-2.5">
              <IconAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-paper leading-snug">{error}</p>
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-[12px] font-mono text-fog uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line bg-deep px-4 py-3 text-[14px] focus:border-mint focus:outline-none"
              placeholder="seu@email.com"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[12px] font-mono text-fog uppercase">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line bg-deep px-4 py-3 text-[14px] focus:border-mint focus:outline-none"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full border border-mint bg-mint/10 hover:bg-mint/20 text-mint font-display font-semibold py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <div className="px-7 pb-6 flex items-center gap-2 font-mono text-[10.5px] text-fog">
          <IconLock className="w-3.5 h-3.5 text-pulse" />
          Sessão autenticada · acesso protegido por perfil e clínica · LGPD
        </div>
      </div>
    </div>
  );
}

function Toasts() {
  const { toasts } = useApp();
  const meta: Record<Toast['kind'], { cls: string; Icon: (p: { className?: string }) => React.ReactNode }> = {
    ok: { cls: 'border-mint/50 text-mint', Icon: IconCheck },
    warn: { cls: 'border-amber/50 text-amber', Icon: IconAlert },
    info: { cls: 'border-aqua/50 text-aqua', Icon: IconBell },
  };
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]">
      {toasts.map((t) => {
        const m = meta[t.kind];
        return (
          <div key={t.id} className={`rv is-in border ${m.cls} bg-deep/95 backdrop-blur px-4 py-3 shadow-xl flex items-start gap-2.5`}>
            <m.Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-paper leading-snug">{t.msg}</p>
          </div>
        );
      })}
    </div>
  );
}

export function Shell() {
  const { user: appUser, canView, logout: appLogout, setAuthenticatedUser, transactions, consents, unidades, unidadeSel, setUnidadeSel } = useApp();
  const { user, profile, signOut, loading } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!user || !profile) {
      setAuthenticatedUser(null);
      return;
    }

    setAuthenticatedUser({
      id: user.id,
      nome: profile.nome || user.email?.split('@')[0] || 'Usuário',
      email: user.email || '',
      role: profile.role,
      registro: profile.registro || '',
      cor: profile.cor || '#cbd5e1',
      ativo: profile.ativo,
    });
  }, [user?.id, profile?.id, profile?.role, profile?.nome, profile?.cor, setAuthenticatedUser]);

  const effectiveUser = appUser;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (effectiveUser) setMobileOpen(false);
  }, [effectiveUser]);

  const handleLogout = async () => {
    if (signOut) {
      await signOut();
    } else {
      appLogout();
    }
    nav('/');
  };

  if (!effectiveUser || loading) return <Login />;

  const items = NAV.filter((n) => canView(n.key) || (effectiveUser.role === 'recep' && n.key === 'dashboard'));
  const pendencias =
    transactions.filter((t) => t.status === 'atrasado').length +
    consents.filter((c) => !c.assinado).length;
  const pad = (n: number) => String(n).padStart(2, '0');
  const rm = ROLE_META[effectiveUser.role];

  const navList = (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((n) => (
        <NavLink
          key={n.key + n.to}
          to={n.to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 font-display font-semibold text-[13.5px] border-l-2 transition-colors ${
              isActive
                ? 'border-mint bg-raise text-mint'
                : 'border-transparent text-fog hover:text-paper hover:bg-raise/50'
            }`
          }
        >
          <n.Icon className="w-4.5 h-4.5 shrink-0" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-deep/90 backdrop-blur-sm z-40">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-line">
          <PulseMark className="w-7 h-6" />
          <span className="font-display font-bold tracking-tight">MEDICSPRO<span className="text-pulse">.</span></span>
        </div>
        <div className="py-5 flex-1 overflow-y-auto">{navList}</div>
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full grid place-items-center font-display font-bold text-[12px] text-ink shrink-0" style={{ background: effectiveUser.cor || '#cbd5e1' }}>
              {effectiveUser.nome ? effectiveUser.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ').map((w) => w[0]).slice(0, 2).join('') : 'U'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display font-semibold text-[13px] leading-tight truncate">{effectiveUser.nome || 'Usuário'}</span>
              <span className={`block font-mono text-[10px] mt-0.5 ${rm?.text || 'text-fog'}`}>{rm?.label || 'Carregando...'}</span>
            </span>
            <button onClick={handleLogout} className="text-fog hover:text-pulse transition-colors" title="Sair">
              <IconLogout className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/70" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 flex flex-col border-r border-line bg-deep rv is-in">
            <div className="flex items-center justify-between px-5 h-14 border-b border-line">
              <div className="flex items-center gap-2.5">
                <PulseMark className="w-6 h-5" />
                <span className="font-display font-bold text-[15px]">MEDICSPRO<span className="text-pulse">.</span></span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-fog"><IconX className="w-5 h-5" /></button>
            </div>
            <div className="py-4 flex-1 overflow-y-auto">{navList}</div>
            <div className="border-t border-line p-4">
              <button onClick={handleLogout} className="w-full flex items-center gap-2 text-fog hover:text-pulse transition-colors font-mono text-[12px]">
                <IconLogout className="w-4 h-4" /> Encerrar sessão — {effectiveUser.nome}
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-60 relative">
        <header className="sticky top-0 z-30 h-14 border-b border-line bg-ink/90 backdrop-blur-sm flex items-center gap-3 px-4 md:px-6">
          <button className="lg:hidden text-fog hover:text-paper" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <IconMenu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 font-mono text-[10.5px] text-fog uppercase tracking-[0.14em]">
            <IconShield className="w-4 h-4 text-mint" />
            <span className="hidden sm:inline">operação ao vivo</span>
          </div>

          <Select
            value={unidadeSel}
            onChange={(e) => setUnidadeSel(e.target.value)}
            className="!w-auto !py-1 !text-[11.5px] !font-mono ml-1"
            title="Filtrar por unidade"
          >
            <option value="all">Todas as unidades</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>

          <div className="ml-auto flex items-center gap-4">
            <span className="font-mono text-[11.5px] text-fog tabular-nums hidden sm:inline">
              {pad(now.getHours())}:{pad(now.getMinutes())}<span className="text-fog/40">:{pad(now.getSeconds())}</span>
            </span>
            <span className="relative text-fog">
              <IconBell className="w-4.5 h-4.5" />
              {pendencias > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 grid place-items-center rounded-full bg-pulse text-ink font-mono text-[9px] font-semibold">{pendencias}</span>
              )}
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase text-pulse border border-pulse/40 bg-pulse/5 px-2 py-1">
              <IconLock className="w-3 h-3" /> LGPD
            </span>
          </div>
        </header>
        <main className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  );
}
