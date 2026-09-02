import { describe, expect, it } from 'vitest';
import { buildReactivationSelection } from './reactivationEligibility';
import type { MessageOutboxRow } from '../../lib/messageOutbox';
import type { Appointment, Patient } from '../../lib/types';

const now = new Date('2026-09-02T12:00:00');
const patient = (id: string, overrides: Partial<Patient> = {}): Patient => ({
  id, nome: `Paciente ${id}`, nascimento: '1990-01-01', telefone: '51999999999', email: '', cpf: '',
  convenio: null, queixaPrincipal: '', cid10: [], funilStage: 'tratamento', status: 'ativo',
  ultimaVisita: null, createdAt: '2026-01-01', optInWhats: true,
  anamnese: { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
  ...overrides,
});
const appointment = (id: string, patientId: string, data: string, status: Appointment['status']): Appointment => ({
  id, pacienteId: patientId, fisioId: 'f1', roomId: 'r1', data, inicio: '09:00', fim: '10:00',
  status, tipo: 'Fisioterapia', valor: 15000, pacoteId: null, serieId: null, notas: '',
});
const log = (patientId: string, createdAt: string): MessageOutboxRow => ({
  id: 'w1', patientId, appointmentId: null, waitlistId: null, template: 'reativacao', message: '',
  status: 'entregue', createdAt, scheduledFor: createdAt, provider: 'evolution', errorMessage: null,
  replyText: null, repliedAt: null, responseAction: null, needsHuman: false, reviewResolution: null,
  reviewNote: null, reviewResolvedAt: null,
});

describe('buildReactivationSelection', () => {
  it('seleciona paciente inativo operacionalmente, com opt-in e sem agenda futura', () => {
    const result = buildReactivationSelection({
      patients: [patient('p1')],
      appointments: [appointment('a1', 'p1', '2026-07-01', 'finalizado')],
      logs: [], now,
    });
    expect(result.candidates.map((item) => item.patientId)).toEqual(['p1']);
  });

  it('bloqueia paciente que já possui sessão futura', () => {
    const result = buildReactivationSelection({
      patients: [patient('p1')],
      appointments: [
        appointment('a1', 'p1', '2026-07-01', 'finalizado'),
        appointment('a2', 'p1', '2026-09-10', 'agendado'),
      ],
      logs: [], now,
    });
    expect(result.candidates).toHaveLength(0);
    expect(result.stats.futureAppointment).toBe(1);
  });

  it('respeita cooldown, opt-in e telefone', () => {
    const patients = [
      patient('cooldown'),
      patient('optout', { optInWhats: false }),
      patient('semfone', { telefone: '' }),
    ];
    const appointments = patients.map((item, index) => appointment(`a${index}`, item.id, '2026-07-01', 'finalizado'));
    const result = buildReactivationSelection({ patients, appointments, logs: [log('cooldown', '2026-08-20T12:00:00Z')], now });

    expect(result.candidates).toHaveLength(0);
    expect(result.stats).toMatchObject({ cooldown: 1, noOptin: 1, noPhone: 1 });
  });
});
