import { addDays, format } from 'date-fns';
import type { Appointment, Room } from './types';

export interface AvailabilitySearch {
  durationMin: number;
  period: 'qualquer' | 'manha' | 'tarde';
  daysAhead: number;
  fisioId: string;
  unitId: string;
  roomId: string;
}

export interface AvailabilitySlot {
  date: string;
  start: string;
  end: string;
  fisioId: string;
  roomId: string;
}

const DAY_START = 7 * 60;
const DAY_END = 19 * 60;
const STEP = 30;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const inPeriod = (minute: number, period: AvailabilitySearch['period']) => {
  if (period === 'manha') return minute < 12 * 60;
  if (period === 'tarde') return minute >= 12 * 60;
  return true;
};

export function findAvailability({
  appointments,
  rooms,
  fisioIds,
  search,
  from = new Date(),
  limit = 24,
}: {
  appointments: Appointment[];
  rooms: Room[];
  fisioIds: string[];
  search: AvailabilitySearch;
  from?: Date;
  limit?: number;
}): AvailabilitySlot[] {
  const candidateRooms = rooms.filter((room) =>
    (search.unitId === 'all' || room.unidadeId === search.unitId) &&
    (search.roomId === 'all' || room.id === search.roomId));
  const candidateFisios = search.fisioId === 'all' ? fisioIds : fisioIds.filter((id) => id === search.fisioId);
  const active = appointments.filter((appointment) => !['cancelado', 'faltou'].includes(appointment.status));
  const results: AvailabilitySlot[] = [];

  for (let day = 0; day <= search.daysAhead && results.length < limit; day += 1) {
    const date = addDays(from, day);
    const iso = format(date, 'yyyy-MM-dd');
    const isToday = day === 0;
    const nowMinute = from.getHours() * 60 + from.getMinutes();

    for (const fisioId of candidateFisios) {
      for (const room of candidateRooms) {
        for (let start = DAY_START; start + search.durationMin <= DAY_END; start += STEP) {
          if (isToday && start <= nowMinute) continue;
          if (!inPeriod(start, search.period)) continue;
          const end = start + search.durationMin;
          const conflict = active.some((appointment) =>
            appointment.data === iso &&
            (appointment.fisioId === fisioId || appointment.roomId === room.id) &&
            toMin(appointment.inicio) < end &&
            toMin(appointment.fim) > start);
          if (conflict) continue;
          results.push({ date: iso, start: toHHMM(start), end: toHHMM(end), fisioId, roomId: room.id });
          if (results.length >= limit) return results;
        }
      }
    }
  }
  return results;
}
