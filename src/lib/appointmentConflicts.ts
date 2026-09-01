import type { Appointment } from './types';

export type AppointmentConflictKind = 'professional' | 'room' | 'patient';

export interface AppointmentConflict {
  kind: AppointmentConflictKind;
  appointment: Appointment;
}

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export function intervalsOverlap(startA: string, endA: string, startB: string, endB: string) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

export function findAppointmentConflicts(
  appointments: Appointment[],
  candidate: Pick<Appointment, 'data' | 'inicio' | 'fim' | 'fisioId' | 'roomId' | 'pacienteId'>,
  ignoreId?: string,
): AppointmentConflict[] {
  const sameTime = appointments.filter((appointment) =>
    appointment.id !== ignoreId
    && appointment.status !== 'cancelado'
    && appointment.data === candidate.data
    && intervalsOverlap(candidate.inicio, candidate.fim, appointment.inicio, appointment.fim)
  );

  const conflicts: AppointmentConflict[] = [];
  for (const appointment of sameTime) {
    if (appointment.fisioId === candidate.fisioId) conflicts.push({ kind: 'professional', appointment });
    if (candidate.roomId && appointment.roomId === candidate.roomId) conflicts.push({ kind: 'room', appointment });
    if (appointment.pacienteId === candidate.pacienteId) conflicts.push({ kind: 'patient', appointment });
  }

  return conflicts;
}

export const conflictLabel = (kind: AppointmentConflictKind) => ({
  professional: 'O profissional já possui atendimento neste horário.',
  room: 'A sala/recurso já está ocupado neste horário.',
  patient: 'O paciente já possui atendimento neste horário.',
}[kind]);
