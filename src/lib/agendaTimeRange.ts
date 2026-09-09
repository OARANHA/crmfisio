import type { Appointment } from './types';

export const AGENDA_BASE_START = 7 * 60;
export const AGENDA_BASE_END = 19 * 60;
export const AGENDA_SLOT_MINUTES = 30;
export const AGENDA_RANGE_MARGIN_MINUTES = 30;

export type AgendaTimeRange = {
  startMinute: number;
  endMinute: number;
};

const MINUTE_MAX = 24 * 60;

export function agendaClockToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`invalid_agenda_clock:${value}`);
  }
  return hour * 60 + minute;
}

const floorToSlot = (minute: number, slotMinutes: number) => Math.floor(minute / slotMinutes) * slotMinutes;
const ceilToSlot = (minute: number, slotMinutes: number) => Math.ceil(minute / slotMinutes) * slotMinutes;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function resolveAgendaTimeRange(
  appointments: readonly Pick<Appointment, 'inicio' | 'fim'>[],
  options: {
    baseStart?: number;
    baseEnd?: number;
    slotMinutes?: number;
    marginMinutes?: number;
  } = {},
): AgendaTimeRange {
  const baseStart = options.baseStart ?? AGENDA_BASE_START;
  const baseEnd = options.baseEnd ?? AGENDA_BASE_END;
  const slotMinutes = options.slotMinutes ?? AGENDA_SLOT_MINUTES;
  const marginMinutes = options.marginMinutes ?? AGENDA_RANGE_MARGIN_MINUTES;

  let earliest = baseStart;
  let latest = baseEnd;

  for (const appointment of appointments) {
    const start = agendaClockToMinutes(appointment.inicio);
    const end = agendaClockToMinutes(appointment.fim);
    earliest = Math.min(earliest, start);
    latest = Math.max(latest, end);
  }

  const startMinute = earliest < baseStart
    ? clamp(floorToSlot(earliest - marginMinutes, slotMinutes), 0, baseStart)
    : baseStart;
  const endMinute = latest > baseEnd
    ? clamp(ceilToSlot(latest + marginMinutes, slotMinutes), baseEnd, MINUTE_MAX)
    : baseEnd;

  return { startMinute, endMinute };
}

export function buildAgendaGridSlots(range: AgendaTimeRange, slotMinutes = AGENDA_SLOT_MINUTES): number[] {
  return Array.from(
    { length: Math.floor((range.endMinute - range.startMinute) / slotMinutes) + 1 },
    (_, index) => range.startMinute + index * slotMinutes,
  );
}

export function appointmentFitsAgendaRange(
  appointment: Pick<Appointment, 'inicio' | 'fim'>,
  range: AgendaTimeRange,
): boolean {
  return agendaClockToMinutes(appointment.inicio) >= range.startMinute
    && agendaClockToMinutes(appointment.fim) <= range.endMinute;
}

export function appointmentAgendaGeometry(
  appointment: Pick<Appointment, 'inicio' | 'fim'>,
  range: AgendaTimeRange,
): { topMinutes: number; durationMinutes: number } {
  const start = agendaClockToMinutes(appointment.inicio);
  const end = agendaClockToMinutes(appointment.fim);
  return {
    topMinutes: start - range.startMinute,
    durationMinutes: Math.max(end - start, 1),
  };
}
