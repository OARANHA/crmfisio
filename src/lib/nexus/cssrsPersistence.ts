import {
  createNexusResultDraft,
  finalizeNexusResult,
  type NexusClinicalResult,
} from '../nexusClinical';
import {
  calculateCssrs,
  CSSRS_EVIDENCE,
  CSSRS_REQUIRED_CAPABILITY,
  CSSRS_RULE_KEY,
  CSSRS_RULE_VERSION,
  type CssrsAnswers,
  type CssrsResult,
} from './cssrs';

export type PersistCssrsInput = {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  answers: CssrsAnswers;
};

export type PersistCssrsOutput = {
  result: NexusClinicalResult;
  clinical: CssrsResult;
};

/**
 * Persiste a C-SSRS exatamente como resultado clínico versionado do Nexus.
 * A classificação de risco permanece determinada pela regra clínica original.
 * Este fluxo não reconhece nem encerra automaticamente red flags de outros instrumentos.
 */
export async function persistCssrsResult(input: PersistCssrsInput): Promise<PersistCssrsOutput> {
  const clinical = calculateCssrs(input.answers);

  const draft = await createNexusResultDraft({
    patientId: input.patientId,
    professionalId: input.professionalId,
    appointmentId: input.appointmentId ?? null,
    moduleKey: 'mental-health',
    toolKey: 'cssrs',
    ruleKey: CSSRS_RULE_KEY,
    ruleVersion: CSSRS_RULE_VERSION,
    requiredCapability: CSSRS_REQUIRED_CAPABILITY,
    inputSnapshot: {
      answers: input.answers,
      answerOrder: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
    },
    outputSnapshot: {
      recommendations: clinical.recommendations,
      answersArray: clinical.answersArray,
      riskLevel: clinical.totalScore,
    },
    totalScore: clinical.totalScore,
    maxScore: clinical.maxScore,
    classification: clinical.classification,
    severity: clinical.severity,
    interpretation: clinical.interpretation,
    soapText: clinical.soapText,
    evidenceSnapshot: CSSRS_EVIDENCE,
  });

  const result = await finalizeNexusResult(draft.id);
  return { result, clinical };
}
