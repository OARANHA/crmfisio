import type { Appointment, User } from './types';

const toMin = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

export const CAPACITY_DAY_START = 7 * 60;
export const CAPACITY_DAY_END = 19 * 60;
export const CAPACITY_DAY_MINUTES = CAPACITY_DAY_END - CAPACITY_DAY_START;

export interface ProfessionalCapacity {
  professional: User;
  appointments: Appointment[];
  bookedMinutes: number;
  freeMinutes: number;
  occupancyPercent: number;
  sessions: number;
}

export function appointmentDurationMinutes(appointment: Appointment) {
  return Math.max(0, toMin(appointment.fim) - toMin(appointment.inicio));
}

export function buildProfessionalCapacity(
  appointments: Appointment[],
  professionals: User[],
  day: string,
): ProfessionalCapacity[] {
  return professionals
    .filter((professional) => professional.ativo !== false)
    .map((professional) => {
      const dayAppointments = appointments
        .filter((appointment) => appointment.data === day)
        .filter((appointment) => appointment.fisioId === professional.id)
        .filter((appointment) => !['cancelado', 'faltou'].includes(appointment.status))
        .sort((a, b) => a.inicio.localeCompare(b.inicio));
      const bookedMinutes = dayAppointments.reduce((total, appointment) => total + appointmentDurationMinutes(appointment), 0);
      const boundedBookedMinutes = Math.min(CAPACITY_DAY_MINUTES, bookedMinutes);
      return {
        professional,
        appointments: dayAppointments,
        bookedMinutes,
        freeMinutes: Math.max(0, CAPACITY_DAY_MINUTES - boundedBookedMinutes),
        occupancyPercent: Math.round((boundedBookedMinutes / CAPACITY_DAY_MINUTES) * 100),
        sessions: dayAppointments.length,
      };
    })
    .sort((a, b) => b.occupancyPercent - a.occupancyPercent || a.professional.nome.localeCompare(b.professional.nome, 'pt-BR'));
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, '0')}`;
}
