import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { platformSupabase } from '../lib/platformSupabaseClient';

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  hideDesktopHeader?: boolean;
  children: ReactNode;
};

type ThemeMode = 'dark' | 'light' | 'system';

const BUSINESS_NAV = [
  { to: '/platform', label: 'Visão geral', icon: '⌂', tone: 'mint' },
  { to: '/platform/comercial', label: 'Comercial', icon: '↗', tone: 'aqua' },
  { to: '/platform/modulos', label: 'Clientes & Plataforma', icon: '◇', tone: 'amber' },
  { to: '/platform/receita', label: 'Receita & Assinaturas', icon: '◌', tone: 'pulse' },
] as const;

const OPERATION_NAV = [
  { to: '/platform/provisionar', label: 'Onboarding', icon: '＋', tone: 'mint' },
  { to: '/platform/governanca', label: 'Governança', icon: '⌁', tone: 'aqua' },
] as const;

function applyTheme(mode: ThemeMode) {
  const light = mode === 'light' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
}

export function PlatformAdminShell({ eyebrow, title, description, actions, children }: Props) {
  const location = useLocation();
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('medicspro-platform-theme') as ThemeMode | null) ?? 'system');
  const isActive = (to: string) => to === '/platform' ? location.pathname === to : location.pathname.startsWith(to);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('medicspro-platform-theme', theme);
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => { if (theme === 'system') applyTheme('system'); };
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [theme]);

  return (
    <div className="app-surface min-h-screen">
      <div className="flex min-h-screen w-full">
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 self-start overflow-y-auto border-r border-line/60 bg-panel/85 p-5 backdrop-blur-xl lg:flex lg:flex-col">
          <Link to="/platform" className="flex items-center gap-3 rounded-2xl px-2 py-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-mint font-display text-[16px] font-black text-on-accent shadow-sm">M</div>
            <div>
              <p className="font-display text-[17px] font-bold tracking-tight">MedicsPro<span className="text-mint">.</span></p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-fog">Platform Admin</p>
            </div>
          </Link>

          <p className="mb-2 mt-8 px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-fog">Áreas de negócio</p>
          <nav className="space-y-1.5 text-[12px] font-semibold" aria-label="Áreas de negócio">
            {BUSINESS_NAV.map((item) => <PlatformNav key={item.to} {...item} active={isActive(item.to)} />)}
          </nav>

          <p className="mb-2 mt-7 px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-fog">Operação</p>
          <nav className="space-y-1 text-[11.5px] font-medium" aria-label="Operação da plataforma">
            {OPERATION_NAV.map((item) => <PlatformNav key={item.to} {...item} active={isActive(item.to)} />)}
          </nav>

          <div className="mt-auto space-y-3 pt-8">
            <div className="rounded-[18px] border border-line/70 bg-deep/55 p-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-fog">Aparência</p>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-panel p-1">
                <ThemeButton active={theme === 'light'} label="Claro" icon="☀" onClick={() => setTheme('light')} />
                <ThemeButton active={theme === 'dark'} label="Escuro" icon="●" onClick={() => setTheme('dark')} />
                <ThemeButton active={theme === 'system'} label="Auto" icon="◐" onClick={() => setTheme('system')} />
              </div>
            </div>

            {actions && (
              <div className="rounded-[18px] border border-line/70 bg-deep/45 p-2 [&>button]:w-full">
                {actions}
              </div>
            )}

            <button
              type="button"
              onClick={() => void platformSupabase.auth.signOut()}
              className="w-full rounded-xl border border-pulse/20 bg-pulse/[0.04] px-3.5 py-2.5 text-[11px] font-semibold text-pulse transition hover:border-pulse/35 hover:bg-pulse/[0.08]"
            >
              Sair da plataforma
            </button>

            <div className="rounded-[20px] border border-line/70 bg-deep/60 p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-fog">Domínio SaaS</p>
              <p className="mt-2 text-[11.5px] font-semibold text-paper">Governança separada</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-fog">Negócio e lifecycle sem acesso implícito aos dados clínicos dos tenants.</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-line/55 bg-ink/90 px-4 py-3 backdrop-blur-xl sm:px-5 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">{title || eyebrow}</p>
              </div>
              <div className="flex items-center gap-2">
                {actions}
                <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="rounded-xl border border-line bg-panel px-3 py-2 text-[11px] font-semibold text-fog" title="Alternar tema">
                  {theme === 'light' ? '☀' : '●'}
                </button>
                <button onClick={() => void platformSupabase.auth.signOut()} className="rounded-xl border border-line bg-panel px-3 py-2 text-[11px] font-semibold text-pulse">Sair</button>
              </div>
            </div>
          </header>

          <div className="sticky top-[61px] z-20 border-b border-line/45 bg-ink/92 px-3 py-2.5 backdrop-blur-xl lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Navegação do Platform Admin">
              {BUSINESS_NAV.map((item) => <MobileNav key={item.to} {...item} active={isActive(item.to)} />)}
              <span className="mx-1 w-px shrink-0 bg-line" aria-hidden="true" />
              {OPERATION_NAV.map((item) => <MobileNav key={item.to} {...item} active={isActive(item.to)} />)}
            </div>
          </div>

          <main className="mx-auto w-full max-w-[2200px] space-y-5 p-4 sm:p-5 md:p-6 xl:p-7 2xl:p-9">{children}</main>
        </div>
      </div>
    </div>
  );
}

function toneClass(tone: string) {
  if (tone === 'aqua') return 'text-aqua';
  if (tone === 'amber') return 'text-amber';
  if (tone === 'pulse') return 'text-pulse';
  return 'text-mint';
}

function PlatformNav({ to, label, icon, tone, active }: { to: string; label: string; icon: string; tone: string; active: boolean }) {
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${active ? 'border border-mint/25 bg-mint/[0.08] text-paper shadow-sm' : 'text-fog hover:bg-deep hover:text-paper'}`}>
      <span className={`grid h-7 w-7 place-items-center rounded-lg bg-deep ${active ? toneClass(tone) : 'text-fog'}`}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function MobileNav({ to, label, tone, active }: { to: string; label: string; icon: string; tone: string; active: boolean }) {
  return <Link to={to} aria-current={active ? 'page' : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-[10.5px] font-semibold ${active ? `border-mint/30 bg-mint/[0.09] ${toneClass(tone)}` : 'border-line bg-panel text-fog'}`}>{label}</Link>;
}

function ThemeButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-lg px-2 py-2 text-center text-[9.5px] font-semibold transition ${active ? 'bg-mint text-on-accent shadow-sm' : 'text-fog hover:bg-deep hover:text-paper'}`}>
      <span className="block text-[12px]">{icon}</span>
      <span className="mt-0.5 block">{label}</span>
    </button>
  );
}
