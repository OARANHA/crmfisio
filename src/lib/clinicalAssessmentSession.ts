import { professionalIdOf } from './professionalReference';
import type { Appointment } from './types';

export function findOwnActiveAssessmentAppointment(
  appointments: Appointment[],
  patientId: string,
  professionalId: string | null,
): Appointment | null {
  if (!professionalId) return null;
  return appointments.find((appointment) =>
    appointment.pacienteId === patientId
    && appointment.status === 'em_atendimento'
    && professionalIdOf(appointment) === professionalId,
  ) ?? null;
}
