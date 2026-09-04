import {
  createNexusRedFlag,
  createNexusResultDraft,
  finalizeNexusResult,
  type NexusClinicalResult,
  type NexusRedFlag,
} from '../nexusClinical';
import {
  calculatePhq9,
  PHQ9_EVIDENCE,
  PHQ9_REQUIRED_CAPABILITY,
  PHQ9_RULE_KEY,
  PHQ9_RULE_VERSION,
  type Phq9Answers,
  type Phq9Result,
} from './phq9';

export type PersistPhq9Input = {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  answers: Phq9Answers;
};

export type PersistPhq9Output = {
  result: NexusClinicalResult;
  redFlag: NexusRedFlag | null;
  clinical: Phq9Result;
};

/**
 * Persiste o PHQ-9 mantendo a regra clínica determinística fora da camada de UI.
 * Ordem proposital: draft -> red flag (quando houver) -> finalização.
 * Se a red flag falhar, o resultado permanece em draft e não é finalizado silenciosamente.
 */
export async function persistPhq9Result(input: PersistPhq9Input): Promise<PersistPhq9Output> {
  const clinical = calculatePhq9(input.answers);

  const draft = await createNexusResultDraft({
    patientId: input.patientId,
    professionalId: input.professionalId,
    appointmentId: input.appointmentId ?? null,
    moduleKey: 'mental-health',
    toolKey: 'phq-9',
    ruleKey: PHQ9_RULE_KEY,
    ruleVersion: PHQ9_RULE_VERSION,
    requiredCapability: PHQ9_REQUIRED_CAPABILITY,
    inputSnapshot: {
      answers: input.answers,
      answerOrder: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'],
    },
    outputSnapshot: {
      recommendations: clinical.recommendations,
      answersArray: clinical.answersArray,
      hasSuicideRiskFlag: clinical.hasSuicideRiskFlag,
    },
    totalScore: clinical.totalScore,
    maxScore: clinical.maxScore,
    classification: clinical.classification,
    severity: clinical.severity,
    interpretation: clinical.interpretation,
    soapText: clinical.soapText,
    evidenceSnapshot: PHQ9_EVIDENCE,
  });

  let redFlag: NexusRedFlag | null = null;
  if (clinical.hasSuicideRiskFlag) {
    redFlag = await createNexusRedFlag({
      patientId: input.patientId,
      resultId: draft.id,
      flagCode: 'phq9.item9.positive',
      severity: 'critical',
      title: 'PHQ-9 — Item 9 positivo',
      message: 'Resposta positiva para pensamento de morte/autolesão no item 9 do PHQ-9.',
      requiredAction: 'Aplicar protocolo C-SSRS, investigar plano/meios e pactuar Plano de Segurança conforme protocolo Nexus.',
    });
  }

  const result = await finalizeNexusResult(draft.id);
  return { result, redFlag, clinical };
}
