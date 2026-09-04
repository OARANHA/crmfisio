import { createNexusRedFlag, createNexusResultDraft, finalizeNexusResult, type NexusClinicalResult } from '../nexusClinical';
import { calculateScale, type NexusScaleDefinition } from './scaleRuntime';

export type NexusRawScaleSelection = {
  optionIndex: number;
  label: string;
  value: number;
};

export type PersistScaleInput = {
  definition: NexusScaleDefinition;
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  answers: Record<string, number>;
  rawSelections?: Record<string, NexusRawScaleSelection>;
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
      selectedOptions: input.rawSelections ?? {},
      answerOrder: input.definition.questions.map((question) => question.id),
    },
    outputSnapshot: {
      recommendations: clinical.recommendations,
      answersArray: clinical.answersArray,
      redFlags: clinical.redFlags ?? [],
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

  // A policy de red flags exige o resultado ainda em draft. Isso garante que
  // nenhum resultado crítico seja finalizado sem seu evento de segurança.
  for (const flag of clinical.redFlags ?? []) {
    await createNexusRedFlag({
      patientId: input.patientId,
      resultId: draft.id,
      flagCode: flag.flagCode,
      severity: flag.severity,
      title: flag.title,
      message: flag.message,
      requiredAction: flag.requiredAction ?? null,
    });
  }

  const result = await finalizeNexusResult(draft.id);
  return { result, clinical };
}
