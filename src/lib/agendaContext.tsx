import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import { insertAppointment, mapAppointment, updateAppointmentStatus } from './repository';
import type { Appointment, AppointmentStatus } from './types';

interface AgendaState {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  refreshAgenda: () => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<Appointment>;
  setAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void>;
}

const AgendaContext = createContext<AgendaState | null>(null);

/**
 * Estado canônico da agenda operacional da clínica.
 *
 * A agenda é carregada e mutada isoladamente do agregado global. Isso permite
 * evoluir para janelas de data/paginação sem fazer o login carregar toda a
 * história da clínica e sem acoplar componentes ao store legado.
 */
export function AgendaProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refreshAgenda = useCallback(async () => {
    const request = ++generation.current;
    if (!clinicId || tenantAccessState !== 'active') {
      setAppointments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('data', { ascending: false });

      if (request !== generation.current) return;
      if (queryError) throw queryError;
      setAppointments((data ?? []).map(mapAppointment));
      setError(null);
    } catch (cause) {
      if (request !== generation.current) return;
      console.error('[MedicsPro] agenda:', cause);
      setError('Não foi possível carregar a agenda.');
      throw cause;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [clinicId, tenantAccessState]);

  useEffect(() => {
    void refreshAgenda().catch(() => undefined);
  }, [refreshAgenda]);

  const addAppointment = useCallback(async (appointment: Omit<Appointment, 'id'>) => {
    if (!clinicId) throw new Error('Clínica não identificada');
    const created = await insertAppointment(clinicId, appointment);
    setAppointments((current) => [created, ...current]);
    return created;
  }, [clinicId]);

  const setAppointmentStatus = useCallback(async (id: string, status: AppointmentStatus) => {
    let previous: Appointment | undefined;
    setAppointments((current) => current.map((item) => {
      if (item.id !== id) return item;
      previous = item;
      return { ...item, status };
    }));

    try {
      await updateAppointmentStatus(id, status);
    } catch (cause) {
      if (previous) {
        const rollback = previous;
        setAppointments((current) => current.map((item) => item.id === id ? rollback : item));
      }
      throw cause;
    }
  }, []);

  const value = useMemo<AgendaState>(() => ({
    appointments,
    loading,
    error,
    refreshAgenda,
    addAppointment,
    setAppointmentStatus,
  }), [appointments, loading, error, refreshAgenda, addAppointment, setAppointmentStatus]);

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>;
}

export function useAgenda(): AgendaState {
  const context = useContext(AgendaContext);
  if (!context) throw new Error('useAgenda deve ser usado dentro de AgendaProvider');
  return context;
}
