import type { NexusScaleDefinition, NexusScaleQuestion, NexusScaleResult } from './scaleRuntime';

const freq5 = [
  { label: 'Nunca (0)', value: 0 },
  { label: 'Menos de uma vez por mês (1)', value: 1 },
  { label: 'Mensalmente (2)', value: 2 },
  { label: 'Semanalmente (3)', value: 3 },
  { label: 'Diariamente ou quase diariamente (4)', value: 4 },
] as const;

const AUDIT_QUESTIONS: readonly NexusScaleQuestion[] = [
  { id: 'q1', text: '1. Com que frequência consome bebidas que contêm álcool?', subscale: 'consumo', options: [
    { label: 'Nunca (0)', value: 0 }, { label: 'Mensalmente ou menos (1)', value: 1 }, { label: '2 a 4 vezes por mês (2)', value: 2 }, { label: '2 a 3 vezes por semana (3)', value: 3 }, { label: '4 ou mais vezes por semana (4)', value: 4 },
  ] },
  { id: 'q2', text: '2. Quantas doses de bebida alcoólica consome num dia normal em que bebe? (1 dose = 1 lata de cerveja, 1 taça de vinho ou 1 shot de destilado)', subscale: 'consumo', options: [
    { label: '1 ou 2 doses (0)', value: 0 }, { label: '3 ou 4 doses (1)', value: 1 }, { label: '5 ou 6 doses (2)', value: 2 }, { label: '7 a 9 doses (3)', value: 3 }, { label: '10 ou mais doses (4)', value: 4 },
  ] },
  { id: 'q3', text: '3. Com que frequência consome 6 ou mais doses de bebida alcoólica numa única ocasião ("binge drinking")?', subscale: 'consumo', options: freq5 },
  { id: 'q4', text: '4. Com que frequência, durante o último ano, percebeu que não conseguia parar de beber uma vez que havia começado?', subscale: 'dependencia', options: freq5 },
  { id: 'q5', text: '5. Com que frequência, durante o último ano, não conseguiu fazer o que era esperado de você devido à bebida?', subscale: 'dependencia', options: freq5 },
  { id: 'q6', text: '6. Com que frequência, durante o último ano, precisou de uma primeira dose pela manhã para se recuperar após uma bebedeira anterior?', subscale: 'dependencia', options: freq5 },
  { id: 'q7', text: '7. Com que frequência, durante o último ano, teve sentimentos de culpa ou remorso após ter bebido?', subscale: 'problemas', options: freq5 },
  { id: 'q8', text: '8. Com que frequência, durante o último ano, não conseguiu se lembrar do que aconteceu na noite anterior por ter bebido?', subscale: 'problemas', options: freq5 },
  { id: 'q9', text: '9. Você ou outra pessoa já se machucou em consequência de você ter bebido?', subscale: 'problemas', options: [
    { label: 'Não (0)', value: 0 }, { label: 'Sim, mas não no último ano (2)', value: 2 }, { label: 'Sim, durante o último ano (4)', value: 4 },
  ] },
  { id: 'q10', text: '10. Algum parente, amigo, médico ou outro profissional de saúde já se preocupou com seu hábito de beber ou sugeriu que você parasse?', subscale: 'problemas', options: [
    { label: 'Não (0)', value: 0 }, { label: 'Sim, mas não no último ano (2)', value: 2 }, { label: 'Sim, durante o último ano (4)', value: 4 },
  ] },
];

