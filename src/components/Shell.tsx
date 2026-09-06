import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp, type Toast } from '../lib/store';
import { useAuth } from '../lib/useAuth';
import { useInfrastructure } from '../lib/infrastructureContext';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useFinance } from '../lib/financeContext';
import { useClinical } from '../lib/clinicalContext';
import { ROLE_META, type ModuleKey } from '../lib/types';
import { PulseMark } from './Ecg';
import {
  IconDashboard, IconCalendar, IconUsers, IconWallet, IconTrend, IconSettings,
  IconLogout, IconMenu, IconBell, Select, IconAlert, IconChevronL, IconChevronR,
  IconMoon, IconSun,
} from '../lib/ui';
import { IconLock, IconX, IconShield, IconWhats, IconCheck } from './icons';
import { useColorTheme, type ColorTheme } from '../lib/colorTheme';
import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import { professionalIdentityLabel } from '../lib/professionalIdentity';
import { hasProfessionalCapability } from '../lib/nexusClinical';
import {
  isModuleVisibleByEntitlement,
  loadCurrentClinicModuleVisibility,
  type ModuleEntitlementVisibility,
} from '../lib/clinicEntitlementMenu';

const NAV: { key: ModuleKey; to: string; label: string; Icon: (p: { className?: string }) => React.ReactNode; nexus?: boolean }[] = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { key: 'agenda', to: '/agenda', label: 'Agenda', Icon: IconCalendar },
  { key: 'pacientes', to: '/pacientes', label: 'Pacientes', Icon: IconUsers },
  { key: 'clinico', to: '/nexus', label: 'Nexus', Icon: IconShield, nexus: true },
  { key: 'financeiro', to: '/financeiro', label: 'Financeiro', Icon: IconWallet },
  { key: 'crm', to: '/crm', label: 'CRM', Icon: IconTrend },
  { key: 'mensagens', to: '/mensagens', label: 'Mensagens', Icon: IconWhats },
  { key: 'relatorios', to: '/relatorios', label: 'Relatórios', Icon: IconTrend },
  { key: 'config', to: '/config', label: 'Configurações', Icon: IconSettings },
];

function ThemeButton({ theme, onToggle }: { theme: ColorTheme; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="grid h-10 w-10 place-items-center rounded-xl border border-line/75 bg-panel text-fog transition-colors hover:border-line2 hover:bg-raise/45 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/40"
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
    >
      {theme === 'dark' ? <IconSun className="h-4.5 w-4.5" /> : <IconMoon className="h-4.5 w-4.5" />}
    </button>
  );
}

function Login({ theme, onToggleTheme }: { theme: ColorTheme; onToggleTheme: () => void }) {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error: signInError } = await signIn(email, password);
    if (signInError) setError(signInError.message);
  };

  return (
    <div className="app-surface min-h-screen flex items-center justify-center p-5 relative">
      <div className="absolute right-5 top-5"><ThemeButton theme={theme} onToggle={onToggleTheme} /></div>
      <div className="relative w-full max-w-lg overflow-hidden rounded-[24px] border border-line/75 bg-panel shadow-[0_24px_80px_rgba(15,28,24,0.12)]">
        <div className="px-8 pt-8">
          <div className="flex items-center gap-2.5">
            <PulseMark className="w-8 h-7" />
            <span className="font-display font-bold text-xl tracking-tight">MEDICSPRO<span className="text-pulse">.</span></span>
          </div>
          <h1 className="font-display text-[28px] font-bold mt-7 leading-tight tracking-tight">Acesse sua clínica</h1>
          <p className="text-fog text-[14px] mt-2 leading-relaxed">Autenticação segura com Supabase Auth. Use seu email e senha cadastrados.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {error && (
            <div className="rv is-in rounded-xl border border-amber/40 text-amber bg-amber/5 px-4 py-3 flex items-start gap-2.5">
              <IconAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[13px] text-paper leading-snug">{error}</p>
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-[13px] font-semibold text-paper/80">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full min-h-12 rounded-xl border border-line/80 bg-deep px-4 py-3 text-[15px] focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/10" placeholder="seu@email.com" required disabled={loading} />
          </div>
          <div className="space-y-2">
            <label className="block text-[13px] font-semibold text-paper/80">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full min-h-12 rounded-xl border border-line/80 bg-deep px-4 py-3 text-[15px] focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/10" placeholder="••••••••" required disabled={loading} />
          </div>
          <button type="submit" disabled={loading || !email || !password} className="w-full min-h-12 rounded-xl bg-mint text-on-accent hover:brightness-105 font-display font-semibold py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-mint/10">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <div className="px-8 pb-7 flex items-center gap-2 text-[12px] text-fog">
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
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,400px)]">
      {toasts.map((t) => {
        const m = meta[t.kind];
        return (
          <div key={t.id} className={`rv is-in rounded-xl border ${m.cls} bg-panel/95 backdrop-blur px-4 py-3.5 shadow-xl flex items-start gap-2.5`}>
            <m.Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[13.5px] text-paper leading-snug">{t.msg}</p>
          </div>
        );
      })}
    </div>
  );
}

