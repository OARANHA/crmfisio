import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Patient, User } from './types';
import { useLgpdActions } from './lgpdActions';
import { useToast, type Toast } from './toastContext';

interface AppState {
  toast: (msg: string, kind?: Toast['kind']) => void;
  exportarTitular: (pacienteId: string) => Promise<Record<string, unknown>>;
  anonimizarPaciente: (pacienteId: string) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

/**
 * Compatibility facade for screens still using useApp().
 *
 * Canonical auth and domain state live in dedicated providers. New code should
 * consume those providers directly instead of adding state or loaders here.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const lgpd = useLgpdActions();
  const { toast: pushToast } = useToast();

  const value = useMemo<AppState>(() => ({
    toast: pushToast,
    exportarTitular: lgpd.exportSubjectData,
    anonimizarPaciente: lgpd.anonymizePatient,
  }), [
    pushToast,
    lgpd.exportSubjectData, lgpd.anonymizePatient,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fora do AppProvider');
  return ctx;
}

export const patientName = (patients: Patient[], id: string) => patients.find((patient) => patient.id === id)?.nome ?? '—';
export const userName = (users: User[], id: string) => users.find((user) => user.id === id)?.nome ?? '—';
