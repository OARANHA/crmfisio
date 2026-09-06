import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import type { Database } from './database.types';
import type { User } from './types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const mapProfile = (row: ProfileRow): User => ({
  id: row.id,
  nome: row.nome,
  email: row.email,
  role: row.role,
  registro: row.registro ?? '',
  cor: row.cor ?? '#cbd5e1',
  ativo: row.ativo,
});

interface ClinicDirectoryState {
  users: User[];
  loading: boolean;
  error: string | null;
  refreshDirectory: () => Promise<void>;
}

const ClinicDirectoryContext = createContext<ClinicDirectoryState | null>(null);

export function ClinicDirectoryProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refreshDirectory = useCallback(async () => {
    const request = ++generation.current;
    if (!clinicId || tenantAccessState !== 'active') {
      setUsers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const result = await supabase.from('profiles').select('*').eq('clinic_id', clinicId).eq('ativo', true).order('nome');
      if (request !== generation.current) return;
      if (result.error) throw result.error;
      setUsers((result.data ?? []).map(mapProfile));
      setError(null);
    } catch (cause) {
      if (request !== generation.current) return;
      console.error('[MedicsPro] diretório da clínica:', cause);
      setError('Não foi possível carregar a equipe da clínica.');
      throw cause;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [clinicId, tenantAccessState]);

  useEffect(() => { void refreshDirectory().catch(() => undefined); }, [refreshDirectory]);

  const value = useMemo<ClinicDirectoryState>(() => ({ users, loading, error, refreshDirectory }), [users, loading, error, refreshDirectory]);
  return <ClinicDirectoryContext.Provider value={value}>{children}</ClinicDirectoryContext.Provider>;
}

export function useClinicDirectory(): ClinicDirectoryState {
  const context = useContext(ClinicDirectoryContext);
  if (!context) throw new Error('useClinicDirectory deve ser usado dentro de ClinicDirectoryProvider');
  return context;
}
