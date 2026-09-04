import { createNexusResultDraft, finalizeNexusResult, type NexusClinicalResult } from '../nexusClinical';
import { calculateGad7, GAD7_EVIDENCE, GAD7_REQUIRED_CAPABILITY, GAD7_RULE_KEY, GAD7_RULE_VERSION, type Gad7Answers, type Gad7Result } from './gad7';

export type PersistGad7Input = {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  answers: Gad7Answers;
};

export type PersistGad7Output = { result: NexusClinicalResult; clinical: Gad7Result };

export async function persistGad7Result(input: PersistGad7Input): Promise<PersistGad7Output> {
  const clinical = calculateGad7(input.answers);
  const draft = await createNexusResultDraft({
    patientId: input.patientId,
    professionalId: input.professionalId,
    appointmentId: input.appointmentId ?? null,
    moduleKey: 'mental-health',
    toolKey: 'gad-7',
    ruleKey: GAD7_RULE_KEY,
    ruleVersion: GAD7_RULE_VERSION,
    requiredCapability: GAD7_REQUIRED_CAPABILITY,
    inputSnapshot: { answers: input.answers, answerOrder: ['q1','q2','q3','q4','q5','q6','q7'] },
    outputSnapshot: { recommendations: clinical.recommendations, answersArray: clinical.answersArray },
    totalScore: clinical.totalScore,
    maxScore: clinical.maxScore,
    classification: clinical.classification,
    severity: clinical.severity,
    interpretation: clinical.interpretation,
    soapText: clinical.soapText,
    evidenceSnapshot: GAD7_EVIDENCE,
  });
  return { result: await finalizeNexusResult(draft.id), clinical };
}
