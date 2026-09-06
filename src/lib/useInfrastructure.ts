import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { loadInfrastructure } from './infrastructure';
import { useAuth } from './useAuth';
import type { Room, Unidade } from './types';

const emptyData: { unidades: Unidade[]; rooms: Room[] } = { unidades: [], rooms: [] };

/** Owns unit/room loading and selection independently of the compatibility shell. */
export function useInfrastructure() {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = tenantAccessState === 'active' ? profile?.clinic_id : null;
  const scope = clinicId ? `${profile?.id}:${clinicId}:${profile?.role}` : null;
  const generation = useRef(0);
  const [state, setState] = useState({ scope, data: emptyData, loading: false, error: null as string | null });
  const [selection, setSelection] = useState({ scope, id: 'all' });

  const refreshInfrastructure = useCallback(async () => {
    if (!clinicId || !scope) throw new Error('Clínica não identificada');
    const request = ++generation.current;
    setState((current) => ({ scope, data: current.scope === scope ? current.data : emptyData, loading: true, error: null }));
    try {
      const data = await loadInfrastructure(clinicId);
      if (request !== generation.current) return;
      setState({ scope, data, loading: false, error: null });
      setSelection((current) => ({ scope, id: current.scope === scope && data.unidades.some((unit) => unit.id === current.id) ? current.id : 'all' }));
    } catch (cause) {
      if (request !== generation.current) return;
      setState((current) => ({ ...current, loading: false, error: 'Não foi possível carregar unidades e salas.' }));
      throw cause;
    }
  }, [clinicId, scope]);

  // Invalidate pending requests at session changes and before unmount.
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
  return {
    ...visible.data,
    loading: visible.loading,
    error: visible.error,
    unidadeSel: selection.scope === scope ? selection.id : 'all',
    setUnidadeSel,
    refreshInfrastructure,
  };
}
