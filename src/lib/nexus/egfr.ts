export const NEXUS_EGFR_RULE_VERSION = 'nexus-egfr-2026-09-04';

export type EgfrSex = 'male' | 'female';
export type EgfrStage = 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';

export type EgfrResult = {
  egfr: number;
  stage: EgfrStage;
  severity: 'low' | 'moderate' | 'high' | 'severe';
  interpretation: string;
  soapText: string;
};

export function calculateEgfr2021(creatinineMgDl: number, ageYears: number, sex: EgfrSex): EgfrResult {
  if (!Number.isFinite(creatinineMgDl) || creatinineMgDl <= 0) throw new Error('Creatinina deve ser maior que zero.');
  if (!Number.isFinite(ageYears) || ageYears <= 0 || ageYears > 120) throw new Error('Idade inválida para CKD-EPI 2021.');

  const isFemale = sex === 'female';
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const sexMultiplier = isFemale ? 1.012 : 1;
  const ratio = creatinineMgDl / kappa;
  const egfr = Math.round(
    142 * Math.min(ratio, 1) ** alpha * Math.max(ratio, 1) ** -1.2 * 0.9938 ** ageYears * sexMultiplier,
  );

  let stage: EgfrStage;
  let severity: EgfrResult['severity'];
  let interpretation: string;

  if (egfr >= 90) {
    stage = 'G1'; severity = 'low';
    interpretation = 'Função renal normal / G1. Sem necessidade de ajuste de dose por TFG.';
  } else if (egfr >= 60) {
    stage = 'G2'; severity = 'low';
    interpretation = 'Declínio leve da TFG / G2. Monitorar função renal se em uso de Lítio ou Lítio + AINEs.';
  } else if (egfr >= 45) {
    stage = 'G3a'; severity = 'moderate';
    interpretation = 'Declínio moderado (G3a). Atentar para ajuste de dose de Lítio, Pregabalina e Gabapentina.';
  } else if (egfr >= 30) {
    stage = 'G3b'; severity = 'high';
    interpretation = 'Declínio moderadamente grave (G3b). Reduzir doses de fármacos de excreção renal e evitar nefrotóxicos.';
  } else if (egfr >= 15) {
    stage = 'G4'; severity = 'severe';
    interpretation = 'Declínio grave (G4). Contraindicação formal para Lítio em APS ou necessidade de manejo especialista conjunto.';
  } else {
    stage = 'G5'; severity = 'severe';
    interpretation = 'Falência renal (G5). Risco imediato, discussão urgente com Nefrologia/CAPS.';
  }

  const soapText = `Avaliada Função Renal (CKD-EPI 2021): Creatinina ${creatinineMgDl} mg/dL, TFG estimada de ${egfr} mL/min/1,73m² (${interpretation.split('.')[0]}).`;
  return { egfr, stage, severity, interpretation, soapText };
}
