import { createNexusResultDraft, finalizeNexusResult, type NexusClinicalResult } from '../nexusClinical';
import { calculateAntidepressantTransition, NEXUS_ANTIDEPRESSANT_SWITCH_RULE_VERSION } from './antidepressantSwitch';

export async function persistAntidepressantSwitch(input: { patientId:string; professionalId:string; appointmentId?:string|null; sourceDrugId:string; sourceDoseMg:number; targetDrugId:string }):Promise<NexusClinicalResult> {
  if (input.sourceDrugId === 'moclobemida' || input.targetDrugId === 'moclobemida') {
    throw new Error('Transições envolvendo Moclobemida aguardam revisão clínica explícita: o motor Nexus original não fecha esse ramo com cronograma próprio.');
  }
  const result=calculateAntidepressantTransition(input.sourceDrugId,input.sourceDoseMg,input.targetDrugId);
  const draft=await createNexusResultDraft({
    patientId:input.patientId, professionalId:input.professionalId, appointmentId:input.appointmentId??null,
    moduleKey:'psychopharmacology', toolKey:'antidepressant-switch', ruleKey:'nexus.psychopharmacology.antidepressant-switch', ruleVersion:NEXUS_ANTIDEPRESSANT_SWITCH_RULE_VERSION, requiredCapability:'nexus.psychopharmacology',
    inputSnapshot:{sourceDrugId:input.sourceDrugId,sourceDoseMg:input.sourceDoseMg,targetDrugId:input.targetDrugId},
    outputSnapshot:{strategyType:result.strategyType,strategyTitle:result.strategyTitle,durationWeeks:result.durationWeeks,calculatedEquivalentDoseMg:result.calculatedEquivalentDoseMg,recommendedStartingDoseMg:result.recommendedStartingDoseMg,recommendedTargetDoseMg:result.recommendedTargetDoseMg,timelineSteps:result.timelineSteps,clinicalRisks:result.clinicalRisks,patientInstructions:result.patientInstructions,soapTarget:'plan'},
    classification:result.strategyTitle,
    severity:result.clinicalRisks.serotoninSyndrome.risk==='Crítico'?'severe':result.clinicalRisks.discontinuationSyndrome.risk==='Muito Alto'?'moderate':'low',
    interpretation:result.strategySummary,
    soapText:result.soapPrescriptionText,
    evidenceSnapshot:[
      {evidenceKey:'hayasaka-antidepressant-equivalence-2015',title:'Dose equivalents of antidepressants: evidence-based recommendations from randomized controlled trials',source:'Hayasaka Y et al. J Affect Disord. 2015.',version:NEXUS_ANTIDEPRESSANT_SWITCH_RULE_VERSION},
      {evidenceKey:'maudsley-prescribing-guidelines-14',title:'The Maudsley Prescribing Guidelines in Psychiatry, 14th Edition',source:'Taylor D et al.',version:NEXUS_ANTIDEPRESSANT_SWITCH_RULE_VERSION},
    ],
  });
  return finalizeNexusResult(draft.id);
}
