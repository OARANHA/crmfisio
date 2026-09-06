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

const NAV = [
  { to: '/platform', label: 'Visão geral', icon: '◆' },
  { to: '/platform/provisionar', label: 'Onboarding', icon: '＋' },
  { to: '/platform/modulos', label: 'Módulos e planos', icon: '◫' },
  { to: '/platform/governanca', label: 'Governança', icon: '⌁' },
] as const;

export function PlatformAdminShell({ eyebrow, title, description, actions, children }: Props) {
  const location = useLocation();

  return (
    <div className="app-surface min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-[245px] shrink-0 border-r border-line/70 bg-deep/75 p-5 lg:flex lg:flex-col">
          <Link to="/platform" className="rounded-2xl border border-aqua/20 bg-panel/75 p-4">
            <p className="font-display text-[17px] font-bold tracking-tight">MedicsPro<span className="text-mint">.</span></p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-fog">Platform Admin</p>
          </Link>

          <nav className="mt-6 space-y-1.5 text-[12px] font-semibold">
            {NAV.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${active ? 'border border-aqua/25 bg-aqua/[0.07] text-paper' : 'text-fog hover:bg-panel hover:text-paper'}`}
                >
                  <span className={active ? 'text-aqua' : undefined}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-line/70 bg-panel/55 p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-fog">Domínio SaaS</p>
            <p className="mt-2 text-[11.5px] font-semibold text-paper">Governança separada</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-fog">Ações desta área não concedem acesso implícito aos dados clínicos de tenants.</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-line/70 bg-deep/90 px-5 py-4 backdrop-blur-xl md:px-7">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mint">{eyebrow}</p>
                <h1 className="mt-0.5 font-display text-[21px] font-bold tracking-tight">{title}</h1>
                {description && <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-fog">{description}</p>}
              </div>
              {actions}
              <button onClick={() => void platformSupabase.auth.signOut()} className="rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-pulse transition hover:bg-pulse/[0.05]">Sair</button>
            </div>
          </header>

          <main className="space-y-5 p-5 md:p-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