function calculateAudit(answers: Record<string, number>): NexusScaleResult {
  const consumoScore = (answers.q1 || 0) + (answers.q2 || 0) + (answers.q3 || 0);
  const dependenciaScore = (answers.q4 || 0) + (answers.q5 || 0) + (answers.q6 || 0);
  const problemasScore = (answers.q7 || 0) + (answers.q8 || 0) + (answers.q9 || 0) + (answers.q10 || 0);
  const totalScore = Object.values(answers).reduce((sum, value) => sum + value, 0);
  let classification: string;
  let severity: NexusScaleResult['severity'];
  let interpretation: string;
  let recommendations: string[];

  if (totalScore <= 7) {
    classification = 'Zona I: Uso de Baixo Risco ou Abstinência';
    severity = 'low';
    interpretation = `Escore de ${totalScore}/40 pontos. Padrão de consumo atual com baixo risco de danos à saúde física e psicossocial.`;
    recommendations = ['Educação em saúde sobre limites seguros de consumo e riscos da associação com medicamentos', 'Manter acompanhamento de rotina'];
  } else if (totalScore <= 15) {
    classification = 'Zona II: Uso de Risco (Intervenção Breve Recomendada)';
    severity = 'moderate';
    interpretation = `Escore de ${totalScore}/40 pontos (corte ≥ 8 atingido). Consumo que excede os limites de segurança e eleva risco de morbidades e acidentes.`;
    recommendations = ['Realizar Intervenção Breve (IB) na própria consulta da APS (Feedback, Responsabilidade, Aconselhamento, Menu de opções, Empatia, Autoeficácia - FRAMES)', 'Fornecer folheto educativo e pactuar metas de redução do consumo', 'Reavaliar em 1 a 3 meses'];
  } else if (totalScore <= 19) {
    classification = 'Zona III: Uso Nocivo de Álcool';
    severity = 'high';
    interpretation = `Escore de ${totalScore}/40 pontos. Presença de danos físicos, psicológicos ou sociais decorrentes do consumo de álcool.`;
    recommendations = ['Intervenção Breve estruturada + Aconselhamento contínuo e monitoramento regular na APS', 'Avaliar exames laboratoriais (GGT, TGO, TGP, VCM) e investigar comorbidades psiquiátricas (Depressão, Ansiedade)', 'Considerar envolvimento da família e discussão com equipe de apoio / NASF'];
  } else {
    classification = 'Zona IV: Provável Dependência de Álcool';
    severity = 'severe';
    interpretation = `Escore de ${totalScore}/40 pontos (≥ 20). Forte indicativo de síndrome de dependência de álcool. Alto risco de sintomas de abstinência.`;
    recommendations = ['Avaliação médica detalhada para risco de Síndrome de Abstinência Alcoólica (SAA / Protocolo CIWA-Ar)', 'Considerar farmacoterapia para cessação/redução (ex: Naltrexona, Acamprosato, Dissulfiram) e Tiamina profilática', 'Encaminhamento / Acompanhamento compartilhado com CAPS AD (Atenção Psicossocial Álcool e Drogas)', 'Articulação com grupos de apoio mútuo (Alcoólicos Anônimos - AA)'];
  }

  return {
    totalScore, maxScore: 40, classification, severity, interpretation, recommendations,
    answersArray: AUDIT_QUESTIONS.map((question) => answers[question.id] ?? 0),
    structuredData: { consumoScore, dependenciaScore, problemasScore },
    soapText: `AUDIT: ${totalScore}/40 pts (${classification}) [Consumo: ${consumoScore}/12 | Dependência: ${dependenciaScore}/12 | Problemas: ${problemasScore}/16] | Fonte: OMS (Babor et al., 2001 - Validação BR: Mendez, 1999)`,
  };
}

