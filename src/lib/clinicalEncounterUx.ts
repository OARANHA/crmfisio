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
  id: 'encounter-context' | 'encounter-assessment' | 'encounter-evolution' | 'encounter-history' | 'encounter-closing';
  label: string;
};

// Navigation contains only surfaces that are always real in the canonical
// encounter workspace. Capability-gated tools intentionally do not become a
// top-level navigation promise: if no real tool is available, no dead action
// is rendered merely for legacy parity.
export const encounterWorkspaceNavigation: readonly EncounterWorkspaceNavigationItem[] = [
  { id: 'encounter-context', label: 'Contexto' },
  { id: 'encounter-assessment', label: 'Avaliação' },
  { id: 'encounter-evolution', label: 'Evolução' },
  { id: 'encounter-history', label: 'Histórico' },
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
      noticeDetail: 'Aguarde a verificação das permissões clínicas necessárias para encerrar este atendimento.',
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
      sectionDetail: 'Não foi possível confirmar todos os requisitos clínicos de autorização para o encerramento.',
      noticeTitle: 'Não foi possível verificar os requisitos clínicos',
      noticeDetail: 'O encerramento permanece indisponível até que a verificação de acesso seja concluída. Nenhum diagnóstico sobre ausência de evolução é inferido neste estado.',
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
        sectionDetail: 'A evolução desta sessão é obrigatória, mas seu acesso atual não permite registrá-la.',
        noticeTitle: 'Evolução necessária, mas indisponível para seu acesso',
        noticeDetail: 'Este atendimento não pode ser encerrado até existir uma evolução vinculada à sessão e a autorização clínica necessária estiver válida.',
        tone: 'blocked',
        action: null,
      };
    }

    return {
      key: 'missing_evolution',
      progressState: 'pending',
      progressDetail: 'Evolução pendente',
      sectionTitle: 'Evolução pendente',
      sectionDetail: 'Registre uma evolução vinculada a esta sessão para liberar o encerramento.',
      noticeTitle: 'Evolução ainda não registrada',
      noticeDetail: 'O banco também exige uma evolução desta sessão antes da finalização; a interface antecipa essa regra.',
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
      noticeTitle: 'Evolução registrada, mas falta autorização para finalizar',
      noticeDetail: 'O registro clínico está presente e preservado. A finalização continua bloqueada porque a permissão para conduzir e encerrar o atendimento não está ativa.',
      tone: 'blocked',
      action: null,
    };
  }

  if (evolutionWriteStatus !== 'allowed') {
    return {
      key: 'missing_evolution_write_permission',
      progressState: 'blocked',
      progressDetail: 'Evolução registrada · requisito de autorização pendente',
      sectionTitle: 'Evolução registrada; requisito clínico não satisfeito',
      sectionDetail: 'A evolução existe, mas a autorização clínica exigida para autoria e encerramento não está ativa no seu acesso atual.',
      noticeTitle: 'Evolução registrada, mas a autorização clínica está incompleta',
      noticeDetail: 'O PostgreSQL exige também a permissão clínica de evolução no momento da finalização. A evolução registrada não é tratada como ausente.',
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
      sectionDetail: 'Os requisitos clínicos visíveis foram satisfeitos. A transição continua validada pelo PostgreSQL.',
      noticeTitle: 'Evolução vinculada · encerramento liberado',
      noticeDetail: 'Finalizar mantém as proteções clínicas e a separação do ciclo financeiro.',
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
    sectionDetail: 'O estado atual não pôde ser confirmado como elegível para encerramento.',
    noticeTitle: 'Encerramento ainda não confirmado',
    noticeDetail: 'A interface não liberará a ação enquanto o guard canônico de finalização não confirmar todos os requisitos.',
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
