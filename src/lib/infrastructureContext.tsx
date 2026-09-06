import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadInfrastructure } from './infrastructure';
import { useAuth } from './useAuth';
import type { Room, Unidade } from './types';

interface InfrastructureState {
  unidades: Unidade[];
  rooms: Room[];
  loading: boolean;
  error: string | null;
  unidadeSel: string;
  setUnidadeSel: (id: string) => void;
  refreshInfrastructure: () => Promise<void>;
}

const InfrastructureContext = createContext<InfrastructureState | null>(null);
const emptyData: { unidades: Unidade[]; rooms: Room[] } = { unidades: [], rooms: [] };

/**
 * Canonical owner for clinic units, rooms and the active unit selection.
 * Keeping this state in one provider prevents duplicate infrastructure loads
 * and divergent unit filters across screens.
 */
export function InfrastructureProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = tenantAccessState === 'active' ? profile?.clinic_id : null;
  const scope = clinicId ? `${profile?.id}:${clinicId}:${profile?.role}` : null;
  const generation = useRef(0);
  const [state, setState] = useState({ scope, data: emptyData, loading: false, error: null as string | null });
  const [selection, setSelection] = useState({ scope, id: 'all' });

  const refreshInfrastructure = useCallback(async () => {
    if (!clinicId || !scope) throw new Error('Clínica não identificada');
    const request = ++generation.current;
    setState((current) => ({
      scope,
      data: current.scope === scope ? current.data : emptyData,
      loading: true,
      error: null,
    }));

    try {
      const data = await loadInfrastructure(clinicId);
      if (request !== generation.current) return;
      setState({ scope, data, loading: false, error: null });
      setSelection((current) => ({
        scope,
        id: current.scope === scope && data.unidades.some((unit) => unit.id === current.id) ? current.id : 'all',
      }));
    } catch (cause) {
      if (request !== generation.current) return;
      setState((current) => ({ ...current, loading: false, error: 'Não foi possível carregar unidades e salas.' }));
      throw cause;
    }
  }, [clinicId, scope]);

  useLayoutEffect(() => {
    if (scope) void refreshInfrastructure().catch(() => undefined);
    else {
      setState({ scope, data: emptyData, loading: false, error: null });
      setSelection({ scope, id: 'all' });
    }
    return () => { generation.current += 1; };
  }, [scope, refreshInfrastructure]);

  const setUnidadeSel = useCallback((id: string) => setSelection({ scope, id }), [scope]);
  const visible = state.scope === scope && scope ? state : { data: emptyData, loading: false, error: null };

  const value = useMemo<InfrastructureState>(() => ({
    ...visible.data,
    loading: visible.loading,
    error: visible.error,
    unidadeSel: selection.scope === scope ? selection.id : 'all',
    setUnidadeSel,
    refreshInfrastructure,
  }), [visible, selection.scope, selection.id, scope, setUnidadeSel, refreshInfrastructure]);

  return <InfrastructureContext.Provider value={value}>{children}</InfrastructureContext.Provider>;
}

export function useInfrastructure() {
  const context = useContext(InfrastructureContext);
  if (!context) throw new Error('useInfrastructure deve ser usado dentro de InfrastructureProvider');
  return context;
}
