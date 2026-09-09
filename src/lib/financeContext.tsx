import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import {
  closeMonthlyCommissions,
  insertPayment,
  markCommissionPaid,
  mapPayment,
  updatePayment,
} from './repository';
import {
  loadPendingFinancialExceptions,
  resolveAppointmentFinancialException,
  type FinancialException,
  type FinancialExceptionDisposition,
} from './financialExceptionResolution';
import {
  executeFinancialExceptionCommand,
  type FinancialExceptionCommandResult,
} from './financialExceptionCommand';
import {
  canChargeFinancialException,
  canListFinancialExceptions,
  canWaiveFinancialException,
} from './permissions';
import type { Commission, FinancialTransaction } from './types';
import type { Database } from './database.types';

type CommissionRow = Database['public']['Tables']['commission_settlements']['Row'];

const mapCommission = (row: CommissionRow): Commission => ({
  id: row.id,
  fisioId: row.professional_id,
  periodo: row.period.slice(0, 7),
  base: row.base_amount,
  percentual: Number(row.percentage),
  status: row.status,
});

interface FinanceState {
  transactions: FinancialTransaction[];
  commissions: Commission[];
  financialExceptions: FinancialException[];
  loading: boolean;
  error: string | null;
  financialExceptionsLoading: boolean;
  financialExceptionsError: string | null;
  refreshFinance: () => Promise<void>;
  refreshFinancialExceptions: () => Promise<void>;
  resolveFinancialException: (
    exceptionId: string,
    disposition: FinancialExceptionDisposition,
    reason?: string | null,
  ) => Promise<FinancialExceptionCommandResult>;
  addTransaction: (transaction: Omit<FinancialTransaction, 'id'>) => Promise<FinancialTransaction>;
  setTransactionStatus: (id: string, status: FinancialTransaction['status'], metodo?: FinancialTransaction['metodo']) => Promise<FinancialTransaction>;
  closeCommissions: (period: string) => Promise<number>;
  setCommissionStatus: (id: string, status: Commission['status']) => Promise<void>;
}