export const AUDIT_DEFINITION: NexusScaleDefinition = {
  toolKey: 'audit', moduleKey: 'mental-health', ruleKey: 'nexus.audit', ruleVersion: 'nexus-2026-09-03', requiredCapability: 'nexus.scales',
  title: 'AUDIT (Alcohol Use Disorders Identification Test)', acronym: 'AUDIT', targetGroup: 'Adultos e adolescentes na APS para rastreamento de padrão de consumo e dependência de álcool',
  description: 'Instrumento desenvolvido pela OMS e amplamente validado no Brasil para identificação precoce do uso de risco, uso nocivo e provável dependência de álcool na Atenção Primária.',
  instructions: 'Para cada pergunta abaixo, selecione a resposta que melhor reflete seus hábitos de consumo de bebidas alcoólicas no último ano.',
  referenceCitation: 'Babor TF, Higgins-Biddle JC, Saunders JB, Monteiro MG. WHO/MSD/MSB/01.6a, 2001. Validação brasileira: Mendez EB (1999); Moretti-Pires RO, Corradi-Webster CM (2011).',
  validationInfo: 'Padrão-ouro da OMS validado no Brasil para a APS. Sensibilidade: 92%, Especificidade: 94% para uso de risco (corte ≥ 8).',
  cutoffInfo: '0-7: Baixo Risco | 8-15: Uso de Risco | 16-19: Uso Nocivo | 20-40: Provável Dependência (Corte ≥ 8)', estimatedMinutes: 3,
  questions: AUDIT_QUESTIONS,
  evidence: [
    { evidenceKey: 'audit-who-babor-2001', title: 'AUDIT manual', source: 'Babor TF, Higgins-Biddle JC, Saunders JB, Monteiro MG. WHO/MSD/MSB/01.6a, 2001.', year: 2001, version: 'nexus-2026-09-03' },
    { evidenceKey: 'audit-brazil-validation', title: 'Validação brasileira do AUDIT', source: 'Mendez EB (1999); Moretti-Pires RO, Corradi-Webster CM (2011).', version: 'nexus-2026-09-03' },
  ],
  clinicalConduct: [
    { title: 'Zona I (0 a 7 pts) — Uso de Baixo Risco ou Abstinência', description: 'Educação em saúde sobre limites seguros de consumo segundo a OMS (máximo de 2 doses/dia para homens e 1 dose/dia para mulheres e idosos, com no mínimo 2 dias livres de álcool por semana). Orientar riscos da associação com psicotrópicos.', badge: '0-7 pts: Zona I (Baixo Risco)', tone: 'neutral' },
    { title: 'Zona II (8 a 15 pts) — Uso de Risco (Intervenção Breve)', description: 'Realizar Intervenção Breve (IB) de 5 a 15 minutos na própria consulta usando o acrônimo FRAMES: 1. Feedback sobre o escore; 2. Responsabilidade do paciente na mudança; 3. Aconselhamento claro e direto; 4. Menu de opções e metas; 5. Postura Empática; 6. Fomento da Autoeficácia. Reavaliar em 1 a 3 meses.', badge: '8-15 pts: Zona II (Uso de Risco)', tone: 'warning' },
    { title: 'Zona III (16 a 19 pts) — Uso Nocivo de Álcool', description: 'Intervenção Breve estruturada + Aconselhamento contínuo na UBS. Solicitar painel laboratorial de rastreio de lesão hepática e hematológica (GGT, TGO, TGP, VCM, Bilirrubinas, Plaquetas). Rastrear comorbidades psiquiátricas frequentes (Depressão - PHQ-9, Ansiedade - GAD-7).', badge: '16-19 pts: Zona III (Uso Nocivo)', tone: 'warning' },
    { title: 'Zona IV (20 a 40 pts) — Provável Síndrome de Dependência', description: 'Avaliação médica imediata para risco de Síndrome de Abstinência Alcoólica (escala CIWA-Ar). Prescrição profilática obrigatória de Tiamina (Vitamina B1) 100 a 300 mg/dia oral. Considerar farmacoterapia anticraving (Naltrexona 50mg/dia ou Acamprosato). Articulação e acompanhamento compartilhado com CAPS AD e grupos de autoajuda (Alcoólicos Anônimos - AA).', badge: '20-40 pts: Zona IV (Dependência)', tone: 'danger' },
    { title: '⚠️ Prevenção da Encefalopatia de Wernicke', description: 'NUNCA prescrever soro glicosado endovenoso para pacientes etilistas desnutridos ou em abstinência sem administrar Tiamina parenteral previamente ou concomitantemente (a infusão de glicose isolada precipita encefalopatia de Wernicke aguda por consumo de estoques críticos de tiamina).', badge: 'Alerta Crítico de Emergência', tone: 'danger' },
  ],
  monitoringGoals: [
    { title: 'Meta Primária: Redução do Consumo / Cessação', description: 'Redução progressiva de dias de consumo pesado ("binge drinking" — ≥ 5 doses para homens ou ≥ 4 doses para mulheres numa mesma ocasião) ou abstinência completa conforme pactuação do paciente.' },
    { title: 'Normalização dos Marcadores Biológicos', description: 'Monitoramento da queda de Gama-GT (GGT) e Volume Corpuscular Médio (VCM) em 6 a 12 semanas após a redução/cessação do consumo alcoólico.' },
    { title: 'Prevenção de Recaídas & Cuidado Compartilhado', description: 'Fortalecimento da rede de suporte sociofamiliar e agendamento de consultas regulares de seguimento na UBS a cada 30 a 60 dias.' },
  ],
  clinicalPearls: [
    { type: 'evidence', title: 'Eficácia da Intervenção Breve na Atenção Primária', text: 'Ensaios clínicos randomizados demonstram que uma Intervenção Breve de 5 a 15 minutos realizada pelo médico de família reduz o consumo nocivo de álcool em até 30% e diminui significativamente idas à emergência hospitalar e traumas.', reference: 'Babor TF et al. WHO/MSD/MSB/01.6a, 2001; Moretti-Pires RO et al. Rev Bras Psiquiatr. 2011.' },
    { type: 'pearl', title: 'Pérola Clínica: Estrutura dos 3 Domínios do AUDIT', text: 'Os itens 1-3 avaliam a Quantidade e Frequência do consumo (max 12 pts); os itens 4-6 avaliam Sintomas de Dependência (tolerância, perda de controle, compulsão - max 12 pts); e os itens 7-10 avaliam Problemas e Consequências Danosas (culpa, amnésia alcoólica, traumas - max 16 pts).' },
    { type: 'pitfall', title: 'Armadilha Clínica: Abstinência Aguda Não Reconhecida no Leito/Consultório', text: 'Tremores finos de extremidades, sudorese profusa, náuseas, taquicardia e insônia em pacientes internados ou em observação na UBS podem ser os primeiros sinais de Síndrome de Abstinência Alcoólica (SAA). Utilize o protocolo CIWA-Ar e trate precocemente com benzodiazepínicos de meia-vida longa (Diazepam) e Tiamina.' },
  ],
  calculate: calculateAudit,
};

