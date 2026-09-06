import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import type { Database } from './database.types';
import type { WaLog } from './types';

type WaLogRow = Database['public']['Tables']['wa_logs']['Row'];

const mapWaLog = (row: WaLogRow): WaLog => ({
  id: row.id,
  pacienteId: row.patient_id,
  template: row.template,
  mensagem: row.mensagem,
  enviadoEm: row.enviado_em,
  status: row.status,
});

interface CommunicationState {
  waLogs: WaLog[];
  loading: boolean;
  error: string | null;
  refreshCommunication: () => Promise<void>;
}

const CommunicationContext = createContext<CommunicationState | null>(null);

export function CommunicationProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [waLogs, setWaLogs] = useState<WaLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refreshCommunication = useCallback(async () => {
    const request = ++generation.current;
    if (!clinicId || tenantAccessState !== 'active') {
      setWaLogs([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const result = await supabase.from('wa_logs').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false });
      if (request !== generation.current) return;
      if (result.error) throw result.error;
      setWaLogs((result.data ?? []).map(mapWaLog));
      setError(null);
    } catch (cause) {
      if (request !== generation.current) return;
      console.error('[MedicsPro] comunicação:', cause);
      setError('Não foi possível carregar o histórico de comunicação.');
      throw cause;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [clinicId, tenantAccessState]);

  useEffect(() => { void refreshCommunication().catch(() => undefined); }, [refreshCommunication]);

  const value = useMemo<CommunicationState>(() => ({ waLogs, loading, error, refreshCommunication }), [waLogs, loading, error, refreshCommunication]);
  return <CommunicationContext.Provider value={value}>{children}</CommunicationContext.Provider>;
}

export function useCommunication(): CommunicationState {
  const context = useContext(CommunicationContext);
  if (!context) throw new Error('useCommunication deve ser usado dentro de CommunicationProvider');
  return context;
}
