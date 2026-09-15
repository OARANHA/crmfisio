import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useClinicModuleEntitlementVisibility } from '../../hooks/useClinicModuleEntitlementVisibility';
import type { ModuleKey } from '../../lib/types';
import { IconChevronR } from '../../lib/ui';

export type DashboardMetricTone = 'info' | 'focus' | 'attention' | 'success' | 'document';

export type DashboardMetric = {
  label: string;
  value: ReactNode;
  sub: string;
  tone?: string;
  surface?: DashboardMetricTone;
  icon?: ReactNode;
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

const SURFACE_CLASS: Record<DashboardMetricTone, string> = {
  info: 'comfort-tone-info',
  focus: 'comfort-tone-focus',
  attention: 'comfort-tone-attention',
  success: 'comfort-tone-success',
  document: 'comfort-tone-document',
};

export function DashboardMetricGrid({ items }: { items: DashboardMetric[] }) {
  const visibleItems = useEntitledItems(items);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {visibleItems.map((item, index) => {
        const surface = SURFACE_CLASS[item.surface ?? 'focus'];
        const content = <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {item.icon ? <span className="dashboard-metric-icon grid h-10 w-10 shrink-0 place-items-center rounded-2xl border">{item.icon}</span> : <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.tone ?? 'text-paper'} bg-current`} />}
              <p className="truncate text-[13.5px] font-semibold text-paper/90">{item.label}</p>
            </div>
            {item.to && <IconChevronR className="h-4 w-4 shrink-0 text-fog/45 transition-all group-hover:translate-x-0.5 group-hover:text-mint" />}
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <p className={`font-display text-ui-metric-value font-bold leading-none tracking-[-0.035em] ${item.tone ?? 'text-paper'}`}>{item.value}</p>
            <span className="font-mono text-[11px] text-fog/65">0{index + 1}</span>
          </div>
          <p className="mt-3 min-h-[42px] text-[13.5px] leading-relaxed text-fog">{item.sub}</p>
        </>;

        const className = `dashboard-metric ${surface} group relative min-h-[164px] overflow-hidden rounded-ui-data-surface border p-5 shadow-[0_14px_36px_rgba(6,14,11,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(6,14,11,0.085)]`;
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
            ? 'inline-flex min-h-ui-control items-center gap-2 rounded-2xl bg-mint px-5 py-3 text-[14.5px] font-semibold text-on-accent shadow-sm shadow-mint/10 transition-all hover:-translate-y-px hover:brightness-105'
            : 'inline-flex min-h-ui-control items-center gap-2 rounded-2xl border border-line/80 bg-panel/80 px-5 py-3 text-[14.5px] font-semibold text-fog transition-all hover:-translate-y-px hover:border-line2 hover:bg-raise/45 hover:text-paper'}
        >
          {action.label}<IconChevronR className="h-3.5 w-3.5" />
        </Link>
      ))}
    </div>
  );
}
