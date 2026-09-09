import { supabase } from './supabaseClient';
import type { Appointment, AppointmentStatus } from './types';

interface RescheduleInput {
  appointmentId: string;
  data: string;
  inicio: string;
  fim: string;
  professionalId?: string;
  /** @deprecated Temporary frontend alias during the staged professionalId cutover. */
  fisioId?: string;
  roomId: string;
  reason: string;
  isFitIn?: boolean;
}

type AppointmentStatusMutationRow = {
  id: string;
  status: AppointmentStatus;
};

type AppointmentStatusMutationResult = {
  data: AppointmentStatusMutationRow[] | null;
  error: unknown;
};

const mapRpcAppointment = (row: Record<string, unknown>): Appointment => {
  const professionalId = String(row.professional_id ?? row.fisio_id);
  return {
    id: String(row.id),
    pacienteId: String(row.paciente_id),
    professionalId,
    fisioId: professionalId,
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
  };
};

export function verifyAppointmentStatusMutation(
  result: AppointmentStatusMutationResult,
  expectedAppointmentId: string,
  expectedStatus: AppointmentStatus,
): AppointmentStatusMutationRow {
  if (result.error) throw result.error;

  const rows = result.data ?? [];
  if (rows.length !== 1) {
    throw new Error('appointment_status_update_not_persisted');
  }

  const [row] = rows;
  if (row.id !== expectedAppointmentId) {
    throw new Error('appointment_status_update_wrong_appointment');
  }
  if (row.status !== expectedStatus) {
    throw new Error('appointment_status_update_wrong_status');
  }

  return row;
}

/**
 * Single low-level primitive for appointment status persistence. Both the
 * repository/Agenda path and the clinical compatibility alias delegate here.
 */
export async function executeVerifiedAppointmentStatusMutation(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<AppointmentStatusMutationRow> {
  const result = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId)
    .select('id,status');

  return verifyAppointmentStatusMutation(
    result as AppointmentStatusMutationResult,
    appointmentId,
    status,
  );
}

/** @deprecated Use repository.updateAppointmentStatus() in application code. */
export async function updateAppointmentStatusVerified(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<AppointmentStatusMutationRow> {
  return executeVerifiedAppointmentStatusMutation(appointmentId, status);
}

export async function cancelAppointmentWithReason(appointmentId: string, reason: string): Promise<void> {
  const { error } = await (supabase.rpc as Function)('cancel_appointment_with_reason', {
    p_appointment_id: appointmentId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function rescheduleAppointment(input: RescheduleInput): Promise<Appointment> {
  const professionalId = input.professionalId ?? input.fisioId;
  if (!professionalId) throw new Error('Profissional obrigatório para remarcação');

  const { data, error } = await (supabase.rpc as Function)('reschedule_appointment', {
    p_appointment_id: input.appointmentId,
    p_data: input.data,
    p_inicio: input.inicio,
    p_fim: input.fim,
    // RPC parameter stays legacy until the database contract is migrated.
    p_fisio_id: professionalId,
    p_room_id: input.roomId,
    p_reason: input.reason,
    p_is_fit_in: input.isFitIn ?? false,
  });
  if (error) throw error;
  if (!data) throw new Error('Remarcação concluída sem retornar o novo atendimento');
  return mapRpcAppointment(data as Record<string, unknown>);
}