export function Shell() {
  const { user: effectiveUser, canView } = useCurrentUserAccess();
  const { transactions } = useFinance();
  const { consents } = useClinical();
  const { unidades, unidadeSel, setUnidadeSel } = useInfrastructure();
  const { signOut, loading } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem('medicspro-sidebar-collapsed') === 'true');
  const [entitlementVisibility, setEntitlementVisibility] = useState<ModuleEntitlementVisibility>({});
  const [nexusVisible, setNexusVisible] = useState(false);
  const { theme, toggleTheme } = useColorTheme();

  const { identity } = useProfessionalIdentity(effectiveUser?.id);
  useEffect(() => { if (effectiveUser) setMobileOpen(false); }, [effectiveUser]);

  useEffect(() => {
    let active = true;
    setEntitlementVisibility({});
    if (!effectiveUser) return () => { active = false; };

    void loadCurrentClinicModuleVisibility()
      .then((visibility) => {
        if (active) setEntitlementVisibility(visibility);
      })
      .catch((cause) => {
        console.error('[Entitlements] navigation visibility:', cause);
        if (active) setEntitlementVisibility({});
      });

    return () => { active = false; };
  }, [effectiveUser?.id]);

  useEffect(() => {
    let active = true;
    setNexusVisible(false);
    if (!effectiveUser || !canView('clinico')) return () => { active = false; };

    void hasProfessionalCapability('nexus.access')
      .then((allowed) => {
        if (active) setNexusVisible(allowed);
      })
      .catch((cause) => {
        console.error('[Nexus] navigation authorization:', cause);
        if (active) setNexusVisible(false);
      });

    return () => { active = false; };
  }, [effectiveUser?.id, effectiveUser?.role, canView]);

  const handleLogout = async () => {
    await signOut();
    nav('/');
  };

  if (!effectiveUser || loading) return <Login theme={theme} onToggleTheme={toggleTheme} />;

  const items = NAV.filter((n) =>
    (canView(n.key) || (effectiveUser.role === 'recep' && n.key === 'dashboard'))
    && (!n.nexus || nexusVisible)
    && isModuleVisibleByEntitlement(n.key, entitlementVisibility),
  );
  const pendencias = transactions.filter((t) => t.status === 'atrasado').length + consents.filter((c) => !c.assinado).length;
  const rm = ROLE_META[effectiveUser.role];
  const professionalLabel = effectiveUser.role === 'fisio' && identity
    ? professionalIdentityLabel(identity)
    : (rm?.label || 'Carregando...');

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('medicspro-sidebar-collapsed', String(next));
      return next;
    });
  };

  const navList = (compact = false) => (
    <nav className="flex flex-col gap-1.5 px-3.5">
      {items.map((n) => (
        <NavLink
          key={n.key + n.to}
          to={n.to}
          onClick={() => setMobileOpen(false)}
          title={compact ? n.label : undefined}
          className={({ isActive }) =>
            `flex min-h-11 items-center ${compact ? 'justify-center px-2' : 'gap-3.5 px-3.5'} rounded-xl py-2.5 font-display font-semibold text-[14px] transition-colors ${
              isActive ? 'bg-mint/10 text-mint' : 'text-fog hover:text-paper hover:bg-raise/60'
            }`
          }
        >
          <n.Icon className="w-5 h-5 shrink-0" />
          <span className={compact ? 'sr-only' : ''}>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="app-surface min-h-screen relative">
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 ${collapsed ? 'w-[80px]' : 'w-[268px]'} flex-col border-r border-line/65 bg-deep/96 backdrop-blur-sm z-40 transition-[width] duration-200`}>
        <div className={`flex items-center ${collapsed ? 'justify-center px-3' : 'gap-2.5 px-5.5'} h-[68px] border-b border-line/60`}>
          <PulseMark className="w-7 h-6" />
          {!collapsed && <span className="font-display font-bold text-[15px] tracking-tight">MEDICSPRO<span className="text-pulse">.</span></span>}
        </div>
        <button onClick={toggleCollapsed} className="absolute -right-3 top-[86px] grid h-7 w-7 place-items-center rounded-full border border-line/70 bg-panel text-fog shadow-sm hover:text-paper hover:bg-raise" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <IconChevronR className="h-3.5 w-3.5" /> : <IconChevronL className="h-3.5 w-3.5" />}
        </button>
        <div className="py-5.5 flex-1 overflow-y-auto">{navList(collapsed)}</div>
        <div className="border-t border-line/60 p-4.5">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <span className="w-10 h-10 rounded-full grid place-items-center font-display font-bold text-[12px] text-on-accent shrink-0" style={{ background: effectiveUser.cor || '#cbd5e1' }}>
              {effectiveUser.nome ? effectiveUser.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ').map((w) => w[0]).slice(0, 2).join('') : 'U'}
            </span>
            {!collapsed && <span className="min-w-0 flex-1">
              <span className="block font-display font-semibold text-[13.5px] leading-tight truncate">{effectiveUser.nome || 'Usuário'}</span>
              <span className={`block text-[12px] mt-0.5 ${rm?.text || 'text-fog'}`}>{professionalLabel}</span>
            </span>}
            {!collapsed && <button onClick={handleLogout} className="grid h-9 w-9 place-items-center rounded-lg text-fog hover:text-pulse hover:bg-raise/55 transition-colors" title="Sair"><IconLogout className="w-4.5 h-4.5" /></button>}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[278px] flex flex-col border-r border-line bg-deep rv is-in">
            <div className="flex items-center justify-between px-5 h-16 border-b border-line/60">
              <div className="flex items-center gap-2.5"><PulseMark className="w-6 h-5" /><span className="font-display font-bold text-[15px]">MEDICSPRO<span className="text-pulse">.</span></span></div>
              <button onClick={() => setMobileOpen(false)} className="text-fog"><IconX className="w-5 h-5" /></button>
            </div>
            <div className="py-4 flex-1 overflow-y-auto">{navList()}</div>
            <div className="border-t border-line p-4"><button onClick={handleLogout} className="w-full flex items-center gap-2 text-fog hover:text-pulse transition-colors text-[13px]"><IconLogout className="w-4 h-4" /> Encerrar sessão — {effectiveUser.nome}</button></div>
          </aside>
        </div>
      )}

      <div className={`${collapsed ? 'lg:pl-[80px]' : 'lg:pl-[268px]'} relative transition-[padding] duration-200`}>
        <header className="sticky top-0 z-30 h-[68px] border-b border-line/60 bg-ink/88 backdrop-blur-xl flex items-center gap-3 px-4 md:px-7">
          <button className="lg:hidden text-fog hover:text-paper" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><IconMenu className="w-5 h-5" /></button>
          <div className="hidden sm:flex items-center gap-2 text-[13px] font-medium text-fog"><IconShield className="w-4 h-4 text-mint" /><span>Ambiente protegido</span></div>
          <Select value={unidadeSel} onChange={(e) => setUnidadeSel(e.target.value)} className="!w-auto !min-h-10 !py-2 !text-[13px] ml-1" title="Filtrar por unidade">
            <option value="all">Todas as unidades</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <ThemeButton theme={theme} onToggle={toggleTheme} />
            <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-line/75 bg-panel text-fog"><IconBell className="w-4.5 h-4.5" />{pendencias > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 grid place-items-center rounded-full bg-pulse text-white text-[10px] font-semibold">{pendencias}</span>}</span>
          </div>
        </header>
        <main className="px-4 sm:px-6 md:px-8 xl:px-10 py-7 md:py-9 max-w-[1760px] mx-auto">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  );
}