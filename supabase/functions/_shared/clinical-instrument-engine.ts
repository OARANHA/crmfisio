export type ClinicalInstrumentSeverity = 'low' | 'moderate' | 'high' | 'severe';

export type ClinicalInstrumentEvidence = {
  evidenceKey: string;
  title: string;
  source: string;
  year?: number;
  version: string;
};

export type ClinicalInstrumentSafetySignal = {
  flagCode: string;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  requiredAction?: string;
};

export type ClinicalInstrumentCalculated = {
  totalScore: number;
  maxScore: number;
  classification: string;
  severity: ClinicalInstrumentSeverity;
  interpretation: string;
  recommendations: string[];
  answersArray: number[];
  soapText: string;
  redFlags?: ClinicalInstrumentSafetySignal[];
};

export type ClinicalInstrumentProcessorDefinition = {
  toolKey: string;
  ruleKey: string;
  ruleVersion: string;
  moduleKey: string;
  requiredCapability: string;
  evidence: ClinicalInstrumentEvidence[];
  calculate: (answers: Record<string, number>) => ClinicalInstrumentCalculated;
};

export function asClinicalInstrumentAnswerMap(
  payload: Record<string, unknown>,
  label: string,
): Record<string, number> {
  const answers = payload.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error(`${label} sem answers válidos`);
  }
  return answers as Record<string, number>;
}

function requireIntegerRange(
  answers: Record<string, number>,
  ids: string[],
  min: number,
  max: number,
  label: string,
): number[] {
  const values = ids.map((id) => answers[id]);
  if (values.some((value) => !Number.isInteger(value) || value < min || value > max)) {
    throw new Error(`${label} incompleto ou com resposta fora da faixa ${min}-${max}`);
  }
  return values;
}

export const CLINICIAN_REVIEW_NOTICE = 'Instrumento de rastreio: o escore não estabelece diagnóstico nem conduta isoladamente. Interpretar no contexto da entrevista, funcionalidade, comorbidades, riscos, preferências e julgamento clínico.';

