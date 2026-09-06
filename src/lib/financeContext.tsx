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
  loading: boolean;
  error: string | null;
  refreshFinance: () => Promise<void>;
  addTransaction: (transaction: Omit<FinancialTransaction, 'id'>) => Promise<FinancialTransaction>;
  setTransactionStatus: (id: string, status: FinancialTransaction['status'], metodo?: FinancialTransaction['metodo']) => Promise<FinancialTransaction>;
  closeCommissions: (period: string) => Promise<number>;
  setCommissionStatus: (id: string, status: Commission['status']) => Promise<void>;
}

const FinanceContext = createContext<FinanceState | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

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

  useEffect(() => { void refreshFinance().catch(() => undefined); }, [refreshFinance]);

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

  const value = useMemo<FinanceState>(() => ({ transactions, commissions, loading, error, refreshFinance, addTransaction, setTransactionStatus, closeCommissions, setCommissionStatus }), [transactions, commissions, loading, error, refreshFinance, addTransaction, setTransactionStatus, closeCommissions, setCommissionStatus]);
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceState {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance deve ser usado dentro de FinanceProvider');
  return context;
}
