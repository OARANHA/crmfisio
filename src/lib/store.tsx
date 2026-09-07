import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  Access, Commission, FinancialTransaction, ModuleKey, Patient, User,
} from './types';
import { useFinance } from './financeContext';
import { useLgpdActions } from './lgpdActions';
import { useCurrentUserAccess } from './currentUserAccess';
import { useToast, type Toast } from './toastContext';

interface AppState {
  user: User | null;
  transactions: FinancialTransaction[];
  commissions: Commission[];
  access: (m: ModuleKey) => Access;
  canView: (m: ModuleKey) => boolean;
  toast: (msg: string, kind?: Toast['kind']) => void;
  setTxStatus: (id: string, status: FinancialTransaction['status'], metodo?: FinancialTransaction['metodo']) => void;
  addTransaction: (t: Omit<FinancialTransaction, 'id'>) => void;
  fecharRepasse: (periodo: string) => Promise<number>;
  setCommissionStatus: (id: string, status: Commission['status']) => Promise<void>;
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
  const { user, access, canView } = useCurrentUserAccess();
  const finance = useFinance();
  const lgpd = useLgpdActions();
  const { toast: pushToast } = useToast();

  const value = useMemo<AppState>(() => {
    const persistError = (label: string, error: unknown) => {
      console.error(`[MedicsPro] ${label}:`, error);
      pushToast(`${label}. Tente novamente.`, 'warn');
    };

    return {
      user,
      transactions: finance.transactions,
      commissions: finance.commissions,
      access,
      canView,
      toast: pushToast,
      setTxStatus: (id, status, metodo) => { void finance.setTransactionStatus(id, status, metodo).catch((error) => persistError('Falha ao atualizar financeiro', error)); },
      addTransaction: (transaction) => { void finance.addTransaction(transaction).then(() => pushToast('Lançamento financeiro salvo.')).catch((error) => persistError('Falha ao salvar lançamento financeiro', error)); },
      fecharRepasse: finance.closeCommissions,
      setCommissionStatus: finance.setCommissionStatus,
      exportarTitular: lgpd.exportSubjectData,
      anonimizarPaciente: lgpd.anonymizePatient,
    };
  }, [
    user, access, canView,
    pushToast,
    lgpd.exportSubjectData, lgpd.anonymizePatient,
    finance.transactions, finance.commissions, finance.addTransaction, finance.setTransactionStatus,
    finance.closeCommissions, finance.setCommissionStatus,
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