import { resolveOwnActiveEncounter } from './activeClinicalEncounter';
import { professionalIdOf } from './professionalReference';
import type { Appointment, Evolution, Patient } from './types';

export type ClinicalEncounterWorkspaceResolution = {
  mode: 'encounter' | 'longitudinal';
  encounter: Appointment | null;
  focusedSessionId: string | null;
};

export type EncounterProgressState = 'available' | 'optional' | 'pending' | 'complete' | 'blocked' | 'checking';

export type EncounterProgressItem = {
  key: 'context' | 'assessment' | 'tools' | 'evolution' | 'closing';
  label: string;
  state: EncounterProgressState;
  detail: string;
};

export type ClinicalRequirementStatus = 'loading' | 'allowed' | 'denied' | 'error';

export type EncounterClosingStateKey =
  | 'checking'
  | 'verification_error'
  | 'missing_evolution'
  | 'missing_evolution_permission'
  | 'missing_attend_permission'
  | 'missing_evolution_write_permission'
  | 'ready';

export type EncounterClosingPresentation = {
  key: EncounterClosingStateKey;
  progressState: Extract<EncounterProgressState, 'checking' | 'pending' | 'blocked' | 'complete'>;
  progressDetail: string;
  sectionTitle: string;
  sectionDetail: string;
  noticeTitle: string;
  noticeDetail: string;
  tone: 'checking' | 'pending' | 'blocked' | 'ready';
  action: 'register_evolution' | null;
};

export type EncounterWorkspaceNavigationItem = {
  id:
    | 'encounter-context'
    | 'encounter-evolution'
    | 'encounter-assessment'
    | 'encounter-tools'
    | 'encounter-continuity'
    | 'encounter-closing';
  label: string;
};

// Navigation contains only real surfaces in the canonical encounter workspace.
// Capability-gated tools never become fake actions merely for visual parity.
export const encounterWorkspaceNavigation: readonly EncounterWorkspaceNavigationItem[] = [
  { id: 'encounter-context', label: 'Contexto' },
  { id: 'encounter-evolution', label: 'Evolução' },
  { id: 'encounter-assessment', label: 'Avaliação clínica' },
  { id: 'encounter-tools', label: 'Ferramentas clínicas' },
  { id: 'encounter-continuity', label: 'Conduta' },
  { id: 'encounter-closing', label: 'Encerramento' },
];

export function buildEncounterScopedNexusPath(
  patientId: string,
  appointmentId: string,
  routeSuffix: string,
): string {
  const suffix = routeSuffix.startsWith('/') ? routeSuffix : `/${routeSuffix}`;
  return `/pacientes/${encodeURIComponent(patientId)}/nexus${suffix}?session=${encodeURIComponent(appointmentId)}`;
}

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

