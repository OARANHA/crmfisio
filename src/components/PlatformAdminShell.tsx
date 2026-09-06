import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { platformSupabase } from '../lib/platformSupabaseClient';

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const BUSINESS_NAV = [
  { to: '/platform', label: 'Visão geral', icon: '⌂' },
  { to: '/platform/comercial', label: 'Comercial', icon: '↗' },
  { to: '/platform/modulos', label: 'Clientes & Plataforma', icon: '◇' },
  { to: '/platform/receita', label: 'Receita & Assinaturas', icon: '◌' },
] as const;

const OPERATION_NAV = [
  { to: '/platform/provisionar', label: 'Onboarding', icon: '＋' },
  { to: '/platform/governanca', label: 'Governança', icon: '⌁' },
] as const;

export function PlatformAdminShell({ eyebrow, title, description, actions, children }: Props) {
  const location = useLocation();
  const isActive = (to: string) => to === '/platform' ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <div className="app-surface min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1580px]">
        <aside className="hidden w-[250px] shrink-0 border-r border-line/60 bg-panel/75 p-5 lg:flex lg:flex-col">
          <Link to="/platform" className="flex items-center gap-3 rounded-2xl px-2 py-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-mint font-display text-[16px] font-black text-on-accent">M</div>
            <div>
              <p className="font-display text-[17px] font-bold tracking-tight">MedicsPro<span className="text-mint">.</span></p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-fog">Platform Admin</p>
            </div>
          </Link>

          <p className="mb-2 mt-8 px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-fog">Áreas de negócio</p>
          <nav className="space-y-1.5 text-[12px] font-semibold">
            {BUSINESS_NAV.map((item) => <PlatformNav key={item.to} {...item} active={isActive(item.to)} />)}
          </nav>

          <p className="mb-2 mt-7 px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-fog">Operação</p>
          <nav className="space-y-1 text-[11.5px] font-medium">
            {OPERATION_NAV.map((item) => <PlatformNav key={item.to} {...item} active={isActive(item.to)} />)}
          </nav>

          <div className="mt-auto rounded-[20px] border border-line/70 bg-deep/60 p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-fog">Domínio SaaS</p>
            <p className="mt-2 text-[11.5px] font-semibold text-paper">Governança separada</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-fog">Platform Admin controla negócio e lifecycle sem receber acesso implícito aos dados clínicos dos tenants.</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-line/55 bg-ink/90 px-5 py-4 backdrop-blur-xl md:px-7">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mint">{eyebrow}</p>
                <h1 className="mt-0.5 font-display text-[21px] font-bold tracking-tight">{title}</h1>
                {description && <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-fog">{description}</p>}
              </div>
              {actions}
              <button onClick={() => void platformSupabase.auth.signOut()} className="rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[11px] font-semibold text-pulse transition hover:bg-pulse/[0.05]">Sair</button>
            </div>
          </header>

          <div className="flex gap-2 overflow-x-auto border-b border-line/45 bg-panel/30 px-4 py-3 lg:hidden">
            {BUSINESS_NAV.map((item) => <MobileNav key={item.to} {...item} active={isActive(item.to)} />)}
          </div>

          <main className="space-y-5 p-4 md:p-6 xl:p-7">{children}</main>
        </div>
      </div>
    </div>
  );
}

function PlatformNav({ to, label, icon, active }: { to: string; label: string; icon: string; active: boolean }) {
  return (
    <Link to={to} className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${active ? 'border border-mint/25 bg-mint/[0.08] text-paper' : 'text-fog hover:bg-deep hover:text-paper'}`}>
      <span className={active ? 'text-mint' : undefined}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function MobileNav({ to, label, active }: { to: string; label: string; icon: string; active: boolean }) {
  return <Link to={to} className={`shrink-0 rounded-full border px-3 py-2 text-[10.5px] font-semibold ${active ? 'border-mint/30 bg-mint/[0.09] text-mint' : 'border-line bg-panel text-fog'}`}>{label}</Link>;
}
