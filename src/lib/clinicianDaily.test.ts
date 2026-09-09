import { describe, expect, it } from 'vitest';
import {
  activeEncounterStartedLabel,
  clinicianEncounterPath,
  filterAgendaAppointments,
  resolveProfessionalActiveEncounter,
  summarizeAgendaPeriod,
} from './clinicianDaily';
import type { Appointment, AppointmentStatus } from './types';

const appointment = (
  id: string,
  status: AppointmentStatus,
  overrides: Partial<Appointment> = {},
): Appointment => ({
  id,
  pacienteId: 'patient-a',
  professionalId: 'professional-a',
  fisioId: 'professional-a',
  roomId: 'room-a',
  data: '2026-09-09',
  inicio: '10:00',
  fim: '10:40',
  status,
  tipo: 'Consulta',
  valor: 20000,
  pacoteId: null,
  serieId: null,
  notas: '',
  ...overrides,
});

describe('clinician daily operational view', () => {
  it('keeps an own active encounter visible even when it started on a previous date', () => {
    const previousDay = appointment('active-yesterday', 'em_atendimento', { data: '2026-09-08', inicio: '17:00' });
    const todayScheduled = appointment('today', 'confirmado');

    expect(resolveProfessionalActiveEncounter([previousDay, todayScheduled], 'professional-a')).toEqual(previousDay);
    expect(activeEncounterStartedLabel(previousDay, new Date('2026-09-09T12:00:00'))).toBe('Iniciado ontem às 17:00');
  });

  it('builds the canonical patient/session destination for continuing care', () => {
    const active = appointment('session-123', 'em_atendimento', { pacienteId: 'patient-456' });
    expect(clinicianEncounterPath(active)).toBe('/pacientes/patient-456?session=session-123#clinical-workspace');
  });

  it('fails closed when more than one own active encounter exists', () => {
    const first = appointment('one', 'em_atendimento', { pacienteId: 'patient-a' });
    const second = appointment('two', 'em_atendimento', { pacienteId: 'patient-b' });
    expect(resolveProfessionalActiveEncounter([first, second], 'professional-a')).toBeNull();
  });
});

describe('agenda summary navigation contract', () => {
  const period = [
    appointment('pending', 'agendado', { valor: 10000 }),
    appointment('confirmed', 'confirmado', { valor: 12000 }),
    appointment('service', 'em_atendimento', { valor: 15000 }),
    appointment('finished', 'finalizado', { valor: 20000 }),
    appointment('missed', 'faltou', { valor: 18000 }),
    appointment('cancelled', 'cancelado', { valor: 9000 }),
  ];

  it('filters Pendentes, Em atendimento and Finalizados without changing the period source', () => {
    expect(filterAgendaAppointments(period, 'pending').map((item) => item.id)).toEqual(['pending']);
    expect(filterAgendaAppointments(period, 'in_service').map((item) => item.id)).toEqual(['service']);
    expect(filterAgendaAppointments(period, 'finished').map((item) => item.id)).toEqual(['finished']);
    expect(period).toHaveLength(6);
  });

  it('restores the full selected-period view when the status filter is cleared', () => {
    expect(filterAgendaAppointments(period, null)).toEqual(period);
  });

  it('keeps metrics numerically coherent with the selected period independently of navigation filter', () => {
    expect(summarizeAgendaPeriod(period)).toEqual({
      total: 5,
      confirmed: 1,
      inService: 1,
      finished: 1,
      pending: 1,
      missed: 1,
      nominalValue: 57000,
    });
    expect(summarizeAgendaPeriod(period)).toEqual(summarizeAgendaPeriod(filterAgendaAppointments(period, null)));
  });
});