export const PHQ9_RULE_VERSION = 'nexus-2026-09-03';
export const PHQ9_PROCESSOR: ClinicalInstrumentProcessorDefinition = {
  toolKey: 'phq9',
  ruleKey: 'nexus.phq9',
  ruleVersion: PHQ9_RULE_VERSION,
  moduleKey: 'scales',
  requiredCapability: 'nexus.scales',
  evidence: [
    { evidenceKey: 'phq9-kroenke-2001', title: 'The PHQ-9: validity of a brief depression severity measure', source: 'Kroenke K, Spitzer RL, Williams JB. J Gen Intern Med. 2001;16(9):606-13.', year: 2001, version: PHQ9_RULE_VERSION },
    { evidenceKey: 'phq9-brazil-validation', title: 'Validação brasileira do PHQ-9', source: 'Osório FL et al. (2009); Santos IS et al. (2013).', version: PHQ9_RULE_VERSION },
  ],
  calculate: (answers) => {
    const values = requireIntegerRange(answers, ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'], 0, 3, 'PHQ-9');
    const totalScore = values.reduce((sum, value) => sum + value, 0);
    let classification = '';
    let severity: ClinicalInstrumentSeverity = 'low';
    let interpretation = '';
    const recommendations: string[] = [CLINICIAN_REVIEW_NOTICE];

    if (totalScore <= 4) {
      classification = 'Faixa mínima de sintomas depressivos';
      interpretation = 'Escore PHQ-9 entre 0 e 4. O resultado deve ser contextualizado clinicamente e não exclui sofrimento, risco ou outra condição.';
      recommendations.push('Revisar sintomas, funcionalidade e contexto clínico conforme a necessidade do atendimento.');
    } else if (totalScore <= 9) {
      classification = 'Faixa leve de sintomas depressivos';
      interpretation = 'Escore PHQ-9 entre 5 e 9, compatível com carga sintomática leve no instrumento.';
      recommendations.push('Correlacionar o escore com duração, impacto funcional, contexto psicossocial e evolução longitudinal.');
    } else if (totalScore <= 14) {
      classification = 'Faixa moderada de sintomas depressivos';
      severity = 'moderate';
      interpretation = 'Escore PHQ-9 entre 10 e 14, acima do ponto de corte frequentemente utilizado para investigação clínica adicional.';
      recommendations.push('Realizar avaliação clínica diagnóstica e discutir opções de cuidado apropriadas ao caso, sem inferir conduta apenas pelo escore.');
    } else if (totalScore <= 19) {
      classification = 'Faixa moderadamente grave de sintomas depressivos';
      severity = 'high';
      interpretation = 'Escore PHQ-9 entre 15 e 19, indicando carga sintomática elevada no instrumento.';
      recommendations.push('Priorizar revisão clínica abrangente, impacto funcional, riscos, comorbidades e plano de acompanhamento individualizado.');
    } else {
      classification = 'Faixa grave de sintomas depressivos';
      severity = 'severe';
      interpretation = 'Escore PHQ-9 entre 20 e 27, indicando carga sintomática muito elevada no instrumento.';
      recommendations.push('Priorizar avaliação clínica abrangente e definição de plano assistencial individualizado, considerando riscos e necessidade de maior suporte conforme julgamento profissional.');
    }

    const redFlags: ClinicalInstrumentSafetySignal[] = [];
    if (answers.q9 > 0) {
      recommendations.unshift('⚠️ ALERTA: resposta positiva no item 9. Realizar avaliação clínica de segurança e risco de suicídio/autolesão conforme protocolo assistencial vigente; o PHQ-9 isoladamente não estratifica esse risco.');
      redFlags.push({
        flagCode: 'phq9.item9.positive',
        severity: 'critical',
        title: 'PHQ-9 item 9 positivo',
        message: 'Resposta positiva para pensamentos de morte ou autolesão no PHQ-9.',
        requiredAction: 'Realizar avaliação clínica de segurança e risco conforme protocolo assistencial vigente e registrar a conduta adotada.',
      });
    }

    return {
      totalScore,
      maxScore: 27,
      classification,
      severity,
      interpretation,
      recommendations,
      answersArray: values,
      soapText: `PHQ-9: ${totalScore}/27 pts (${classification}) | Respostas: [${values.join(', ')}] | Instrumento de rastreio; interpretar clinicamente | Fonte: Kroenke et al., 2001 (Validação BR: Osório, 2009)`,
      redFlags,
    };
  },
};

export const GAD7_RULE_VERSION = 'nexus-2026-09-03';
export const GAD7_PROCESSOR: ClinicalInstrumentProcessorDefinition = {
  toolKey: 'gad7',
  ruleKey: 'nexus.gad7',
  ruleVersion: GAD7_RULE_VERSION,
  moduleKey: 'scales',
  requiredCapability: 'nexus.scales',
  evidence: [
    { evidenceKey: 'gad7-spitzer-2006', title: 'A brief measure for assessing generalized anxiety disorder', source: 'Spitzer RL, Kroenke K, Williams JB, Löwe B. Arch Intern Med. 2006;166(10):1092-7.', year: 2006, version: GAD7_RULE_VERSION },
    { evidenceKey: 'gad7-brazil-validation', title: 'Validação brasileira do GAD-7', source: 'Moreno AL et al. Trends Psychiatry Psychother. 2016.', year: 2016, version: GAD7_RULE_VERSION },
  ],
  calculate: (answers) => {
    const values = requireIntegerRange(answers, ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'], 0, 3, 'GAD-7');
    const totalScore = values.reduce((sum, value) => sum + value, 0);
    let classification = '';
    let severity: ClinicalInstrumentSeverity = 'low';
    let interpretation = '';
    const recommendations: string[] = [CLINICIAN_REVIEW_NOTICE];

    if (totalScore <= 4) {
      classification = 'Faixa mínima de sintomas ansiosos';
      interpretation = 'Escore GAD-7 entre 0 e 4. O resultado deve ser contextualizado clinicamente e não exclui sofrimento ou outra condição.';
      recommendations.push('Revisar sintomas, funcionalidade e contexto clínico conforme a necessidade do atendimento.');
    } else if (totalScore <= 9) {
      classification = 'Faixa leve de sintomas ansiosos';
      interpretation = 'Escore GAD-7 entre 5 e 9, compatível com carga sintomática leve no instrumento.';
      recommendations.push('Correlacionar o escore com duração, gatilhos, impacto funcional, comorbidades e evolução longitudinal.');
    } else if (totalScore <= 14) {
      classification = 'Faixa moderada de sintomas ansiosos';
      severity = 'moderate';
      interpretation = 'Escore GAD-7 entre 10 e 14, acima do ponto de corte frequentemente utilizado para investigação clínica adicional.';
      recommendations.push('Realizar avaliação clínica diagnóstica e discutir opções de cuidado apropriadas ao caso, sem inferir conduta apenas pelo escore.');
    } else {
      classification = 'Faixa grave de sintomas ansiosos';
      severity = 'severe';
      interpretation = 'Escore GAD-7 entre 15 e 21, indicando carga sintomática elevada no instrumento.';
      recommendations.push('Priorizar revisão clínica abrangente, impacto funcional, diagnósticos diferenciais, comorbidades e plano de acompanhamento individualizado.');
    }

    return {
      totalScore,
      maxScore: 21,
      classification,
      severity,
      interpretation,
      recommendations,
      answersArray: values,
      soapText: `GAD-7: ${totalScore}/21 pts (${classification}) | Respostas: [${values.join(', ')}] | Instrumento de rastreio; interpretar clinicamente | Fonte: Spitzer et al., 2006 (Validação BR: Moreno, 2016)`,
      redFlags: [],
    };
  },
};

export const PHQ15_RULE_VERSION = 'nexus-phq15-2026-09-13';
export const PHQ15_PROCESSOR: ClinicalInstrumentProcessorDefinition = {
  toolKey: 'phq15',
  ruleKey: 'nexus.phq15',
  ruleVersion: PHQ15_RULE_VERSION,
  moduleKey: 'scales',
  requiredCapability: 'nexus.scales',
  evidence: [
    { evidenceKey: 'phq15-kroenke-2002', title: 'The PHQ-15: validity of a new measure for evaluating the severity of somatic symptoms', source: 'Kroenke K, Spitzer RL, Williams JB. Psychosom Med. 2002;64(2):258-66.', year: 2002, version: PHQ15_RULE_VERSION },
  ],
  calculate: (answers) => {
    const values = requireIntegerRange(answers, ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15'], 0, 2, 'PHQ-15');
    const totalScore = values.reduce((sum, value) => sum + value, 0);
    let classification = '';
    let severity: ClinicalInstrumentSeverity = 'low';
    let interpretation = '';
    const recommendations: string[] = [CLINICIAN_REVIEW_NOTICE];

    if (totalScore <= 4) {
      classification = 'Faixa mínima de sintomas somáticos';
      interpretation = 'Escore PHQ-15 entre 0 e 4, correspondente à faixa mínima de carga de sintomas somáticos no instrumento.';
    } else if (totalScore <= 9) {
      classification = 'Faixa baixa de sintomas somáticos';
      interpretation = 'Escore PHQ-15 entre 5 e 9, correspondente à faixa baixa de carga de sintomas somáticos no instrumento.';
    } else if (totalScore <= 14) {
      classification = 'Faixa moderada de sintomas somáticos';
      severity = 'moderate';
      interpretation = 'Escore PHQ-15 entre 10 e 14, correspondente à faixa moderada de carga de sintomas somáticos no instrumento.';
    } else {
      classification = 'Faixa alta de sintomas somáticos';
      severity = 'high';
      interpretation = 'Escore PHQ-15 entre 15 e 30, correspondente à faixa alta de carga de sintomas somáticos no instrumento.';
    }

    recommendations.push('Correlacionar o escore com história clínica, exame, funcionalidade, evolução temporal, comorbidades e contexto psicossocial.');
    recommendations.push('O PHQ-15 não diferencia causa orgânica de causa funcional e não substitui avaliação clínica de sinais de alarme ou diagnósticos diferenciais.');

    return {
      totalScore,
      maxScore: 30,
      classification,
      severity,
      interpretation,
      recommendations,
      answersArray: values,
      soapText: `PHQ-15: ${totalScore}/30 pts (${classification}) | Respostas: [${values.join(', ')}] | Instrumento de rastreio; interpretar clinicamente | Fonte: Kroenke et al., 2002`,
      redFlags: [],
    };
  },
};

export const CLINICAL_INSTRUMENT_PROCESSORS: readonly ClinicalInstrumentProcessorDefinition[] = [
  PHQ9_PROCESSOR,
  GAD7_PROCESSOR,
  PHQ15_PROCESSOR,
];

export function getClinicalInstrumentProcessor(
  instrumentKey: string,
): ClinicalInstrumentProcessorDefinition | null {
  const normalized = instrumentKey.trim().toLowerCase();
  return CLINICAL_INSTRUMENT_PROCESSORS.find((item) => item.toolKey === normalized) ?? null;
}
