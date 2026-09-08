import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useClinicModuleEntitlementVisibility } from '../../hooks/useClinicModuleEntitlementVisibility';
import type { ModuleKey } from '../../lib/types';
import { IconChevronR } from '../../lib/ui';

export type DashboardMetric = {
  label: string;
  value: ReactNode;
  sub: string;
  tone?: string;
  to?: string;
};

const PROTECTED_ROUTE_MODULE: Array<[prefix: string, module: ModuleKey]> = [
  ['/financeiro', 'financeiro'],
  ['/crm', 'crm'],
  ['/mensagens', 'mensagens'],
  ['/relatorios', 'relatorios'],
];

function routeModule(to?: string): ModuleKey | null {
  if (!to) return null;
  return PROTECTED_ROUTE_MODULE.find(([prefix]) => to === prefix || to.startsWith(`${prefix}/`))?.[1] ?? null;
}

function useEntitledItems<T extends { to?: string }>(items: T[]) {
  const { visibility, resolved } = useClinicModuleEntitlementVisibility();
  return items.filter((item) => {
    const module = routeModule(item.to);
    if (!module) return true;
    return resolved && visibility[module] === true;
  });
}

export function DashboardMetricGrid({ items }: { items: DashboardMetric[] }) {
  const visibleItems = useEntitledItems(items);

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      {visibleItems.map((item, index) => {
        const content = <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.tone ?? 'text-paper'} bg-current shadow-[0_0_0_4px_currentColor] shadow-transparent`} />
              <p className="text-[12px] font-semibold text-fog">{item.label}</p>
            </div>
            {item.to && <IconChevronR className="h-4 w-4 shrink-0 text-fog/45 transition-all group-hover:translate-x-0.5 group-hover:text-mint" />}
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <p className={`font-display text-[30px] font-bold leading-none tracking-[-0.035em] ${item.tone ?? 'text-paper'}`}>{item.value}</p>
            <span className="font-mono text-[11px] text-fog/40">0{index + 1}</span>
          </div>
          <p className="mt-3 min-h-[38px] text-[12px] leading-relaxed text-fog/80">{item.sub}</p>
        </>;

        const className = 'group relative min-h-[148px] overflow-hidden rounded-[22px] border border-line/70 bg-panel p-4.5 shadow-[0_16px_40px_rgba(6,14,11,0.055)] transition-all duration-200 before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-line2/55 before:to-transparent hover:-translate-y-0.5 hover:border-line2 hover:bg-raise/25 hover:shadow-[0_20px_50px_rgba(6,14,11,0.09)]';
        return item.to
          ? <Link key={item.label} to={item.to} className={className}>{content}</Link>
          : <div key={item.label} className={className}>{content}</div>;
      })}
    </div>
  );
}

export function DashboardQuickActions({ actions }: { actions: { label: string; to: string; primary?: boolean }[] }) {
  const visibleActions = useEntitledItems(actions);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleActions.map((action) => (
        <Link
          key={action.to + action.label}
          to={action.to}
          className={action.primary
            ? 'inline-flex min-h-10 items-center gap-2 rounded-xl bg-mint px-4 py-2.5 text-[13px] font-semibold text-on-accent shadow-sm shadow-mint/10 transition-all hover:-translate-y-px hover:brightness-105'
            : 'inline-flex min-h-10 items-center gap-2 rounded-xl border border-line/80 bg-panel/80 px-4 py-2.5 text-[13px] font-semibold text-fog transition-all hover:-translate-y-px hover:border-line2 hover:bg-raise/45 hover:text-paper'}
        >
          {action.label}<IconChevronR className="h-3.5 w-3.5" />
        </Link>
      ))}
    </div>
  );
}
