import { describe, expect, it } from 'vitest';
import {
  AGENDA_BASE_END,
  AGENDA_BASE_START,
  appointmentAgendaGeometry,
  appointmentFitsAgendaRange,
  resolveAgendaTimeRange,
} from './agendaTimeRange';
import type { Appointment } from './types';

const appointment = (id: string, inicio: string, fim: string): Appointment => ({
  id,
  pacienteId: `patient-${id}`,
  professionalId: 'professional-a',
  fisioId: 'professional-a',
  roomId: 'room-a',
  data: '2026-09-09',
  inicio,
  fim,
  status: 'confirmado',
  tipo: 'Consulta',
  valor: 10000,
  pacoteId: null,
  serieId: null,
  notas: '',
});

describe('dynamic agenda time range', () => {
  it('keeps the comfortable 07:00–19:00 base when appointments fit inside it', () => {
    expect(resolveAgendaTimeRange([appointment('base', '08:00', '18:00')])).toEqual({
      startMinute: AGENDA_BASE_START,
      endMinute: AGENDA_BASE_END,
    });
  });

  it('expands after the base range so a 20:00 appointment remains inside the rendered grid', () => {
    const late = appointment('late', '20:00', '20:40');
    const range = resolveAgendaTimeRange([late]);
    const geometry = appointmentAgendaGeometry(late, range);

    expect(range.startMinute).toBe(AGENDA_BASE_START);
    expect(range.endMinute).toBeGreaterThanOrEqual(21 * 60);
    expect(appointmentFitsAgendaRange(late, range)).toBe(true);
    expect(geometry.topMinutes + geometry.durationMinutes).toBeLessThanOrEqual(range.endMinute - range.startMinute);
  });

  it('expands before the base range so an appointment before 07:00 remains inside the rendered grid', () => {
    const early = appointment('early', '06:20', '07:10');
    const range = resolveAgendaTimeRange([early]);

    expect(range.startMinute).toBeLessThanOrEqual(6 * 60);
    expect(range.endMinute).toBe(AGENDA_BASE_END);
    expect(appointmentFitsAgendaRange(early, range)).toBe(true);
  });

  it('guarantees every appointment in the selected period fits inside the resolved temporal range', () => {
    const period = [
      appointment('very-early', '05:50', '06:30'),
      appointment('normal', '11:00', '11:40'),
      appointment('late', '20:00', '20:40'),
      appointment('very-late', '22:30', '23:20'),
    ];
    const range = resolveAgendaTimeRange(period);

    expect(period.every((item) => appointmentFitsAgendaRange(item, range))).toBe(true);
  });
});
