import { supabase } from './supabaseClient';

export type ReceptionQueueItem = {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  professional_id: string;
  professional_name: string;
  room_name: string;
  unit_name: string;
  inicio: string;
  fim: string;
  status: 'agendado' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'faltou' | 'cancelado';
  tipo: string;
  arrived_at: string | null;
  whatsapp_status: string | null;
};

type RpcResult<T> = PromiseLike<{ data: T | null; error: { message?: string } | null }>;
type RpcGateway = (fn: string, args?: Record<string, unknown>) => RpcResult<unknown>;
const rpc = supabase.rpc.bind(supabase) as unknown as RpcGateway;

export async function loadReceptionToday(): Promise<ReceptionQueueItem[]> {
  const { data, error } = await rpc('reception_today_queue');
  if (error) throw new Error(error.message || 'Falha ao carregar recepção');
  return (Array.isArray(data) ? data : []) as ReceptionQueueItem[];
}

export async function setAppointmentArrival(appointmentId: string, arrived: boolean): Promise<void> {
  const { error } = await rpc('set_appointment_arrival', {
    p_appointment_id: appointmentId,
    p_arrived: arrived,
  });
  if (error) throw new Error(error.message || 'Falha ao registrar chegada');
}
