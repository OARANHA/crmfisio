export const NEXUS_CV_RISK_RULE_VERSION = 'nexus-cv-risk-2026-09-04';

export type CardiovascularRiskInput = {
  age: number;
  gender: 'male' | 'female';
  sysBp: number;
  isBpTreated: boolean;
  isSmoker: boolean;
  hasDiabetes: boolean;
  calcMode: 'lipid' | 'bmi';
  totCholesterol?: number;
  hdlCholesterol?: number;
  weightKg?: number;
  heightCm?: number;
  hasEstablishedCvd?: boolean;
  hasAorticAneurysm?: boolean;
  hasSevereCkd?: boolean;
  hasSevereHypercholesterolemia?: boolean;
  hasSubclinicalAtherosclerosis?: boolean;
  hasDiabetesWithRiskFactors?: boolean;
  hasFamilyHistoryPrematureCvd?: boolean;
  hasMetabolicSyndrome?: boolean;
  hasMicroalbuminuria?: boolean;
  hasHighSensitivityCrp?: boolean;
  usesHighRiskAntipsychotic?: boolean;
  antipsychoticName?: string;
  hasSevereMentalIllness?: boolean;
};

export type CardiovascularRiskResult = {
  riskPercentage: number;
  riskCategory: 'low' | 'intermediate' | 'high' | 'very_high';
  riskLabel: string;
  isReclassified: boolean;
  isDirectRisk: boolean;
  directRiskReason?: string;
  ldlTarget: string;
  nonHdlTarget: string;
  bpTarget: string;
  statinRecommendation: string;
  aspirinRecommendation: string;
  lifestyleRecommendation: string;
  psychiatricAlert?: string;
  metabolicMonitoringPlan?: string[];
  bmiCalculated?: number;
  interpretation: string;
  soapText: string;
};

