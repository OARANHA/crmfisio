import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { isCancelledError, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import { insertAppointment, mapAppointment, updateAppointmentStatus } from './repository';
import { agendaQueryKey } from './clinicQuery';
import type { Database } from './database.types';
import type { Appointment, AppointmentStatus, Role } from './types';

interface AgendaState {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  refreshAgenda: () => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<Appointment>;
  setAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void>;
}

type AppointmentRow = Database['public']['Tables']['appointments']['Row'];
type AppointmentQueryResult = { data: AppointmentRow[] | null; error: unknown };

const AgendaContext = createContext<AgendaState | null>(null);

async function awaitAbortable<T>(request: PromiseLike<T> & { abortSignal?: (signal: AbortSignal) => PromiseLike<T> }, signal: AbortSignal): Promise<T> {
  return typeof request.abortSignal === 'function' ? await request.abortSignal(signal) : await request;
}

async function loadAgenda(clinicId: string, signal: AbortSignal): Promise<Appointment[]> {
  const request = supabase
    .from('appointments')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('data', { ascending: false });
  const typedRequest = request as unknown as PromiseLike<AppointmentQueryResult> & {
    abortSignal?: (nextSignal: AbortSignal) => PromiseLike<AppointmentQueryResult>;
  };
  const { data, error } = await awaitAbortable(typedRequest, signal);
  if (error) throw error;
  return (data ?? []).map(mapAppointment);
}

/**
 * Estado canônico da agenda operacional da clínica.
 * TanStack Query orquestra apenas o server-state do frontend; RLS/RPCs seguem
 * como autoridade e o QueryClient é isolado pelo ClinicDataBoundary.
 */
export function AgendaProvider({ children }: { children: ReactNode }) {
  const { session, profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const userId = session?.user.id ?? null;
  const role = (profile?.role ?? null) as Role | null;
  const enabled = Boolean(clinicId && userId && role && tenantAccessState === 'active');
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => agendaQueryKey({ clinicId, userId, role }), [clinicId, userId, role]);
  const queryFn = useCallback(({ signal }: { signal: AbortSignal }) => loadAgenda(clinicId!, signal), [clinicId]);
  const { data: agendaData, error: queryError, isFetching, refetch } = useQuery({ queryKey, queryFn, enabled });

  const refreshAgenda = useCallback(async () => {
    if (!enabled) return;
    try {
      await refetch({ cancelRefetch: true, throwOnError: true });
    } catch (cause) {
      if (isCancelledError(cause)) return;
      console.error('[MedicsPro] agenda:', cause);
      throw cause;
    }
  }, [enabled, refetch]);

  const { mutateAsync: addAppointmentMutation } = useMutation({
    mutationFn: async (appointment: Omit<Appointment, 'id'>) => {
      if (!clinicId) throw new Error('Clínica não identificada');
      return insertAppointment(clinicId, appointment);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey, exact: true });
    },
    onSuccess: async (created) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<Appointment[]>(queryKey, (current = []) => [created, ...current]);
    },
  });

  const { mutateAsync: setAppointmentStatusMutation } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointmentStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = queryClient.getQueryData<Appointment[]>(queryKey) ?? [];
      queryClient.setQueryData<Appointment[]>(queryKey, previous.map((item) => item.id === id ? { ...item, status } : item));
      return { previous };
    },
    onError: (_cause, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: async (_result, { id, status }) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<Appointment[]>(queryKey, (current = []) => current.map((item) => item.id === id ? { ...item, status } : item));
    },
  });

  const addAppointment = useCallback((appointment: Parameters<typeof addAppointmentMutation>[0]) => addAppointmentMutation(appointment), [addAppointmentMutation]);
  const setAppointmentStatus = useCallback(async (id: string, status: AppointmentStatus) => {
    await setAppointmentStatusMutation({ id, status });
  }, [setAppointmentStatusMutation]);
  const error = queryError ? 'Não foi possível carregar a agenda.' : null;
  const value = useMemo<AgendaState>(() => ({
    appointments: enabled ? (agendaData ?? []) : [],
    loading: enabled ? isFetching : false,
    error,
    refreshAgenda,
    addAppointment,
    setAppointmentStatus,
  }), [enabled, agendaData, isFetching, error, refreshAgenda, addAppointment, setAppointmentStatus]);

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>;
}

export function useAgenda(): AgendaState {
  const context = useContext(AgendaContext);
  if (!context) throw new Error('useAgenda deve ser usado dentro de AgendaProvider');
  return context;
}