const AUDITC_QUESTIONS: readonly NexusScaleQuestion[] = [
  { id: 'q1', text: '1. Com que frequência você consome bebidas alcoólicas?', options: [{ label: 'Nunca', value: 0 }, { label: '1 vez por mês ou menos', value: 1 }, { label: '2 a 4 vezes por mês', value: 2 }, { label: '2 a 3 vezes por semana', value: 3 }, { label: '4 ou mais vezes por semana', value: 4 }] },
  { id: 'q2', text: '2. Quantas doses de bebida alcoólica você consome em um dia típico em que bebe?', options: [{ label: '1 ou 2 doses', value: 0 }, { label: '3 ou 4 doses', value: 1 }, { label: '5 ou 6 doses', value: 2 }, { label: '7 a 9 doses', value: 3 }, { label: '10 ou mais doses', value: 4 }] },
  { id: 'q3', text: '3. Com que frequência você consome 6 ou mais doses de bebida alcoólica em uma única ocasião (binge drinking)?', options: [{ label: 'Nunca', value: 0 }, { label: 'Menos de 1 vez por mês', value: 1 }, { label: 'Mensalmente', value: 2 }, { label: 'Semanalmente', value: 3 }, { label: 'Diariamente ou quase diariamente', value: 4 }] },
];