export function calculateCardiovascularRisk(input: CardiovascularRiskInput): CardiovascularRiskResult {
  if (!Number.isFinite(input.age) || input.age <= 0) throw new Error('Idade inválida.');
  if (!Number.isFinite(input.sysBp) || input.sysBp <= 0) throw new Error('PAS inválida.');
  if (input.calcMode === 'lipid' && (!Number.isFinite(input.totCholesterol) || !Number.isFinite(input.hdlCholesterol))) throw new Error('Colesterol total e HDL são obrigatórios no modo lipídico.');
  if (input.calcMode === 'bmi' && (!Number.isFinite(input.weightKg) || !Number.isFinite(input.heightCm) || (input.weightKg ?? 0) <= 0 || (input.heightCm ?? 0) <= 0)) throw new Error('Peso e altura são obrigatórios no modo IMC.');

  const {
    age, gender, sysBp, isBpTreated, isSmoker, hasDiabetes, calcMode,
    totCholesterol = 200, hdlCholesterol = 45, weightKg = 75, heightCm = 170,
    hasEstablishedCvd = false, hasAorticAneurysm = false, hasSevereCkd = false,
    hasSevereHypercholesterolemia = false, hasSubclinicalAtherosclerosis = false,
    hasDiabetesWithRiskFactors = false, hasFamilyHistoryPrematureCvd = false,
    hasMetabolicSyndrome = false, hasMicroalbuminuria = false, hasHighSensitivityCrp = false,
    usesHighRiskAntipsychotic = false, antipsychoticName = '', hasSevereMentalIllness = false,
  } = input;

  const isFemale = gender === 'female';
  const isVeryHighDirectRisk = hasEstablishedCvd || hasAorticAneurysm;
  const isHighDirectRisk = !isVeryHighDirectRisk && (hasSevereCkd || hasSevereHypercholesterolemia || hasSubclinicalAtherosclerosis || hasDiabetesWithRiskFactors);
  let directReason = '';
  if (hasEstablishedCvd) directReason = 'Doença Aterosclerótica Cardiovascular clinicamente manifesta (DAC / IAM / AVC / AIT / DAP / Revascularização)';
  else if (hasAorticAneurysm) directReason = 'Aneurisma de Aorta Abdominal documentado';
  else if (hasSevereHypercholesterolemia) directReason = 'Hipercolesterolemia Grave (LDL-C ≥ 190 mg/dL ou Colesterol Total ≥ 310 mg/dL)';
  else if (hasSevereCkd) directReason = 'Doença Renal Crônica (TFG < 60 mL/min/1,73m² / Estágio 3-5 ou Microalbuminúria persistente)';
  else if (hasSubclinicalAtherosclerosis) directReason = 'Aterosclerose Subclínica documentada (Escore de Cálcio Coronário > 100 ou estenose > 50%)';
  else if (hasDiabetesWithRiskFactors) directReason = 'Diabetes Mellitus com lesão de órgão-alvo ou tempo de evolução ≥ 10 anos / múltiplos fatores de risco';

  const clampedAge = Math.min(Math.max(age, 30), 74);
  const clampedSysBp = Math.min(Math.max(sysBp, 90), 200);
  const lnAge = Math.log(clampedAge);
  const lnSysBp = Math.log(clampedSysBp);
  let calculatedPercentage = 5;
  let bmiCalculated: number | undefined;

  if (calcMode === 'bmi') {
    const heightM = heightCm / 100;
    bmiCalculated = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
    const lnBmi = Math.log(Math.min(Math.max(bmiCalculated, 15), 50));
    if (!isFemale) {
      const sum = lnAge * 3.11296 + lnBmi * 0.79277 + (isBpTreated ? lnSysBp * 1.92672 : lnSysBp * 1.85508) + (isSmoker ? 0.70953 : 0) + ((hasDiabetes || hasDiabetesWithRiskFactors) ? 0.5316 : 0);
      calculatedPercentage = Math.round((1 - Math.pow(0.88431, Math.exp(sum - 23.9388))) * 1000) / 10;
    } else {
      const sum = lnAge * 2.72107 + lnBmi * 0.51125 + (isBpTreated ? lnSysBp * 2.88267 : lnSysBp * 2.81291) + (isSmoker ? 0.61868 : 0) + ((hasDiabetes || hasDiabetesWithRiskFactors) ? 0.77763 : 0);
      calculatedPercentage = Math.round((1 - Math.pow(0.94833, Math.exp(sum - 26.0145))) * 1000) / 10;
    }
  } else {
    const lnTotChol = Math.log(Math.min(Math.max(totCholesterol, 100), 400));
    const lnHdl = Math.log(Math.min(Math.max(hdlCholesterol, 20), 100));
    if (!isFemale) {
      const sum = lnAge * 3.06117 + lnTotChol * 1.1237 - lnHdl * 0.93263 + (isBpTreated ? lnSysBp * 1.99881 : lnSysBp * 1.93303) + (isSmoker ? 0.65451 : 0) + ((hasDiabetes || hasDiabetesWithRiskFactors) ? 0.57367 : 0);
      calculatedPercentage = Math.round((1 - Math.pow(0.88936, Math.exp(sum - 23.9802))) * 1000) / 10;
    } else {
      const sum = lnAge * 2.32888 + lnTotChol * 1.20904 - lnHdl * 0.70833 + (isBpTreated ? lnSysBp * 2.82263 : lnSysBp * 2.76157) + (isSmoker ? 0.52873 : 0) + ((hasDiabetes || hasDiabetesWithRiskFactors) ? 0.69154 : 0);
      calculatedPercentage = Math.round((1 - Math.pow(0.95012, Math.exp(sum - 26.1931))) * 1000) / 10;
    }
  }

  calculatedPercentage = Math.min(Math.max(calculatedPercentage, 0.5), 75);
  let riskCategory: CardiovascularRiskResult['riskCategory'] = 'low';
  let riskLabel = `Baixo Risco Cardiovascular (${calculatedPercentage.toFixed(1)}% em 10 anos)`;
  let isReclassified = false;

  if (isVeryHighDirectRisk) {
    riskCategory = 'very_high';
    riskLabel = 'MUITO ALTO RISCO CARDIOVASCULAR (Estratificação Direta)';
    calculatedPercentage = Math.max(calculatedPercentage, 25);
  } else if (isHighDirectRisk) {
    riskCategory = 'high';
    riskLabel = 'ALTO RISCO CARDIOVASCULAR (Estratificação Direta)';
    calculatedPercentage = Math.max(calculatedPercentage, 20);
  } else {
    if (!isFemale) {
      riskCategory = calculatedPercentage >= 20 ? 'high' : calculatedPercentage >= 5 ? 'intermediate' : 'low';
    } else {
      riskCategory = calculatedPercentage >= 10 ? 'high' : calculatedPercentage >= 5 ? 'intermediate' : 'low';
    }
    riskLabel = riskCategory === 'high' ? `Alto Risco Cardiovascular (${calculatedPercentage.toFixed(1)}% em 10 anos)` : riskCategory === 'intermediate' ? `Risco Cardiovascular Intermediário (${calculatedPercentage.toFixed(1)}% em 10 anos)` : `Baixo Risco Cardiovascular (${calculatedPercentage.toFixed(1)}% em 10 anos)`;
    const aggravator = hasFamilyHistoryPrematureCvd || hasMetabolicSyndrome || hasMicroalbuminuria || hasHighSensitivityCrp;
    if (riskCategory === 'intermediate' && aggravator) {
      riskCategory = 'high';
      isReclassified = true;
      riskLabel = 'ALTO RISCO (Reclassificado por Fatores Agravantes da SBC)';
    }
  }

  let ldlTarget = '< 130 mg/dL';
  let nonHdlTarget = '< 160 mg/dL';
  let bpTarget = '< 140/90 mmHg (se bem tolerado, < 130/80 mmHg)';
  let statinRecommendation = 'Modificações no Estilo de Vida (MEV) constituem a conduta primordial. Reavaliar em 1 a 2 anos.';
  let aspirinRecommendation = 'Contraindicado para prevenção primária em baixo risco.';
  const lifestyleRecommendation = 'Dieta cardioprotetora (DASH/Mediterrânea), cessação do tabagismo, 150 min/sem de atividade física aeróbica moderada e controle de peso.';
  let interpretation = 'Padrão cardiovascular de baixo risco (< 5% em 10 anos). Estimular a manutenção de hábitos de vida saudáveis e reavaliação periódica na APS.';

  if (riskCategory === 'intermediate') {
    ldlTarget = '< 100 mg/dL'; nonHdlTarget = '< 130 mg/dL'; bpTarget = '< 130/80 mmHg';
    statinRecommendation = 'MEV intensiva por 3 a 6 meses. Se LDL permanecer ≥ 100 mg/dL, iniciar Estatina de MODERADA POTÊNCIA (Atorvastatina 10-20 mg, Rosuvastatina 5-10 mg, Sinvastatina 20-40 mg).';
    aspirinRecommendation = 'Geralmente não indicado em prevenção primária no risco intermediário.';
    interpretation = 'Risco cardiovascular intermediário. Pactuar metas de estilo de vida, investigar fatores agravantes ocultos e avaliar introdução de estatina se LDL ≥ 100 mg/dL.';
  } else if (riskCategory === 'high') {
    ldlTarget = '< 70 mg/dL (e redução ≥ 50% do valor basal)'; nonHdlTarget = '< 100 mg/dL'; bpTarget = '< 130/80 mmHg';
    statinRecommendation = 'Estatina de ALTA POTÊNCIA (Atorvastatina 40-80 mg ou Rosuvastatina 20-40 mg) ou MODERADA POTÊNCIA (Atorvastatina 20 mg, Rosuvastatina 10 mg, Sinvastatina 40 mg).';
    aspirinRecommendation = 'AAS 100 mg/dia pode ser considerado individualmente se DM com múltiplos fatores ou CAC > 100 com baixo risco de sangramento.';
    interpretation = isReclassified ? 'Paciente com risco inicial intermediário RECLASSIFICADO PARA ALTO RISCO pela presença de fatores agravantes (histórico familiar precoce, síndrome metabólica ou marcadores subclínicos).' : isHighDirectRisk ? `ALTO RISCO POR CRITÉRIO DIRETO: ${directReason}. Exige meta de LDL < 70 mg/dL e terapia farmacológica preventiva imediata.` : 'ALTO RISCO DE EVENTOS CORONARIANOS E CEREBROVASCULARES EM 10 ANOS (> 20% M / > 10% F). Indicação formal de estatina e controle de fatores de risco.';
  } else if (riskCategory === 'very_high') {
    ldlTarget = '< 50 mg/dL (e redução ≥ 50% do valor basal)'; nonHdlTarget = '< 80 mg/dL'; bpTarget = '< 130/80 mmHg';
    statinRecommendation = 'Estatina de ALTA POTÊNCIA (Atorvastatina 40-80 mg/dia ou Rosuvastatina 20-40 mg/dia). Associar Ezetimiba 10 mg se LDL fora da meta.';
    aspirinRecommendation = 'AAS 100 mg/dia formalmente indicado (prevenção secundária).';
    interpretation = 'MUITO ALTO RISCO DE EVENTOS CARDIOVASCULARES GRAVES OU MORTE. Meta estrita de LDL < 50 mg/dL e controle pressórico intensivo.';
  }

  let psychiatricAlert: string | undefined;
  const metabolicMonitoringPlan: string[] = [];
  if (usesHighRiskAntipsychotic || antipsychoticName) {
    psychiatricAlert = `⚠️ ALERTA METABÓLICO APS: O paciente está em uso ou planejamento de antipsicótico atípico com alto potencial de ganho ponderal e síndrome metabólica ${antipsychoticName ? `(${antipsychoticName})` : '(Olanzapina, Quetiapina, Clozapina ou Risperidona)'}.`;
    metabolicMonitoringPlan.push('Basal (pré-início): Peso, IMC, Circunferência Abdominal, PA, Glicemia de jejum / HbA1c e Perfil Lipídico (CT, HDL, LDL, TG).', '4 e 8 semanas: Reavaliação de peso e IMC (se ganho > 5% do peso basal, considerar troca precoce por Aripiprazol ou Lurasidona).', '12 semanas: Repetir Glicemia de jejum, Perfil Lipídico completo e PA.', 'Anual: Manter monitoramento metabólico periódico ou semestral se fatores de risco presentes.', 'Eletrocardiograma (ECG): Avaliar intervalo QTc prévio e pós-titulação se associação de psicofármacos ou histórico cardiovascular.');
  }
  if (hasSevereMentalIllness) {
    const alert = '⚠️ TRANSTORNO MENTAL GRAVE (Esquizofrenia / TAB / TDM Grave): Condição reconhecida como aceleradora de aterosclerose com mortalidade cardiovascular 2 a 3 vezes superior à população geral e subdiagnóstico frequente na APS.';
    psychiatricAlert = psychiatricAlert ? `${psychiatricAlert} | ${alert}` : alert;
  }

  const modeStr = calcMode === 'bmi' ? `Modo Clínico / IMC (${bmiCalculated} kg/m²)` : `Perfil Lipídico (CT ${totCholesterol} mg/dL, HDL ${hdlCholesterol} mg/dL)`;
  let soapText = `ESTRATIFICAÇÃO DE RISCO CARDIOVASCULAR (SBC / Framingham Global):\n- Escore Estimado em 10 Anos: ${calculatedPercentage.toFixed(1)}% em 10 anos (${riskLabel}) [${modeStr}]\n- Parâmetros: Idade ${age}a, Sexo ${isFemale ? 'F' : 'M'}, PAS ${sysBp} mmHg (${isBpTreated ? 'HAS tratada' : 'HAS não tratada'}), Tabagismo: ${isSmoker ? 'Sim' : 'Não'}, Diabetes: ${hasDiabetes || hasDiabetesWithRiskFactors ? 'Sim' : 'Não'}\n- Classificação de Risco: ${riskCategory.toUpperCase()} RISCO ${isReclassified ? '(Reclassificado por Fatores Agravantes)' : ''}\n- Metas Terapêuticas (SBC): LDL-C ${ldlTarget} | Não-HDL ${nonHdlTarget} | PA ${bpTarget}\n- Conduta Farmacológica: ${statinRecommendation}\n- Antiagregação (AAS): ${aspirinRecommendation}\n- Plano de Mudança de Estilo de Vida: ${lifestyleRecommendation}`;
  if (psychiatricAlert) soapText += `\n- Monitoramento Metabólico em Saúde Mental: ${psychiatricAlert}`;

  return { riskPercentage: calculatedPercentage, riskCategory, riskLabel, isReclassified, isDirectRisk: isVeryHighDirectRisk || isHighDirectRisk, directRiskReason: directReason || undefined, ldlTarget, nonHdlTarget, bpTarget, statinRecommendation, aspirinRecommendation, lifestyleRecommendation, psychiatricAlert, metabolicMonitoringPlan: metabolicMonitoringPlan.length ? metabolicMonitoringPlan : undefined, bmiCalculated, interpretation, soapText };
}
