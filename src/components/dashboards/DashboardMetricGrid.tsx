import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronR } from '../../lib/ui';

export type DashboardMetric = {
  label: string;
  value: ReactNode;
  sub: string;
  tone?: string;
  to?: string;
};

export function DashboardMetricGrid({ items }: { items: DashboardMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {items.map((item) => {
        const content = <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold text-fog">{item.label}</p>
            {item.to && <IconChevronR className="h-3.5 w-3.5 shrink-0 text-fog/60 transition-transform group-hover:translate-x-0.5 group-hover:text-mint" />}
          </div>
          <p className={`mt-2 font-display text-[26px] font-bold leading-none ${item.tone ?? 'text-paper'}`}>{item.value}</p>
          <p className="mt-2 text-[11px] leading-snug text-fog/85">{item.sub}</p>
        </>;

        const className = 'group min-h-[126px] rounded-2xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:border-line2 hover:shadow-md';
        return item.to
          ? <Link key={item.label} to={item.to} className={className}>{content}</Link>
          : <div key={item.label} className={className}>{content}</div>;
      })}
    </div>
  );
}

export function DashboardQuickActions({ actions }: { actions: { label: string; to: string; primary?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Link
          key={action.to + action.label}
          to={action.to}
          className={action.primary
            ? 'inline-flex items-center gap-1.5 rounded-xl bg-mint px-3.5 py-2 text-[12px] font-semibold text-on-accent transition hover:brightness-105'
            : 'inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3.5 py-2 text-[12px] font-semibold text-fog transition hover:border-line2 hover:text-paper'}
        >
          {action.label}<IconChevronR className="h-3.5 w-3.5" />
        </Link>
      ))}
    </div>
  );
}
