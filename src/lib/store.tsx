import { createContext, useContext, type ReactNode } from 'react';
import type { Patient, User } from './types';

type AppState = Record<string, never>;

const Ctx = createContext<AppState | null>(null);

/**
 * Compatibility shell kept temporarily until the final store teardown.
 *
 * All operational state, auth, notifications and LGPD actions already live in
 * dedicated providers/hooks. Do not add new state here.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={{}}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fora do AppProvider');
  return ctx;
}

export const patientName = (patients: Patient[], id: string) => patients.find((patient) => patient.id === id)?.nome ?? '—';
export const userName = (users: User[], id: string) => users.find((user) => user.id === id)?.nome ?? '—';
