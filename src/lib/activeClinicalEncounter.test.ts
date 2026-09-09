import { describe, expect, it } from 'vitest';
import {
  rankAssessmentTemplatesForContext,
  resolveOwnActiveEncounter,
  selectAssessmentDraftForContext,
} from './activeClinicalEncounter';
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

type DraftStub = {
  id: string;
  patientId: string;
  professionalId: string;
  status: 'draft' | 'finalized';
  appointmentId: string | null;
};

const draft = (overrides: Partial<DraftStub> = {}): DraftStub => ({
  id: 'draft-a',
  patientId: 'patient-a',
  professionalId: 'professional-a',
  status: 'draft',
  appointmentId: 'appointment-current',
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

describe('assessment draft encounter context', () => {
  it('does not keep patient A draft when context changes to patient B without a draft', () => {
    expect(selectAssessmentDraftForContext([draft()], {
      patientId: 'patient-b',
      professionalId: 'professional-a',
      activeAppointmentId: 'appointment-b',
    })).toBeNull();
  });

  it('does not keep user A draft when context changes to user B', () => {
    expect(selectAssessmentDraftForContext([draft()], {
      patientId: 'patient-a',
      professionalId: 'professional-b',
      activeAppointmentId: 'appointment-current',
    })).toBeNull();
  });

  it('does not resume an old appointment draft inside a new active encounter', () => {
    expect(selectAssessmentDraftForContext([
      draft({ id: 'old', appointmentId: 'appointment-old' }),
    ], {
      patientId: 'patient-a',
      professionalId: 'professional-a',
      activeAppointmentId: 'appointment-current',
    })).toBeNull();
  });

  it('resumes only the draft whose appointment matches the active encounter', () => {
    const current = draft({ id: 'current', appointmentId: 'appointment-current' });
    const selected = selectAssessmentDraftForContext([
      draft({ id: 'old', appointmentId: 'appointment-old' }),
      current,
    ], {
      patientId: 'patient-a',
      professionalId: 'professional-a',
      activeAppointmentId: 'appointment-current',
    });
    expect(selected?.id).toBe('current');
  });

  it('preserves the previous longitudinal resume behavior without an active encounter', () => {
    const previous = draft({ id: 'longitudinal', appointmentId: 'appointment-old' });
    expect(selectAssessmentDraftForContext([previous], {
      patientId: 'patient-a',
      professionalId: 'professional-a',
      activeAppointmentId: null,
    })?.id).toBe('longitudinal');
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
