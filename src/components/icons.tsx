interface IconProps { className?: string }

const base = (className = '') => ({
  className, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24', 'aria-hidden': true as const,
});

export const IconCheck = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M4.5 12.5l5 5 10-11" /></svg>
);
export const IconX = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconLock = ({ className }: IconProps) => (
  <svg {...base(className)}><rect x="5" y="10.5" width="14" height="9.5" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2" /></svg>
);
export const IconShield = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M12 3l7.5 3v5.6c0 4.6-3.1 7.6-7.5 9.4-4.4-1.8-7.5-4.8-7.5-9.4V6L12 3Z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>
);
export const IconEye = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></svg>
);
export const IconEdit = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20ZM14.5 7l3 3" /></svg>
);
export const IconSend = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M21 3L10.5 13.5M21 3l-7 18-3.5-7.5L3 10l18-7Z" /></svg>
);
export const IconWhats = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5Z" /><path d="M8.8 9.2c.4 2.6 3 5.2 5.8 5.9l1.3-1.3-2-1.2-.9.6c-.8-.4-1.6-1.2-2-2l.6-.9-1.2-2-1.6.9Z" /></svg>
);
export const IconCardPay = ({ className }: IconProps) => (
  <svg {...base(className)}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 14.5h4" /></svg>
);
export const IconPlug = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8ZM12 16.5V21" /></svg>
);
export const IconDb = ({ className }: IconProps) => (
  <svg {...base(className)}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v13c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-13M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8" /></svg>
);
export const IconArrow = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
);