export function resolveEncounterClosingState({
  hasLinkedEvolution,
  attendStatus,
  evolutionWriteStatus,
  canFinalize,
}: {
  hasLinkedEvolution: boolean;
  attendStatus: ClinicalRequirementStatus;
  evolutionWriteStatus: ClinicalRequirementStatus;
  canFinalize: boolean;
}): EncounterClosingPresentation {
  if (attendStatus === 'loading' || evolutionWriteStatus === 'loading') {
    return {
      key: 'checking',
      progressState: 'checking',
      progressDetail: 'Validando requisitos clínicos',
      sectionTitle: 'Validando requisitos clínicos',
      sectionDetail: 'Estamos verificando seu acesso antes de liberar o encerramento.',
      noticeTitle: 'Validando requisitos clínicos',
      noticeDetail: 'Aguarde a verificação necessária para encerrar este atendimento.',
      tone: 'checking',
      action: null,
    };
  }

  if (attendStatus === 'error' || evolutionWriteStatus === 'error') {
    return {
      key: 'verification_error',
      progressState: 'blocked',
      progressDetail: 'Não foi possível verificar o acesso',
      sectionTitle: 'Verificação de acesso necessária',
      sectionDetail: 'Não foi possível confirmar seu acesso para concluir este atendimento.',
      noticeTitle: 'Não foi possível verificar o acesso',
      noticeDetail: 'Tente novamente antes de encerrar o atendimento.',
      tone: 'blocked',
      action: null,
    };
  }

  if (!hasLinkedEvolution) {
    if (evolutionWriteStatus !== 'allowed') {
      return {
        key: 'missing_evolution_permission',
        progressState: 'blocked',
        progressDetail: 'Evolução necessária · acesso insuficiente',
        sectionTitle: 'Evolução necessária, sem permissão para registrar',
        sectionDetail: 'A evolução desta consulta é obrigatória, mas seu acesso atual não permite registrá-la.',
        noticeTitle: 'Evolução necessária, mas indisponível para seu acesso',
        noticeDetail: 'O atendimento só pode ser encerrado após o registro da evolução desta consulta.',
        tone: 'blocked',
        action: null,
      };
    }

    return {
      key: 'missing_evolution',
      progressState: 'pending',
      progressDetail: 'Evolução pendente',
      sectionTitle: 'Evolução pendente',
      sectionDetail: 'Registre a evolução desta consulta para liberar o encerramento.',
      noticeTitle: 'Evolução ainda não registrada',
      noticeDetail: 'O atendimento só pode ser encerrado após o registro da evolução desta consulta.',
      tone: 'pending',
      action: 'register_evolution',
    };
  }

  if (attendStatus !== 'allowed') {
    return {
      key: 'missing_attend_permission',
      progressState: 'blocked',
      progressDetail: 'Evolução registrada · encerramento sem acesso',
      sectionTitle: 'Evolução registrada; encerramento indisponível',
      sectionDetail: 'Seu acesso clínico atual não permite finalizar este atendimento.',
      noticeTitle: 'Evolução registrada, mas o encerramento está indisponível',
      noticeDetail: 'A evolução está registrada, mas seu acesso atual não permite concluir este atendimento.',
      tone: 'blocked',
      action: null,
    };
  }

  if (evolutionWriteStatus !== 'allowed') {
    return {
      key: 'missing_evolution_write_permission',
      progressState: 'blocked',
      progressDetail: 'Evolução registrada · acesso incompleto',
      sectionTitle: 'Evolução registrada; encerramento indisponível',
      sectionDetail: 'A evolução existe, mas seu acesso atual não permite concluir este atendimento.',
      noticeTitle: 'Evolução registrada, mas o encerramento está indisponível',
      noticeDetail: 'A evolução está registrada, mas seu acesso atual não permite concluir este atendimento.',
      tone: 'blocked',
      action: null,
    };
  }

  if (canFinalize) {
    return {
      key: 'ready',
      progressState: 'complete',
      progressDetail: 'Pronto para finalizar',
      sectionTitle: 'Pronto para finalizar',
      sectionDetail: 'A evolução obrigatória foi registrada e o atendimento pode ser encerrado.',
      noticeTitle: 'Evolução registrada · encerramento liberado',
      noticeDetail: 'Finalize quando o registro desta consulta estiver completo.',
      tone: 'ready',
      action: null,
    };
  }

  // The capability checks and evolution are satisfied, but the canonical guard
  // still refused finalization. Do not invent a more specific diagnosis.
  return {
    key: 'verification_error',
    progressState: 'blocked',
    progressDetail: 'Revalidar requisitos clínicos',
    sectionTitle: 'Revalidação clínica necessária',
    sectionDetail: 'O estado atual do atendimento precisa ser atualizado antes do encerramento.',
    noticeTitle: 'Encerramento ainda não confirmado',
    noticeDetail: 'Atualize a página ou tente novamente em instantes.',
    tone: 'blocked',
    action: null,
  };
}

export function resolveEncounterProgress({
  canApplyAssessment,
  evolutionWriteStatus,
  hasLinkedEvolution,
  closing,
}: {
  canApplyAssessment: boolean;
  evolutionWriteStatus: ClinicalRequirementStatus;
  hasLinkedEvolution: boolean;
  closing: EncounterClosingPresentation;
}): EncounterProgressItem[] {
  const evolutionState: EncounterProgressItem = hasLinkedEvolution
    ? { key: 'evolution', label: 'Evolução', state: 'complete', detail: 'Registrada ✓' }
    : evolutionWriteStatus === 'loading'
      ? { key: 'evolution', label: 'Evolução', state: 'checking', detail: 'Validando acesso para registrar' }
      : evolutionWriteStatus === 'error'
        ? { key: 'evolution', label: 'Evolução', state: 'blocked', detail: 'Não foi possível verificar o acesso' }
        : evolutionWriteStatus === 'allowed'
          ? { key: 'evolution', label: 'Evolução', state: 'pending', detail: 'Pendente' }
          : { key: 'evolution', label: 'Evolução', state: 'blocked', detail: 'Sem permissão para registrar' };

  return [
    { key: 'context', label: 'Contexto', state: 'available', detail: 'Dados longitudinais disponíveis' },
    {
      key: 'assessment',
      label: 'Avaliação',
      state: canApplyAssessment ? 'optional' : 'available',
      detail: canApplyAssessment ? 'Opcional · disponível' : 'Consulta disponível conforme acesso',
    },
    { key: 'tools', label: 'Instrumentos', state: 'optional', detail: 'Ferramentas permitidas quando úteis' },
    evolutionState,
    {
      key: 'closing',
      label: 'Encerramento',
      state: closing.progressState,
      detail: closing.progressDetail,
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
