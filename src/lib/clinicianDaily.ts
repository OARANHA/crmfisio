import { format, isSameDay, subDays } from 'date-fns';
import { resolveOwnActiveEncounter } from './activeClinicalEncounter';
import { professionalIdOf } from './professionalReference';
import type { Appointment } from './types';

export type AgendaStatusFilter = 'pending' | 'in_service' | 'finished';

export type AgendaPeriodSummary = {
  total: number;
  confirmed: number;
  inService: number;
  finished: number;
  pending: number;
  missed: number;
  nominalValue: number;
};

/**
 * Resolve the one canonical active encounter owned by a professional across
 * every patient and date. The patient-scoped primitive remains the authority;
 * this wrapper only lifts it to the clinician's daily home.
 */
export function resolveProfessionalActiveEncounter(
  appointments: readonly Appointment[],
  professionalId: string | null | undefined,
): Appointment | null {
  if (!professionalId) return null;

  const candidatePatientIds = Array.from(new Set(
    appointments
      .filter((appointment) => appointment.status === 'em_atendimento' && professionalIdOf(appointment) === professionalId)
      .map((appointment) => appointment.pacienteId),
  ));

  const encounters = candidatePatientIds
    .map((patientId) => resolveOwnActiveEncounter(appointments, patientId, professionalId))
    .filter((appointment): appointment is Appointment => Boolean(appointment));

  // PostgreSQL should keep this cardinality at one. Fail closed if data drifts.
  return encounters.length === 1 ? encounters[0] : null;
}

export function clinicianEncounterPath(appointment: Pick<Appointment, 'id' | 'pacienteId'>): string {
  return `/pacientes/${appointment.pacienteId}?session=${appointment.id}#clinical-workspace`;
}

export function activeEncounterStartedLabel(appointment: Pick<Appointment, 'data' | 'inicio'>, now = new Date()): string {
  const encounterDate = new Date(`${appointment.data}T12:00:00`);
  const clock = appointment.inicio.slice(0, 5);
  if (isSameDay(encounterDate, now)) return `Iniciado hoje às ${clock}`;
  if (isSameDay(encounterDate, subDays(now, 1))) return `Iniciado ontem às ${clock}`;
  return `Iniciado em ${format(encounterDate, 'dd/MM')} às ${clock}`;
}

export function matchesAgendaStatusFilter(appointment: Appointment, filter: AgendaStatusFilter | null): boolean {
  if (!filter) return true;
  if (filter === 'pending') return appointment.status === 'agendado';
  if (filter === 'in_service') return appointment.status === 'em_atendimento';
  return appointment.status === 'finalizado';
}

export function filterAgendaAppointments(
  appointments: readonly Appointment[],
  filter: AgendaStatusFilter | null,
): Appointment[] {
  return appointments.filter((appointment) => matchesAgendaStatusFilter(appointment, filter));
}

export function summarizeAgendaPeriod(appointments: readonly Appointment[]): AgendaPeriodSummary {
  return {
    total: appointments.filter((appointment) => appointment.status !== 'cancelado').length,
    confirmed: appointments.filter((appointment) => appointment.status === 'confirmado').length,
    inService: appointments.filter((appointment) => appointment.status === 'em_atendimento').length,
    finished: appointments.filter((appointment) => appointment.status === 'finalizado').length,
    pending: appointments.filter((appointment) => appointment.status === 'agendado').length,
    missed: appointments.filter((appointment) => appointment.status === 'faltou').length,
    nominalValue: appointments
      .filter((appointment) => appointment.status !== 'cancelado' && appointment.status !== 'faltou')
      .reduce((sum, appointment) => sum + appointment.valor, 0),
  };
}
