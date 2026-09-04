import { createNexusResultDraft, finalizeNexusResult, type NexusClinicalResult } from '../nexusClinical';
import { calculateCardiovascularRisk, NEXUS_CV_RISK_RULE_VERSION, type CardiovascularRiskInput } from './cardiovascularRisk';

export async function persistCardiovascularRisk(input: {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  values: CardiovascularRiskInput;
}): Promise<NexusClinicalResult> {
  const result = calculateCardiovascularRisk(input.values);
  const draft = await createNexusResultDraft({
    patientId: input.patientId,
    professionalId: input.professionalId,
    appointmentId: input.appointmentId ?? null,
    moduleKey: 'calculators',
    toolKey: 'cv-risk-sbc',
    ruleKey: 'nexus.cv-risk.sbc-framingham',
    ruleVersion: NEXUS_CV_RISK_RULE_VERSION,
    requiredCapability: 'nexus.calculators',
    inputSnapshot: { ...input.values },
    outputSnapshot: {
      riskPercentage: result.riskPercentage,
      riskCategory: result.riskCategory,
      riskLabel: result.riskLabel,
      isReclassified: result.isReclassified,
      isDirectRisk: result.isDirectRisk,
      directRiskReason: result.directRiskReason ?? null,
      ldlTarget: result.ldlTarget,
      nonHdlTarget: result.nonHdlTarget,
      bpTarget: result.bpTarget,
      psychiatricAlert: result.psychiatricAlert ?? null,
      metabolicMonitoringPlan: result.metabolicMonitoringPlan ?? [],
      bmiCalculated: result.bmiCalculated ?? null,
      soapTarget: 'assessment',
    },
    totalScore: result.riskPercentage,
    maxScore: 100,
    classification: result.riskLabel,
    severity: result.riskCategory === 'very_high' ? 'severe' : result.riskCategory === 'high' ? 'high' : result.riskCategory === 'intermediate' ? 'moderate' : 'low',
    interpretation: result.interpretation,
    soapText: result.soapText,
    evidenceSnapshot: [
      { evidenceKey: 'cv-framingham-dagostino-2008', title: 'General cardiovascular risk profile', source: "D'Agostino RB et al. Circulation. 2008.", version: NEXUS_CV_RISK_RULE_VERSION },
      { evidenceKey: 'cv-sbc-prevention', title: 'Diretriz Brasileira de Prevenção Cardiovascular', source: 'Sociedade Brasileira de Cardiologia.', version: NEXUS_CV_RISK_RULE_VERSION },
    ],
  });
  return finalizeNexusResult(draft.id);
}
