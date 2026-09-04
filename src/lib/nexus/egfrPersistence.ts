import { createNexusResultDraft, finalizeNexusResult, type NexusClinicalResult } from '../nexusClinical';
import { calculateEgfr2021, NEXUS_EGFR_RULE_VERSION, type EgfrSex } from './egfr';

export type PersistEgfrInput = {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  creatinineMgDl: number;
  ageYears: number;
  sex: EgfrSex;
};

export async function persistEgfrResult(input: PersistEgfrInput): Promise<NexusClinicalResult> {
  const result = calculateEgfr2021(input.creatinineMgDl, input.ageYears, input.sex);

  const draft = await createNexusResultDraft({
    patientId: input.patientId,
    professionalId: input.professionalId,
    appointmentId: input.appointmentId ?? null,
    moduleKey: 'calculators',
    toolKey: 'egfr-ckdepi',
    ruleKey: 'nexus.egfr.ckd-epi-2021',
    ruleVersion: NEXUS_EGFR_RULE_VERSION,
    requiredCapability: 'nexus.calculators',
    inputSnapshot: {
      creatinineMgDl: input.creatinineMgDl,
      ageYears: input.ageYears,
      sex: input.sex,
    },
    outputSnapshot: {
      egfr: result.egfr,
      stage: result.stage,
      soapTarget: 'objective',
    },
    totalScore: result.egfr,
    classification: result.stage,
    severity: result.severity,
    interpretation: result.interpretation,
    soapText: result.soapText,
    evidenceSnapshot: [
      {
        evidenceKey: 'ckd-epi-2021-inge-2021',
        title: 'New Creatinine- and Cystatin C-Based Equations to Estimate GFR without Race',
        source: 'Inker LA et al. N Engl J Med. 2021.',
        version: NEXUS_EGFR_RULE_VERSION,
      },
    ],
  });

  return finalizeNexusResult(draft.id);
}