const FinanceContext = createContext<FinanceState | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const profileId = profile?.id ?? null;
  const profileRole = profile?.role ?? null;
  const clinicId = profile?.clinic_id ?? null;
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [financialExceptions, setFinancialExceptions] = useState<FinancialException[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [financialExceptionsLoading, setFinancialExceptionsLoading] = useState(false);
  const [financialExceptionsError, setFinancialExceptionsError] = useState<string | null>(null);
  const generation = useRef(0);
  const financialExceptionGeneration = useRef(0);

  const refreshFinance = useCallback(async () => {
    const request = ++generation.current;
    if (!clinicId || tenantAccessState !== 'active') {
      setTransactions([]);
      setCommissions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const [paymentsResult, commissionsResult] = await Promise.all([
        supabase.from('payments').select('*').eq('clinic_id', clinicId).order('vencimento', { ascending: false }),
        supabase.from('commission_settlements').select('*').eq('clinic_id', clinicId).order('period', { ascending: false }),
      ]);

      if (request !== generation.current) return;
      if (paymentsResult.error) throw paymentsResult.error;
      setTransactions((paymentsResult.data ?? []).map(mapPayment));

      if (commissionsResult.error) {
        console.warn('[MedicsPro] repasses indisponíveis por enquanto:', commissionsResult.error);
        setCommissions([]);
      } else {
        setCommissions((commissionsResult.data ?? []).map(mapCommission));
      }
      setError(null);
    } catch (cause) {
      if (request !== generation.current) return;
      console.error('[MedicsPro] financeiro:', cause);
      setError('Não foi possível carregar os dados financeiros.');
      throw cause;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [clinicId, tenantAccessState]);

  const refreshFinancialExceptions = useCallback(async () => {
    const request = ++financialExceptionGeneration.current;
    if (
      !profileId
      || !clinicId
      || tenantAccessState !== 'active'
      || !canListFinancialExceptions(profileRole)
    ) {
      setFinancialExceptions([]);
      setFinancialExceptionsLoading(false);
      setFinancialExceptionsError(null);
      return;
    }

    setFinancialExceptionsLoading(true);
    try {
      const next = await loadPendingFinancialExceptions();
      if (request !== financialExceptionGeneration.current) return;
      setFinancialExceptions(next);
      setFinancialExceptionsError(null);
    } catch (cause) {
      if (request !== financialExceptionGeneration.current) return;
      console.error('[MedicsPro] pendências de cobertura:', cause);
      setFinancialExceptionsError('Não foi possível carregar as pendências de cobertura.');
      throw cause;
    } finally {
      if (request === financialExceptionGeneration.current) setFinancialExceptionsLoading(false);
    }
  }, [clinicId, profileId, profileRole, tenantAccessState]);

  useEffect(() => { void refreshFinance().catch(() => undefined); }, [refreshFinance]);

  useEffect(() => {
    financialExceptionGeneration.current += 1;
    setFinancialExceptions([]);
    setFinancialExceptionsLoading(false);
    setFinancialExceptionsError(null);
  }, [clinicId, profileId, profileRole, tenantAccessState]);

  useEffect(() => {
    void refreshFinancialExceptions().catch(() => undefined);
  }, [refreshFinancialExceptions]);

  const resolveFinancialException = useCallback(async (
    exceptionId: string,
    disposition: FinancialExceptionDisposition,
    reason?: string | null,
  ) => {
    if (disposition === 'charge' && !canChargeFinancialException(profileRole)) {
      throw new Error('Perfil sem permissão para gerar cobrança desta pendência.');
    }
    if (disposition === 'waived' && !canWaiveFinancialException(profileRole)) {
      throw new Error('Perfil sem permissão para conceder cortesia desta pendência.');
    }

    const commandGeneration = financialExceptionGeneration.current;
    return executeFinancialExceptionCommand(exceptionId, disposition, reason, {
      resolve: resolveAppointmentFinancialException,
      onPersisted: (persisted) => {
        if (commandGeneration !== financialExceptionGeneration.current) return;
        setFinancialExceptions((current) => current.filter((item) => item.id !== persisted.exceptionId));
      },
      refreshFinance,
      refreshQueue: refreshFinancialExceptions,
    });
  }, [profileRole, refreshFinance, refreshFinancialExceptions]);

  const addTransaction = useCallback(async (transaction: Omit<FinancialTransaction, 'id'>) => {
    if (!clinicId) throw new Error('Clínica não identificada');
    const created = await insertPayment(clinicId, transaction);
    setTransactions((current) => [created, ...current]);
    return created;
  }, [clinicId]);

  const setTransactionStatus = useCallback(async (id: string, status: FinancialTransaction['status'], metodo?: FinancialTransaction['metodo']) => {
    const updated = await updatePayment(id, status, metodo);
    setTransactions((current) => current.map((item) => item.id === id ? updated : item));
    return updated;
  }, []);

  const closeCommissions = useCallback(async (period: string) => {
    const previousIds = new Set(commissions.map((item) => item.id));
    const closed = await closeMonthlyCommissions(period);
    setCommissions((current) => [...closed, ...current.filter((item) => !closed.some((next) => next.id === item.id))]);
    return closed.filter((item) => !previousIds.has(item.id)).length;
  }, [commissions]);

  const setCommissionStatus = useCallback(async (id: string, status: Commission['status']) => {
    if (status !== 'pago') throw new Error('Somente a baixa de repasse é permitida');
    const paid = await markCommissionPaid(id);
    setCommissions((current) => current.map((item) => item.id === id ? paid : item));
  }, []);

  const value = useMemo<FinanceState>(() => ({
    transactions,
    commissions,
    financialExceptions,
    loading,
    error,
    financialExceptionsLoading,
    financialExceptionsError,
    refreshFinance,
    refreshFinancialExceptions,
    resolveFinancialException,
    addTransaction,
    setTransactionStatus,
    closeCommissions,
    setCommissionStatus,
  }), [
    transactions,
    commissions,
    financialExceptions,
    loading,
    error,
    financialExceptionsLoading,
    financialExceptionsError,
    refreshFinance,
    refreshFinancialExceptions,
    resolveFinancialException,
    addTransaction,
    setTransactionStatus,
    closeCommissions,
    setCommissionStatus,
  ]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceState {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance deve ser usado dentro de FinanceProvider');
  return context;
}
