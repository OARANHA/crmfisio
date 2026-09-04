import { createNexusResultDraft, finalizeNexusResult, type NexusClinicalResult } from '../nexusClinical';
import { calculateMeem, NEXUS_MEEM_RULE_VERSION, type MeemAnswerMap, type MeemEducationBand } from './meem';

export async function persistMeemResult(input: {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  answers: MeemAnswerMap;
  educationBand: MeemEducationBand;
}): Promise<NexusClinicalResult> {
  const clinical = calculateMeem(input.answers, input.educationBand);
  const draft = await createNexusResultDraft({
    patientId: input.patientId,
    professionalId: input.professionalId,
    appointmentId: input.appointmentId ?? null,
    moduleKey: 'cognition',
    toolKey: 'meem',
    ruleKey: 'nexus.meem.brucki',
    ruleVersion: NEXUS_MEEM_RULE_VERSION,
    requiredCapability: 'nexus.cognition',
    inputSnapshot: { answers: input.answers, educationBand: input.educationBand },
    outputSnapshot: {
      domainScores: clinical.domainScores,
      contextualCutoff: clinical.contextualCutoff,
      contextualStatus: clinical.contextualStatus,
      allEducationBands: clinical.allEducationBands,
      recommendations: clinical.recommendations,
      soapTarget: 'objective',
      clinicalReviewRequired: 'meem-generic-classification-vs-education-cutoffs',
    },
    totalScore: clinical.totalScore,
    maxScore: clinical.maxScore,
    classification: clinical.classification,
    severity: clinical.severity,
    interpretation: clinical.interpretation,
    soapText: clinical.soapText,
    evidenceSnapshot: [
      { evidenceKey: 'meem-folstein-1975', title: 'Mini-Mental State Examination', source: 'Folstein MF, Folstein SE, McHugh PR. J Psychiatr Res. 1975.', version: NEXUS_MEEM_RULE_VERSION },
      { evidenceKey: 'meem-brucki-2003', title: 'Sugestões para o uso do mini-exame do estado mental no Brasil', source: 'Brucki SMD et al. Arq Neuropsiquiatr. 2003;61(3B):777-781.', version: NEXUS_MEEM_RULE_VERSION },
    ],
  });
  return finalizeNexusResult(draft.id);
}