function calculateAuditC(answers: Record<string, number>): NexusScaleResult {
  const totalScore = ['q1','q2','q3'].reduce((sum, id) => sum + (answers[id] ?? 0), 0);
  // Compatibilidade clínica: metadata e implementação Nexus divergem.
  // O Nexus informa corte >=4 em homens e >=3 em mulheres, mas a função original usa >=4 universalmente.
  // Preservar nesta versão e exigir revisão clínica explícita antes de alterar a regra.
  const isHighRisk = totalScore >= 4;
  const answersArray = AUDITC_QUESTIONS.map((question) => answers[question.id] ?? 0);
  return {
    totalScore, maxScore: 12,
    classification: isHighRisk ? 'AUDIT-C Positivo (Padrão de consumo de risco / nocivo)' : 'AUDIT-C Negativo (Baixo risco / Consumo moderado)',
    severity: isHighRisk ? 'moderate' : 'low',
    interpretation: `Escore de ${totalScore}/12 pontos no AUDIT-C. ${isHighRisk ? 'Indica padrão de consumo de risco. Recomenda-se aplicar o AUDIT completo de 10 itens para avaliação detalhada.' : 'Consumo compatível com baixo risco.'}`,
    recommendations: isHighRisk ? ['Realizar intervenção breve (IB) baseada em entrevista motivacional', 'Aplicar AUDIT completo de 10 itens para mapear dependência', 'Pactuar redução do padrão de consumo'] : ['Reforçar orientações preventivas de saúde'],
    answersArray,
    soapText: `AUDIT-C: ${totalScore}/12 pts (${isHighRisk ? 'Positivo / Consumo de risco' : 'Negativo / Baixo risco'}) | Itens: [${answersArray.join(', ')}]`,
    structuredData: { clinicalReviewRequired: 'audit-c-sex-specific-cutoff-divergence' },
  };
}

export const AUDITC_DEFINITION: NexusScaleDefinition = {
  toolKey: 'audit-c', moduleKey: 'mental-health', ruleKey: 'nexus.audit-c', ruleVersion: 'nexus-2026-09-03', requiredCapability: 'nexus.scales',
  title: 'AUDIT-C (Rastreio Rápido do Padrão de Consumo de Álcool)', acronym: 'AUDIT-C', targetGroup: 'Adultos na APS para rastreamento breve de consumo de risco',
  description: 'Versão abreviada de 3 itens do AUDIT focada em consumo e padrão de risco. Rastreia uso arriscado ou dependência em menos de 1 minuto.',
  instructions: 'Selecione a alternativa que melhor descreve o hábito de consumo de bebidas alcoólicas no último ano.',
  referenceCitation: 'Bush K, Kivlahan DR, McDonell MB, Fihn SD, Bradley KA. The AUDIT alcohol consumption questions (AUDIT-C). Arch Intern Med. 1998; 158(16):1789-95.',
  validationInfo: 'Sensibilidade de 86% e especificidade de 72% para corte ≥ 4 em homens e ≥ 3 em mulheres. A implementação Nexus atual usa ≥4 universalmente; divergência registrada para revisão clínica.',
  cutoffInfo: 'Metadata Nexus: Homens ≥ 4 | Mulheres ≥ 3. Regra executável preservada nesta versão: ≥ 4 universal.', estimatedMinutes: 1,
  questions: AUDITC_QUESTIONS,
  evidence: [{ evidenceKey: 'auditc-bush-1998', title: 'AUDIT-C', source: 'Bush K et al. Arch Intern Med. 1998;158(16):1789-95.', year: 1998, version: 'nexus-2026-09-03' }],
  clinicalConduct: [
    { title: 'Intervenção Breve (IB)', description: 'Fornecer feedback sobre o escore e limites recomendados.', badge: 'APS / MFC', tone: 'neutral' },
    { title: 'Avaliação Integral com AUDIT-10', description: 'Em caso de rastreio positivo, aprofundar a avaliação.', badge: 'Rastreio Positivo', tone: 'warning' },
  ],
  monitoringGoals: [], clinicalPearls: [], calculate: calculateAuditC,
};

