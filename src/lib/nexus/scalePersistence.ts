import { createNexusResultDraft, finalizeNexusResult, type NexusClinicalResult } from '../nexusClinical';
import { calculateScale, type NexusScaleDefinition } from './scaleRuntime';

export type PersistScaleInput = {
  definition: NexusScaleDefinition;
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  answers: Record<string, number>;
};

export type PersistScaleOutput = {
  result: NexusClinicalResult;
  clinical: ReturnType<typeof calculateScale>;
};

export async function persistScaleResult(input: PersistScaleInput): Promise<PersistScaleOutput> {
  const clinical = calculateScale(input.definition, input.answers);
  const draft = await createNexusResultDraft({
    patientId: input.patientId,
    professionalId: input.professionalId,
    appointmentId: input.appointmentId ?? null,
    moduleKey: input.definition.moduleKey,
    toolKey: input.definition.toolKey,
    ruleKey: input.definition.ruleKey,
    ruleVersion: input.definition.ruleVersion,
    requiredCapability: input.definition.requiredCapability,
    inputSnapshot: {
      answers: input.answers,
      answerOrder: input.definition.questions.map((question) => question.id),
    },
    outputSnapshot: {
      recommendations: clinical.recommendations,
      answersArray: clinical.answersArray,
      ...clinical.structuredData,
    },
    totalScore: clinical.totalScore,
    maxScore: clinical.maxScore,
    classification: clinical.classification,
    severity: clinical.severity,
    interpretation: clinical.interpretation,
    soapText: clinical.soapText,
    evidenceSnapshot: [...input.definition.evidence],
  });

  const result = await finalizeNexusResult(draft.id);
  return { result, clinical };
}
