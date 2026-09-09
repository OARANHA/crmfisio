import { describe, expect, it } from 'vitest';
import { rankAssessmentTemplatesForContext, resolveOwnActiveEncounter } from './activeClinicalEncounter';
import type { Appointment } from './types';

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'a-own',
  pacienteId: 'patient-a',
  professionalId: 'professional-a',
  fisioId: 'professional-a',
  roomId: 'room-a',
  data: '2026-09-08',
  inicio: '15:00',
  fim: '16:00',
  status: 'em_atendimento',
  tipo: 'Consulta',
  valor: 0,
  pacoteId: null,
  serieId: null,
  notas: '',
  ...overrides,
});

describe('resolveOwnActiveEncounter', () => {
  it('detects only the authenticated professional own active encounter', () => {
    expect(resolveOwnActiveEncounter([appointment()], 'patient-a', 'professional-a')?.id).toBe('a-own');
  });

  it('ignores an active encounter owned by another professional', () => {
    expect(resolveOwnActiveEncounter([appointment({ professionalId: 'professional-b', fisioId: 'professional-b' })], 'patient-a', 'professional-a')).toBeNull();
  });

  it('ignores an active encounter for another patient', () => {
    expect(resolveOwnActiveEncounter([appointment({ pacienteId: 'patient-b' })], 'patient-a', 'professional-a')).toBeNull();
  });

  it('returns null when there is no active encounter', () => {
    expect(resolveOwnActiveEncounter([appointment({ status: 'finalizado' })], 'patient-a', 'professional-a')).toBeNull();
  });

  it('fails closed instead of choosing the first duplicate active encounter', () => {
    expect(resolveOwnActiveEncounter([appointment(), appointment({ id: 'a-duplicate' })], 'patient-a', 'professional-a')).toBeNull();
  });
});

describe('assessment template contextualization', () => {
  const templates = [
    { name: 'Avaliação fisioterapêutica inicial', description: 'Dor, função e movimento' },
    { name: 'Anamnese de saúde mental', description: 'Humor, ansiedade e sono' },
  ];

  it('does not recommend physiotherapy-first templates to psychiatry while keeping them discoverable', () => {
    const result = rankAssessmentTemplatesForContext(templates, { professionalType: 'medico', specialty: 'Psiquiatria' });
    expect(result.recommended.map((item) => item.name)).toEqual(['Anamnese de saúde mental']);
    expect(result.other.map((item) => item.name)).toContain('Avaliação fisioterapêutica inicial');
  });

  it('does not apply psychiatric ranking to a non-psychiatric professional', () => {
    const result = rankAssessmentTemplatesForContext(templates, { professionalType: 'fisioterapeuta', specialty: 'Traumato-ortopedia' });
    expect(result.recommended).toHaveLength(2);
    expect(result.other).toHaveLength(0);
  });
});
