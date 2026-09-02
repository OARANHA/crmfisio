import { describe, expect, it } from 'vitest';
import { calculateChurnRisk } from './churnRisk';
import type { Appointment, FinancialTransaction, Patient, PatientPackage } from './types';

const now = new Date('2026-09-02T12:00:00');
const patient: Patient = {
  id: 'p1', nome: 'Paciente Teste', nascimento: '1990-01-01', telefone: '51999999999',
  email: '', cpf: '', convenio: null, queixaPrincipal: '', cid10: [], funilStage: 'tratamento',
  status: 'ativo', ultimaVisita: null, createdAt: '2026-01-01', optInWhats: true,
  anamnese: { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
};

const appointment = (id: string, data: string, status: Appointment['status']): Appointment => ({
  id, pacienteId: patient.id, fisioId: 'f1', roomId: 'r1', data, inicio: '09:00', fim: '10:00',
  status, tipo: 'Fisioterapia', valor: 15000, pacoteId: null, serieId: null, notas: '',
});

describe('calculateChurnRisk', () => {
  it('classifica como alto risco quando há longa inatividade, faltas, pacote esgotado e atraso', () => {
    const appointments = [
      appointment('a1', '2026-07-20', 'finalizado'),
      appointment('a2', '2026-07-22', 'faltou'),
    ];
    const packages: PatientPackage[] = [{
      id: 'pp1', pacienteId: patient.id, pacoteId: 'pk1', sessoesTotais: 10,
      sessoesUsadas: 10, compraData: '2026-06-01', valorPago: 100000, status: 'esgotado',
    }];
    const transactions: FinancialTransaction[] = [{
      id: 't1', tipo: 'receber', descricao: 'Sessão', categoria: 'Atendimento', valor: 15000,
      vencimento: '2026-08-01', status: 'atrasado', pacienteId: patient.id, metodo: null, paidAt: null,
    }];

    const result = calculateChurnRisk(patient, appointments, packages, transactions, now);

    expect(result?.level).toBe('alto');
    expect(result?.score).toBe(100);
    expect(result?.reasons).toEqual(expect.arrayContaining([
      'sem próxima sessão', 'histórico elevado de faltas', 'pacote esgotado', 'financeiro em atraso',
    ]));
  });

  it('reduz o risco quando existe atendimento futuro', () => {
    const result = calculateChurnRisk(patient, [
      appointment('a1', '2026-08-10', 'finalizado'),
      appointment('a2', '2026-09-05', 'confirmado'),
    ], [], [], now);

    expect(result?.hasFutureAppointment).toBe(true);
    expect(result?.score).toBe(5);
    expect(result?.level).toBe('baixo');
  });

  it('ignora pacientes fora do tratamento ou anonimizados', () => {
    expect(calculateChurnRisk({ ...patient, funilStage: 'alta' }, [], [], [], now)).toBeNull();
    expect(calculateChurnRisk({ ...patient, anonimizado: true }, [], [], [], now)).toBeNull();
  });
});
