import { useEffect, type ReactNode } from 'react';
import { IconX } from '../components/icons';

/* ---------------------------------- icons --------------------------------- */
interface IP { className?: string; filled?: boolean }
const b = (className = '') => ({
  className, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24', 'aria-hidden': true as const,
});

export const IconDashboard = ({ className }: IP) => (
  <svg {...b(className)}><rect x="3.5" y="3.5" width="7" height="9" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="15.5" width="7" height="5" rx="1.5" /></svg>
);
export const IconCalendar = ({ className }: IP) => (
  <svg {...b(className)}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
);
export const IconUsers = ({ className }: IP) => (
  <svg {...b(className)}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.6c2.2.3 3.8 1.9 4.4 4.4" /></svg>
);
export const IconWallet = ({ className }: IP) => (
  <svg {...b(className)}><rect x="3.5" y="6" width="17" height="14" rx="2" /><path d="M3.5 9.5h17M16.5 14.5h.01" /><path d="M6 6V5a2 2 0 0 1 2-2h8" /></svg>
);
export const IconTrend = ({ className }: IP) => (
  <svg {...b(className)}><path d="M3.5 17.5l5.5-5.5 3.5 3.5 7-7.5" /><path d="M15 8h4.5V12.5" /></svg>
);
export const IconLogout = ({ className }: IP) => (
  <svg {...b(className)}><path d="M14 4h-8a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h8M10 12h10M16.5 8.5L20 12l-3.5 3.5" /></svg>
);
export const IconPlus = ({ className }: IP) => (
  <svg {...b(className)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconSearch = ({ className }: IP) => (
  <svg {...b(className)}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
);
export const IconClock = ({ className }: IP) => (
  <svg {...b(className)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconChevronL = ({ className }: IP) => (
  <svg {...b(className)}><path d="M14.5 5.5L8 12l6.5 6.5" /></svg>
);
export const IconChevronR = ({ className }: IP) => (
  <svg {...b(className)}><path d="M9.5 5.5L16 12l-6.5 6.5" /></svg>
);
export const IconFile = ({ className }: IP) => (
  <svg {...b(className)}><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>
);
export const IconDollar = ({ className }: IP) => (
  <svg {...b(className)}><path d="M12 3v18M16 7c-.8-1.4-2.3-2-4-2-2.2 0-3.8 1.1-3.8 2.9 0 4 8 2.2 8 6.2 0 1.8-1.7 2.9-4.2 2.9-1.9 0-3.5-.7-4.2-2.2" /></svg>
);
export const IconAlert = ({ className }: IP) => (
  <svg {...b(className)}><path d="M12 4L2.8 20h18.4L12 4Z" /><path d="M12 10v4M12 17.2h.01" /></svg>
);
export const IconPhone = ({ className }: IP) => (
  <svg {...b(className)}><path d="M5 4h4l1.5 4.5-2.2 1.6a12 12 0 0 0 5.6 5.6l1.6-2.2L20 15v4a1.5 1.5 0 0 1-1.6 1.5C10.5 20 4 13.5 3.5 5.6A1.5 1.5 0 0 1 5 4Z" /></svg>
);
export const IconMail = ({ className }: IP) => (
  <svg {...b(className)}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4.5 7.5L12 13l7.5-5.5" /></svg>
);
export const IconPaperclip = ({ className }: IP) => (
  <svg {...b(className)}><path d="M20 11.5l-7.5 7.5a5 5 0 0 1-7-7L13 4.5a3.4 3.4 0 0 1 4.8 4.8L10.3 16.8a1.8 1.8 0 0 1-2.5-2.5l6.5-6.4" /></svg>
);
export const IconStar = ({ className, filled }: IP) => (
  <svg {...b(className)} fill={filled ? 'currentColor' : 'none'}><path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8L9.6 9 12 4Z" /></svg>
);
export const IconSettings = ({ className }: IP) => (
  <svg {...b(className)}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.15-1.4l2-1.55-2-3.45-2.35.95a7 7 0 0 0-2.4-1.4L13.7 2.6h-3.4l-.4 2.55a7 7 0 0 0-2.4 1.4L5.15 5.6l-2 3.45 2 1.55A7 7 0 0 0 5 12c0 .48.05.94.15 1.4l-2 1.55 2 3.45 2.35-.95a7 7 0 0 0 2.4 1.4l.4 2.55h3.4l.4-2.55a7 7 0 0 0 2.4-1.4l2.35.95 2-3.45-2-1.55c.1-.46.15-.92.15-1.4Z" /></svg>
);
export const IconMenu = ({ className }: IP) => (
  <svg {...b(className)}><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>
);
export const IconBell = ({ className }: IP) => (
  <svg {...b(className)}><path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
);
export const IconDownload = ({ className }: IP) => (
  <svg {...b(className)}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 19.5h15" /></svg>
);
export const IconChart = ({ className }: IP) => (
  <svg {...b(className)}><path d="M4.5 19.5V5M4.5 19.5H20M8 15.5v-4M12 15.5V7.5M16 15.5v-6.5" /></svg>
);
export const IconSun = ({ className }: IP) => (
  <svg {...b(className)}><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></svg>
);
export const IconMoon = ({ className }: IP) => (
  <svg {...b(className)}><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" /></svg>
);

/* ------------------------------- primitives ------------------------------- */

export function Chip({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-[12px] leading-4 ${className}`}>
      {children}
    </span>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[18px] border border-line/75 bg-panel shadow-[0_8px_28px_rgba(15,28,24,0.045)] ${className}`}>{children}</div>;
}

export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5.5 pt-5 pb-4 border-b border-line/60">
      <div>
        <h3 className="font-display font-semibold text-[16px] leading-tight tracking-[-0.01em]">{title}</h3>
        {sub && <p className="text-[13px] text-fog mt-1.5 leading-relaxed">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Btn({
  variant = 'primary', className = '', children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'subtle' }) {
  const base = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl font-display font-semibold text-[14px] px-4 py-2.5 transition-all active:translate-y-px disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/40';
  const v =
    variant === 'primary' ? 'bg-mint text-on-accent shadow-sm shadow-mint/10 hover:brightness-105'
    : variant === 'danger' ? 'bg-pulse text-white hover:brightness-105'
    : variant === 'subtle' ? 'bg-raise text-paper border border-line/75 hover:border-line2'
    : 'border border-line/80 bg-panel text-fog hover:text-paper hover:border-line2 hover:bg-raise/45';
  return <button className={`${base} ${v} ${className}`} {...rest}>{children}</button>;
}

export function Modal({
  open, onClose, title, children, wide,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal>
      <div className="fixed inset-0 bg-black/55 backdrop-blur-[3px]" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} rounded-[20px] border border-line2/70 bg-panel shadow-2xl my-auto rv is-in overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line/60">
          <h3 className="font-display font-semibold text-[16px]">{title}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-fog hover:text-paper hover:bg-raise/60 transition-colors" aria-label="Fechar">
            <IconX className="w-4.5 h-4.5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const fieldCls = 'w-full min-h-11 rounded-xl bg-deep border border-line/80 px-3.5 py-2.5 text-[14.5px] text-paper placeholder:text-fog/55 focus:outline-none focus:border-mint/65 focus:ring-2 focus:ring-mint/10 transition-colors';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-paper/80 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-fog/80 mt-1.5 leading-relaxed">{hint}</span>}
    </label>
  );
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldCls} ${p.className ?? ''}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${fieldCls} ${p.className ?? ''}`} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${fieldCls} min-h-[104px] leading-relaxed ${p.className ?? ''}`} />;

export function Bar({ pct, color = '#4fd1a5', className = '' }: { pct: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-raise overflow-hidden ${className}`}>
      <div className="h-full rounded-full bar-anim" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-dashed border-line2/75 bg-deep/35 px-6 py-11 text-center">
      <p className="font-display font-semibold text-[16px] text-paper/85">{title}</p>
      {sub && <p className="text-[13px] text-fog mt-2 leading-relaxed max-w-2xl mx-auto">{sub}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