const CAGE_QUESTIONS: readonly NexusScaleQuestion[] = [
  { id: 'q1', text: '1. (Cut-down) Você já sentiu que deveria diminuir a quantidade de bebida?', options: [{ label: 'Não', value: 0 }, { label: 'Sim', value: 1 }] },
  { id: 'q2', text: '2. (Annoyed) As pessoas já o(a) irritaram criticando seu modo de beber?', options: [{ label: 'Não', value: 0 }, { label: 'Sim', value: 1 }] },
  { id: 'q3', text: '3. (Guilty) Você já se sentiu culpado(a) ou chateado(a) consigo mesmo(a) pela maneira como bebe?', options: [{ label: 'Não', value: 0 }, { label: 'Sim', value: 1 }] },
  { id: 'q4', text: '4. (Eye-opener) Você já teve que beber pela manhã para acalmar os nervos ou se livrar de uma ressaca?', options: [{ label: 'Não', value: 0 }, { label: 'Sim', value: 1 }] },
];

function calculateCage(answers: Record<string, number>): NexusScaleResult {
  const totalScore = CAGE_QUESTIONS.reduce((sum, question) => sum + (answers[question.id] ?? 0), 0);
  const isPositive = totalScore >= 2;
  const answersArray = CAGE_QUESTIONS.map((question) => answers[question.id] ?? 0);
  return {
    totalScore, maxScore: 4,
    classification: isPositive ? 'CAGE Positivo (Suspeita de transtorno por uso de álcool)' : 'CAGE Negativo (Baixa probabilidade)',
    severity: isPositive ? 'high' : 'low',
    interpretation: `Escore de ${totalScore}/4 respostas afirmativas no CAGE. ${isPositive ? 'Rastreamento positivo (≥ 2 itens). Exige anamnese clínica direta sobre dependência, tolerância e abstinência.' : 'Rastreio negativo.'}`,
    recommendations: isPositive ? ['Avaliação clínica direta sobre critérios diagnósticos de dependência', 'Investigar sintomas de abstinência e complicações clínicas/sociais', 'Abordagem motivacional e projeto terapêutico singular'] : ['Orientações preventivas habituais'],
    answersArray,
    soapText: `CAGE: ${totalScore}/4 respostas afirmativas (${isPositive ? 'Positivo ≥ 2' : 'Negativo'}) | Itens: [${answersArray.join(', ')}]`,
  };
}

export const CAGE_DEFINITION: NexusScaleDefinition = {
  toolKey: 'cage', moduleKey: 'mental-health', ruleKey: 'nexus.cage', ruleVersion: 'nexus-2026-09-03', requiredCapability: 'nexus.scales',
  title: 'CAGE (Questionário de Rastreamento de Suspeita de Dependência Alcoólica)', acronym: 'CAGE', targetGroup: 'Adultos na APS com suspeita de problemas relacionados ao álcool',
  description: 'Instrumento clássico de 4 perguntas mnemônicas para rastreio de problemas e dependência de álcool.', instructions: 'Selecione Sim ou Não para cada pergunta.',
  referenceCitation: 'Ewing JA. Detecting alcoholism. The CAGE questionnaire. JAMA. 1984; 252(14):1905-7. Validação brasileira: Masur J, Monteiro MG. Rev Assoc Med Bras. 1983.',
  validationInfo: 'Corte ≥ 2 respostas afirmativas sugere fortemente problemas relacionados ao uso de álcool.', cutoffInfo: '0-1: Baixa probabilidade | ≥ 2: Suspeita de uso problemático / dependência de álcool', estimatedMinutes: 1,
  questions: CAGE_QUESTIONS,
  evidence: [
    { evidenceKey: 'cage-ewing-1984', title: 'CAGE questionnaire', source: 'Ewing JA. JAMA. 1984;252(14):1905-7.', year: 1984, version: 'nexus-2026-09-03' },
    { evidenceKey: 'cage-brazil-masur-1983', title: 'Validação brasileira CAGE', source: 'Masur J, Monteiro MG. Rev Assoc Med Bras. 1983.', year: 1983, version: 'nexus-2026-09-03' },
  ],
  clinicalConduct: [{ title: 'Anamnese Clínica Detalhada', description: 'Investigar tempo de uso, tolerância e sintomas de abstinência matinal.', badge: 'Clínica', tone: 'warning' }],
  monitoringGoals: [], clinicalPearls: [], calculate: calculateCage,
};
