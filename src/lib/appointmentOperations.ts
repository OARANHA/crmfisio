import { supabase } from './supabaseClient';
import type { Appointment } from './types';

interface RescheduleInput {
  appointmentId: string;
  data: string;
  inicio: string;
  fim: string;
  fisioId: string;
  roomId: string;
  reason: string;
  isFitIn?: boolean;
}

const mapRpcAppointment = (row: Record<string, unknown>): Appointment => ({
  id: String(row.id),
  pacienteId: String(row.paciente_id),
  fisioId: String(row.fisio_id),
  roomId: row.room_id ? String(row.room_id) : '',
  data: String(row.data),
  inicio: String(row.inicio).slice(0, 5),
  fim: String(row.fim).slice(0, 5),
  status: row.status as Appointment['status'],
  tipo: String(row.tipo),
  valor: Number(row.valor),
  pacoteId: row.pacote_id ? String(row.pacote_id) : null,
  serieId: row.serie_id ? String(row.serie_id) : null,
  notas: row.notas ? String(row.notas) : '',
});

export async function cancelAppointmentWithReason(appointmentId: string, reason: string): Promise<void> {
  const { error } = await (supabase.rpc as Function)('cancel_appointment_with_reason', {
    p_appointment_id: appointmentId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function rescheduleAppointment(input: RescheduleInput): Promise<Appointment> {
  const { data, error } = await (supabase.rpc as Function)('reschedule_appointment', {
    p_appointment_id: input.appointmentId,
    p_data: input.data,
    p_inicio: input.inicio,
    p_fim: input.fim,
    p_fisio_id: input.fisioId,
    p_room_id: input.roomId,
    p_reason: input.reason,
    p_is_fit_in: input.isFitIn ?? false,
  });
  if (error) throw error;
  if (!data) throw new Error('Remarcação concluída sem retornar o novo atendimento');
  return mapRpcAppointment(data as Record<string, unknown>);
}
