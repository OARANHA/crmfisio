import { describe, expect, it } from 'vitest';
import type { Appointment, Evolution, Patient } from './types';
import {
  buildEncounterEvolutionDraft,
  canFinalizeEncounter,
  hasOwnLinkedEncounterEvolution,
  longitudinalPatientContext,
  resolveClinicalEncounterWorkspace,
  resolveEncounterProgress,
} from './clinicalEncounterUx';

const patient: Patient = {
  id: 'patient-a',
  nome: 'Paciente Piloto Nexus',
  preferredName: 'Piloto',
  nascimento: '1980-01-01',
  telefone: '',
  email: '',
  cpf: '',
  convenio: null,
  queixaPrincipal: 'Queixa longitudinal cadastrada',
  cid10: ['F41.1'],
  funilStage: 'tratamento',
  status: 'ativo',
  ultimaVisita: null,
  createdAt: '2026-01-01T00:00:00Z',
  optInWhats: false,
  anamnese: { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
};

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'session-a',
  pacienteId: patient.id,
  professionalId: 'professional-a',
  fisioId: 'professional-a',
  roomId: 'room-a',
  data: '2026-09-08',
  inicio: '20:00',
  fim: '20:40',
  status: 'em_atendimento',
  tipo: 'Consulta médica',
  valor: 25000,
  pacoteId: null,
  serieId: null,
  notas: '',
  ...overrides,
});

const evolution = (overrides: Partial<Evolution> = {}): Evolution => ({
  id: 'evolution-a',
  pacienteId: patient.id,
  professionalId: 'professional-a',
  fisioId: 'professional-a',
  sessionId: 'session-a',
  data: '2026-09-08',
  texto: 'Paciente reavaliado e orientado.',
  anexos: [],
  ...overrides,
});

describe('Clinical Encounter UX V4 presentation model', () => {
  it('activates Encounter Mode only for the canonical own active encounter', () => {
    const own = resolveClinicalEncounterWorkspace([appointment()], patient.id, 'professional-a', null);
    expect(own.mode).toBe('encounter');
    expect(own.encounter?.id).toBe('session-a');

    const otherProfessional = resolveClinicalEncounterWorkspace([appointment()], patient.id, 'professional-b', null);
    expect(otherProfessional.mode).toBe('longitudinal');
    expect(otherProfessional.encounter).toBeNull();
  });

  it('uses ?session provenance: exact active session is editable and another session stays historical', () => {
    expect(resolveClinicalEncounterWorkspace([appointment()], patient.id, 'professional-a', 'session-a').mode).toBe('encounter');

    const historical = resolveClinicalEncounterWorkspace([appointment()], patient.id, 'professional-a', 'older-session');
    expect(historical.mode).toBe('longitudinal');
    expect(historical.focusedSessionId).toBe('older-session');
  });

  it('keeps a previous-day encounter active because resolution is independent of today', () => {
    const previousDay = appointment({ data: '2026-09-07', inicio: '20:00' });
    const resolved = resolveClinicalEncounterWorkspace([previousDay], patient.id, 'professional-a', previousDay.id);
    expect(resolved.mode).toBe('encounter');
    expect(resolved.encounter?.data).toBe('2026-09-07');
  });

  it('binds a new evolution exactly to the active session and current author', () => {
    const draft = buildEncounterEvolutionDraft({ patient, encounter: appointment(), professionalId: 'professional-a', text: '  Evolução desta consulta.  ' });
    expect(draft.sessionId).toBe('session-a');
    expect(draft.pacienteId).toBe(patient.id);
    expect(draft.professionalId).toBe('professional-a');
    expect(draft.fisioId).toBe('professional-a');
    expect(draft.texto).toBe('Evolução desta consulta.');

    expect(() => buildEncounterEvolutionDraft({ patient, encounter: appointment(), professionalId: 'professional-b', text: 'inválido' })).toThrow('active_encounter_context_required');
  });

  it('blocks finalization without an own linked evolution and releases it after linkage', () => {
    const encounter = appointment();
    expect(hasOwnLinkedEncounterEvolution([], encounter.id, 'professional-a')).toBe(false);
    expect(canFinalizeEncounter({ encounter, professionalId: 'professional-a', canAttend: true, canWriteEvolution: true, hasLinkedEvolution: false })).toBe(false);

    expect(hasOwnLinkedEncounterEvolution([evolution()], encounter.id, 'professional-a')).toBe(true);
    expect(canFinalizeEncounter({ encounter, professionalId: 'professional-a', canAttend: true, canWriteEvolution: true, hasLinkedEvolution: true })).toBe(true);
  });

  it('keeps progress informative rather than a rigid wizard', () => {
    const before = resolveEncounterProgress({ canApplyAssessment: true, canWriteEvolution: true, hasLinkedEvolution: false, canFinalize: false });
    expect(before.find((item) => item.key === 'assessment')?.state).toBe('optional');
    expect(before.find((item) => item.key === 'evolution')?.state).toBe('pending');
    expect(before.find((item) => item.key === 'closing')?.state).toBe('blocked');

    const after = resolveEncounterProgress({ canApplyAssessment: true, canWriteEvolution: true, hasLinkedEvolution: true, canFinalize: true });
    expect(after.find((item) => item.key === 'evolution')?.state).toBe('complete');
    expect(after.find((item) => item.key === 'closing')?.state).toBe('complete');
  });

  it('never relabels the patient-level complaint as the complaint of this encounter', () => {
    const context = longitudinalPatientContext(patient);
    expect(context.eyebrow).toBe('Contexto longitudinal');
    expect(context.complaintLabel).toBe('Queixa principal registrada no cadastro');
    expect(context.complaint).toBe(patient.queixaPrincipal);
    expect(context.complaintLabel.toLowerCase()).not.toContain('desta consulta');
  });
});
