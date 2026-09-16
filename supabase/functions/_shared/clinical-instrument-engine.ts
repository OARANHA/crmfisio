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
  canonicalAnswers?: Record<string, number>;
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


export const CAGE_RULE_VERSION = 'nexus-cage-2026-09-16';
export const CAGE_PROCESSOR: ClinicalInstrumentProcessorDefinition = {
  toolKey: 'cage',
  ruleKey: 'nexus.cage',
  ruleVersion: CAGE_RULE_VERSION,
  moduleKey: 'scales',
  requiredCapability: 'nexus.scales',
  evidence: [
    { evidenceKey: 'cage-ewing-1984', title: 'Detecting alcoholism: The CAGE questionnaire', source: 'Ewing JA. JAMA. 1984;252(14):1905-1907.', year: 1984, version: CAGE_RULE_VERSION },
    { evidenceKey: 'cage-brazil-validation-1983', title: 'Validação brasileira do CAGE', source: 'Masur J, Monteiro MG. Braz J Med Biol Res. 1983;16(3):215-218.', year: 1983, version: CAGE_RULE_VERSION },
  ],
  calculate: (answers) => {
    const values = requireIntegerRange(answers, ['q1', 'q2', 'q3', 'q4'], 0, 1, 'CAGE');
    const totalScore = values.reduce((sum, value) => sum + value, 0);
    const positive = totalScore >= 2;
    const classification = positive ? 'Rastreio positivo pelo corte CAGE ≥ 2' : 'Rastreio negativo pelo corte CAGE ≥ 2';
    const interpretation = positive
      ? 'Duas ou mais respostas afirmativas configuram rastreio positivo pelo corte clássico do CAGE. O resultado não estabelece diagnóstico de transtorno por uso de álcool ou dependência e deve ser contextualizado clinicamente.'
      : 'Zero ou uma resposta afirmativa não atinge o corte clássico ≥ 2. Um resultado abaixo do corte não exclui uso de risco, dano relacionado ao álcool ou necessidade de avaliação clínica conforme o contexto.';
    return {
      totalScore,
      maxScore: 4,
      classification,
      severity: positive ? 'moderate' : 'low',
      interpretation,
      recommendations: [
        CLINICIAN_REVIEW_NOTICE,
        'Interpretar o CAGE como rastreio histórico de problemas relacionados ao álcool; não inferir diagnóstico, gravidade atual ou conduta apenas pelo escore.',
        'Se houver preocupação clínica, complementar a história de uso de álcool e utilizar avaliação apropriada ao objetivo e à população atendida.',
      ],
      answersArray: values,
      soapText: `CAGE: ${totalScore}/4 respostas afirmativas (${classification}) | Respostas: [${values.join(', ')}] | Instrumento de rastreio; interpretar clinicamente | Fonte: Ewing, 1984; validação BR: Masur & Monteiro, 1983`,
      redFlags: [],
    };
  },
};

export const PCL5_RULE_VERSION = 'nexus-pcl5-br-2026-09-16';
export const PCL5_PROCESSOR: ClinicalInstrumentProcessorDefinition = {
  toolKey: 'pcl5',
  ruleKey: 'nexus.pcl5',
  ruleVersion: PCL5_RULE_VERSION,
  moduleKey: 'scales',
  requiredCapability: 'nexus.scales',
  evidence: [
    { evidenceKey: 'pcl5-blevins-2015', title: 'The PTSD Checklist for DSM-5: Development and Initial Psychometric Evaluation', source: 'Blevins CA et al. J Trauma Stress. 2015;28(6):489-498.', year: 2015, version: PCL5_RULE_VERSION },
    { evidenceKey: 'pcl5-brazil-adaptation-2017', title: 'Adaptação transcultural brasileira do PCL-5', source: 'Osório FL et al. Arch Clin Psychiatry (São Paulo). 2017;44(1).', year: 2017, version: PCL5_RULE_VERSION },
    { evidenceKey: 'pcl5-brazil-psychometrics-2019', title: 'Propriedades psicométricas e utilidade diagnóstica da versão brasileira do PCL-5', source: 'Pereira-Lima K et al. Eur J Psychotraumatol. 2019;10(1):1581020. Cutoff 36 com maior eficiência global na amostra estudada.', year: 2019, version: PCL5_RULE_VERSION },
  ],
  calculate: (answers) => {
    const ids = Array.from({ length: 20 }, (_, index) => `q${index + 1}`);
    const values = requireIntegerRange(answers, ids, 0, 4, 'PCL-5');
    const totalScore = values.reduce((sum, value) => sum + value, 0);
    const positive = totalScore >= 36;
    const classification = positive
      ? 'Rastreio positivo pelo corte brasileiro PCL-5 ≥ 36'
      : 'Escore abaixo do corte brasileiro PCL-5 ≥ 36';
    const interpretation = positive
      ? 'O escore atinge o ponto de corte de 36 que apresentou melhor eficiência global na validação brasileira estudada. Isso indica necessidade de avaliação clínica adicional e não estabelece diagnóstico de TEPT isoladamente.'
      : 'O escore está abaixo de 36. Resultado abaixo do corte não exclui TEPT, sofrimento pós-traumático ou necessidade de avaliação conforme contexto, evento índice e julgamento clínico.';
    return {
      totalScore,
      maxScore: 80,
      classification,
      severity: positive ? 'moderate' : 'low',
      interpretation,
      recommendations: [
        CLINICIAN_REVIEW_NOTICE,
        'Confirmar que os itens foram respondidos em relação a um evento traumático de referência clinicamente apropriado; o PCL-5 não substitui a avaliação do Critério A.',
        'Interpretar escore e clusters no contexto clínico. Um rastreio positivo deve ser seguido de avaliação diagnóstica apropriada quando indicado.',
      ],
      answersArray: values,
      soapText: `PCL-5: ${totalScore}/80 pts (${classification}) | Respostas: [${values.join(', ')}] | Rastreio pós-traumático; não diagnóstico | Cutoff BR operacional: 36`,
      redFlags: [],
    };
  },
};

