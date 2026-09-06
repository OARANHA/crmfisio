import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import type { Database } from './database.types';
import type { AuditEntry } from './types';

type AuditRow = Database['public']['Tables']['audit_log']['Row'];

const mapAudit = (row: AuditRow): AuditEntry => ({
  id: row.id,
  ts: row.ts,
  usuarioId: row.usuario_id,
  acao: row.acao,
  detalhe: row.detalhe,
});

interface AuditState {
  audit: AuditEntry[];
  loading: boolean;
  error: string | null;
  refreshAudit: () => Promise<void>;
}

const AuditContext = createContext<AuditState | null>(null);

export function AuditProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refreshAudit = useCallback(async () => {
    const request = ++generation.current;
    if (!clinicId || tenantAccessState !== 'active') {
      setAudit([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const result = await supabase.from('audit_log').select('*').eq('clinic_id', clinicId).order('ts', { ascending: false }).limit(250);
      if (request !== generation.current) return;
      if (result.error) throw result.error;
      setAudit((result.data ?? []).map(mapAudit));
      setError(null);
    } catch (cause) {
      if (request !== generation.current) return;
      console.error('[MedicsPro] auditoria:', cause);
      setError('Não foi possível carregar a auditoria da clínica.');
      throw cause;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [clinicId, tenantAccessState]);

  useEffect(() => { void refreshAudit().catch(() => undefined); }, [refreshAudit]);

  const value = useMemo<AuditState>(() => ({ audit, loading, error, refreshAudit }), [audit, loading, error, refreshAudit]);
  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit(): AuditState {
  const context = useContext(AuditContext);
  if (!context) throw new Error('useAudit deve ser usado dentro de AuditProvider');
  return context;
}
