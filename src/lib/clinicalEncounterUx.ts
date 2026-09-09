import { resolveOwnActiveEncounter } from './activeClinicalEncounter';
import { professionalIdOf } from './professionalReference';
import type { Appointment, Evolution, Patient } from './types';

export type ClinicalEncounterWorkspaceResolution = {
  mode: 'encounter' | 'longitudinal';
  encounter: Appointment | null;
  focusedSessionId: string | null;
};

export type EncounterProgressState = 'available' | 'optional' | 'pending' | 'complete' | 'blocked';

export type EncounterProgressItem = {
  key: 'context' | 'assessment' | 'tools' | 'evolution' | 'closing';
  label: string;
  state: EncounterProgressState;
  detail: string;
};

export function resolveClinicalEncounterWorkspace(
  appointments: readonly Appointment[],
  patientId: string | null | undefined,
  professionalId: string | null | undefined,
  requestedSessionId: string | null | undefined,
): ClinicalEncounterWorkspaceResolution {
  const encounter = resolveOwnActiveEncounter(appointments, patientId, professionalId);
  const requested = requestedSessionId || null;

  if (!encounter) {
    return { mode: 'longitudinal', encounter: null, focusedSessionId: requested };
  }

  // A deep-link to another session is a request to inspect history. Never turn
  // that historical session into an editable encounter merely because another
  // own encounter is currently active.
  if (requested && requested !== encounter.id) {
    return { mode: 'longitudinal', encounter, focusedSessionId: requested };
  }

  return { mode: 'encounter', encounter, focusedSessionId: encounter.id };
}

export function hasOwnLinkedEncounterEvolution(
  evolutions: readonly Evolution[],
  encounterId: string,
  professionalId: string | null | undefined,
): boolean {
  if (!professionalId) return false;
  return evolutions.some((evolution) =>
    evolution.sessionId === encounterId
    && professionalIdOf(evolution) === professionalId,
  );
}

export function buildEncounterEvolutionDraft({
  patient,
  encounter,
  professionalId,
  text,
}: {
  patient: Patient;
  encounter: Appointment;
  professionalId: string;
  text: string;
}): Omit<Evolution, 'id'> {
  if (encounter.pacienteId !== patient.id || professionalIdOf(encounter) !== professionalId || encounter.status !== 'em_atendimento') {
    throw new Error('active_encounter_context_required');
  }
  const normalized = text.trim();
  if (!normalized) throw new Error('clinical_evolution_text_required');

  return {
    pacienteId: patient.id,
    professionalId,
    fisioId: professionalId,
    sessionId: encounter.id,
    data: encounter.data,
    texto: normalized,
    anexos: [],
  };
}

export function canFinalizeEncounter({
  encounter,
  professionalId,
  canAttend,
  canWriteEvolution,
  hasLinkedEvolution,
}: {
  encounter: Appointment | null;
  professionalId: string | null | undefined;
  canAttend: boolean;
  canWriteEvolution: boolean;
  hasLinkedEvolution: boolean;
}): boolean {
  return Boolean(
    encounter
    && encounter.status === 'em_atendimento'
    && professionalId
    && professionalIdOf(encounter) === professionalId
    && canAttend
    && canWriteEvolution
    && hasLinkedEvolution,
  );
}

export function resolveEncounterProgress({
  canApplyAssessment,
  canWriteEvolution,
  hasLinkedEvolution,
  canFinalize,
}: {
  canApplyAssessment: boolean;
  canWriteEvolution: boolean;
  hasLinkedEvolution: boolean;
  canFinalize: boolean;
}): EncounterProgressItem[] {
  return [
    { key: 'context', label: 'Contexto', state: 'available', detail: 'Dados longitudinais disponíveis' },
    {
      key: 'assessment',
      label: 'Avaliação',
      state: canApplyAssessment ? 'optional' : 'available',
      detail: canApplyAssessment ? 'Opcional · disponível' : 'Consulta disponível conforme acesso',
    },
    { key: 'tools', label: 'Instrumentos', state: 'optional', detail: 'Ferramentas permitidas quando úteis' },
    {
      key: 'evolution',
      label: 'Evolução',
      state: hasLinkedEvolution ? 'complete' : canWriteEvolution ? 'pending' : 'blocked',
      detail: hasLinkedEvolution ? 'Registrada ✓' : canWriteEvolution ? 'Pendente' : 'Sem permissão para registrar',
    },
    {
      key: 'closing',
      label: 'Encerramento',
      state: canFinalize ? 'complete' : 'blocked',
      detail: canFinalize ? 'Pronto para finalizar' : 'Bloqueado pela evolução',
    },
  ];
}

export function longitudinalPatientContext(patient: Patient) {
  return {
    eyebrow: 'Contexto longitudinal',
    complaintLabel: 'Queixa principal registrada no cadastro',
    complaint: patient.queixaPrincipal || 'Sem queixa principal registrada no cadastro',
    cidLabel: 'CID-10 registrado no prontuário',
    cid: patient.cid10.join(' · ') || 'Sem CID-10 registrado',
  };
}