export const PCPTSD5_RULE_VERSION = 'nexus-pcptsd5-ptbr-ops-2026-09-16';
export const PCPTSD5_PROCESSOR: ClinicalInstrumentProcessorDefinition = {
  toolKey: 'pcptsd5',
  ruleKey: 'nexus.pcptsd5',
  ruleVersion: PCPTSD5_RULE_VERSION,
  moduleKey: 'scales',
  requiredCapability: 'nexus.scales',
  evidence: [
    { evidenceKey: 'pcptsd5-prins-2016', title: 'The Primary Care PTSD Screen for DSM-5: Development and Evaluation Within a Veteran Primary Care Sample', source: 'Prins A et al. J Gen Intern Med. 2016;31(10):1206-1211.', year: 2016, version: PCPTSD5_RULE_VERSION },
    { evidenceKey: 'pcptsd5-bovin-2021', title: 'Diagnostic accuracy and acceptability of the PC-PTSD-5 among US Veterans', source: 'Bovin MJ et al. JAMA Netw Open. 2021;4(2):e2036733.', year: 2021, version: PCPTSD5_RULE_VERSION },
  ],
  calculate: (answers) => {
    const traumaExposure = requireIntegerRange(answers, ['q0'], 0, 1, 'PC-PTSD-5')[0];
    if (traumaExposure === 0) {
      return {
        totalScore: 0,
        maxScore: 5,
        classification: 'Trauma gate não confirmado; rastreio encerrado',
        severity: 'low',
        interpretation: 'A exposição a evento potencialmente traumático não foi confirmada no gate inicial. Pelo desenho do PC-PTSD-5, o rastreio sintomático termina nesse ponto com escore 0. Isso não substitui avaliação clínica de história de trauma quando houver dúvida ou indicação. A tradução PT-BR desta implementação é operacional e não possui validação brasileira publicada identificada nesta revisão.',
        recommendations: [
          CLINICIAN_REVIEW_NOTICE,
          'Não interpretar o escore 0 como exclusão clínica de trauma; ele reflete apenas o encerramento do PC-PTSD-5 após resposta negativa ao gate de exposição.',
        ],
        answersArray: [0],
        canonicalAnswers: { q0: 0 },
        soapText: 'PC-PTSD-5: trauma gate negativo; rastreio encerrado com escore 0/5 | Instrumento de rastreio; não diagnóstico',
        redFlags: [],
      };
    }

    const ids = ['q1', 'q2', 'q3', 'q4', 'q5'];
    const values = requireIntegerRange(answers, ids, 0, 1, 'PC-PTSD-5');
    const totalScore = values.reduce((sum, value) => sum + value, 0);
    const positive = totalScore >= 4;
    const classification = positive
      ? 'Rastreio positivo pelo cutoff operacional PC-PTSD-5 ≥ 4'
      : 'Escore abaixo do cutoff operacional PC-PTSD-5 ≥ 4';
    const interpretation = positive
      ? 'Quatro ou cinco respostas afirmativas atingem o cutoff operacional versionado desta implementação, apoiado por estudos de atenção primária dos EUA. O resultado indica necessidade de avaliação clínica adicional e não estabelece diagnóstico de TEPT. Este cutoff e esta tradução PT-BR não constituem validação brasileira.'
      : 'O escore ficou abaixo de 4. Um resultado abaixo do cutoff não exclui TEPT ou sofrimento relacionado a trauma; limiares mais baixos, como 3, podem ser considerados em contextos que priorizam sensibilidade e dispõem de avaliação subsequente. O cutoff operacional e a tradução PT-BR desta implementação não foram validados em amostra brasileira nesta revisão.';
    return {
      totalScore,
      maxScore: 5,
      classification,
      severity: positive ? 'moderate' : 'low',
      interpretation,
      recommendations: [
        CLINICIAN_REVIEW_NOTICE,
        'Interpretar o PC-PTSD-5 como rastreio breve após confirmação de exposição traumática; um resultado positivo deve ser seguido de avaliação clínica apropriada quando indicado.',
        'O cutoff 4 é a regra operacional versionada desta implementação com base em evidência externa; o profissional pode considerar o trade-off de sensibilidade/especificidade no contexto clínico sem alterar o resultado persistido.',
        'A tradução PT-BR é operacional e não deve ser apresentada como versão brasileira validada.',
      ],
      answersArray: [1, ...values],
      canonicalAnswers: { q0: 1, ...Object.fromEntries(values.map((value, index) => [`q${index + 1}`, value])) },
      soapText: `PC-PTSD-5: ${totalScore}/5 (${classification}) | Trauma gate: sim | Itens: [${values.join(', ')}] | Rastreio pós-traumático; não diagnóstico | Cutoff operacional: 4`,
      redFlags: [],
    };
  },
};

export const CLINICAL_INSTRUMENT_PROCESSORS: readonly ClinicalInstrumentProcessorDefinition[] = [
  PHQ9_PROCESSOR,
  GAD7_PROCESSOR,
  PHQ15_PROCESSOR,
  CAGE_PROCESSOR,
  PCL5_PROCESSOR,
  PCPTSD5_PROCESSOR,
];

export function getClinicalInstrumentProcessor(
  instrumentKey: string,
): ClinicalInstrumentProcessorDefinition | null {
  const normalized = instrumentKey.trim().toLowerCase();
  return CLINICAL_INSTRUMENT_PROCESSORS.find((item) => item.toolKey === normalized) ?? null;
}
