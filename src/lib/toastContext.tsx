import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface Toast { id: number; msg: string; kind: 'ok' | 'warn' | 'info' }

interface ToastState {
  toasts: Toast[];
  toast: (msg: string, kind?: Toast['kind']) => void;
}

const ToastContext = createContext<ToastState | null>(null);
let sequence = 1000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, kind: Toast['kind'] = 'ok') => {
    const id = ++sequence;
    setToasts((current) => [...current.slice(-3), { id, msg, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4400);
  }, []);

  const value = useMemo<ToastState>(() => ({ toasts, toast }), [toasts, toast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return context;
}
