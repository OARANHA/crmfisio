import { describe, expect, it } from 'vitest';
import type { Appointment, Evolution, Patient } from './types';
import {
  buildEncounterEvolutionDraft,
  buildEncounterScopedNexusPath,
  canFinalizeEncounter,
  encounterWorkspaceNavigation,
  hasOwnLinkedEncounterEvolution,
  longitudinalPatientContext,
  resolveClinicalEncounterWorkspace,
  resolveEncounterClosingState,
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

  it('keeps canFinalizeEncounter as the canonical UI guard', () => {
    const encounter = appointment();
    expect(hasOwnLinkedEncounterEvolution([], encounter.id, 'professional-a')).toBe(false);
    expect(canFinalizeEncounter({ encounter, professionalId: 'professional-a', canAttend: true, canWriteEvolution: true, hasLinkedEvolution: false })).toBe(false);

    expect(hasOwnLinkedEncounterEvolution([evolution()], encounter.id, 'professional-a')).toBe(true);
    expect(canFinalizeEncounter({ encounter, professionalId: 'professional-a', canAttend: true, canWriteEvolution: true, hasLinkedEvolution: true })).toBe(true);
  });

  it('reports missing_evolution when evolution is absent and permissions are allowed', () => {
    const closing = resolveEncounterClosingState({
      hasLinkedEvolution: false,
      attendStatus: 'allowed',
      evolutionWriteStatus: 'allowed',
      canFinalize: false,
    });
    expect(closing.key).toBe('missing_evolution');
    expect(closing.progressDetail).toBe('Evolução pendente');
    expect(closing.action).toBe('register_evolution');
  });

  it('reports ready when evolution exists and both clinical permissions are allowed', () => {
    const closing = resolveEncounterClosingState({
      hasLinkedEvolution: true,
      attendStatus: 'allowed',
      evolutionWriteStatus: 'allowed',
      canFinalize: true,
    });
    expect(closing.key).toBe('ready');
    expect(closing.progressDetail).toBe('Pronto para finalizar');
  });

  it('does not accuse a missing evolution when clinical.attend is denied after evolution exists', () => {
    const closing = resolveEncounterClosingState({
      hasLinkedEvolution: true,
      attendStatus: 'denied',
      evolutionWriteStatus: 'allowed',
      canFinalize: false,
    });
    expect(closing.key).toBe('missing_attend_permission');
    expect(closing.progressDetail).toContain('Evolução registrada');
    expect(closing.noticeTitle).not.toContain('não registrada');
  });

  it('does not accuse a missing evolution when clinical.evolution.write is denied after evolution exists', () => {
    const closing = resolveEncounterClosingState({
      hasLinkedEvolution: true,
      attendStatus: 'allowed',
      evolutionWriteStatus: 'denied',
      canFinalize: false,
    });
    expect(closing.key).toBe('missing_evolution_write_permission');
    expect(closing.progressDetail).toContain('Evolução registrada');
    expect(closing.noticeDetail).toContain('A evolução está registrada');
  });

  it('keeps capability loading and errors as access verification states instead of false evolution diagnoses', () => {
    const loading = resolveEncounterClosingState({
      hasLinkedEvolution: true,
      attendStatus: 'loading',
      evolutionWriteStatus: 'allowed',
      canFinalize: false,
    });
    expect(loading.key).toBe('checking');
    expect(loading.progressDetail).toBe('Validando requisitos clínicos');

    const error = resolveEncounterClosingState({
      hasLinkedEvolution: true,
      attendStatus: 'allowed',
      evolutionWriteStatus: 'error',
      canFinalize: false,
    });
    expect(error.key).toBe('verification_error');
    expect(error.progressDetail).toContain('verificar o acesso');
    expect(error.noticeTitle).not.toContain('não registrada');
  });

  it('uses the same derived closing presentation in the progress card model', () => {
    const closing = resolveEncounterClosingState({
      hasLinkedEvolution: true,
      attendStatus: 'denied',
      evolutionWriteStatus: 'allowed',
      canFinalize: false,
    });
    const progress = resolveEncounterProgress({
      canApplyAssessment: true,
      evolutionWriteStatus: 'allowed',
      hasLinkedEvolution: true,
      closing,
    });
    const closingProgress = progress.find((item) => item.key === 'closing');
    expect(closingProgress?.state).toBe(closing.progressState);
    expect(closingProgress?.detail).toBe(closing.progressDetail);
  });

  it('keeps progress informative rather than a rigid wizard', () => {
    const closing = resolveEncounterClosingState({
      hasLinkedEvolution: false,
      attendStatus: 'allowed',
      evolutionWriteStatus: 'allowed',
      canFinalize: false,
    });
    const before = resolveEncounterProgress({
      canApplyAssessment: true,
      evolutionWriteStatus: 'allowed',
      hasLinkedEvolution: false,
      closing,
    });
    expect(before.find((item) => item.key === 'assessment')?.state).toBe('optional');
    expect(before.find((item) => item.key === 'evolution')?.state).toBe('pending');
    expect(before.find((item) => item.key === 'closing')?.state).toBe('pending');
  });

  it('never relabels the patient-level complaint as the complaint of this encounter', () => {
    const context = longitudinalPatientContext(patient);
    expect(context.eyebrow).toBe('Contexto longitudinal');
    expect(context.complaintLabel).toBe('Queixa principal registrada no cadastro');
    expect(context.complaint).toBe(patient.queixaPrincipal);
    expect(context.complaintLabel.toLowerCase()).not.toContain('desta consulta');
  });

  it('keeps workbench navigation free-form, evolution-first and limited to real surfaces', () => {
    expect(encounterWorkspaceNavigation.map((item) => item.id)).toEqual([
      'encounter-context',
      'encounter-evolution',
      'encounter-assessment',
      'encounter-tools',
      'encounter-continuity',
      'encounter-closing',
    ]);
    const labels = encounterWorkspaceNavigation.map((item) => item.label.toLowerCase()).join(' ');
    expect(labels).not.toContain('prescrição');
    expect(labels).not.toContain('exame');
    expect(labels).not.toContain('atestado');
    expect(encounterWorkspaceNavigation.findIndex((item) => item.id === 'encounter-evolution'))
      .toBeLessThan(encounterWorkspaceNavigation.findIndex((item) => item.id === 'encounter-assessment'));
  });

  it('preserves the exact appointment when opening an available Nexus tool from the encounter', () => {
    const path = buildEncounterScopedNexusPath(patient.id, 'session-a', '/eem');
    expect(path).toBe('/pacientes/patient-a/nexus/eem?session=session-a');
    expect(path).toContain(`session=${appointment().id}`);
  });
});
