import type { NexusEvidenceSnapshot, NexusSeverity } from '../nexusClinical';

export const PHQ9_RULE_KEY = 'nexus.phq9';
export const PHQ9_RULE_VERSION = 'nexus-2026-09-03';
export const PHQ9_REQUIRED_CAPABILITY = 'nexus.scales';

export type Phq9QuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8' | 'q9';
export type Phq9AnswerValue = 0 | 1 | 2 | 3;
export type Phq9Answers = Partial<Record<Phq9QuestionId, Phq9AnswerValue>>;

export type Phq9Result = {
  totalScore: number;
  maxScore: 27;
  classification: string;
  severity: NexusSeverity;
  interpretation: string;
  recommendations: string[];
  answersArray: Phq9AnswerValue[];
  soapText: string;
  hasSuicideRiskFlag: boolean;
};

export const PHQ9_OPTIONS: { label: string; value: Phq9AnswerValue }[] = [
  { label: 'Nenhuma vez', value: 0 },
  { label: 'Vários dias', value: 1 },
  { label: 'Mais da metade dos dias', value: 2 },
  { label: 'Quase todos os dias', value: 3 },
];

export const PHQ9_QUESTIONS: { id: Phq9QuestionId; text: string }[] = [
  { id: 'q1', text: '1. Pouco interesse ou pouco prazer em fazer as coisas' },
  { id: 'q2', text: '2. Sentir-se "na pior", deprimido(a) ou sem esperança' },
  { id: 'q3', text: '3. Dificuldade para adormecer ou permanecer dormindo, ou dormir demais' },
  { id: 'q4', text: '4. Sentir-se cansado(a) ou com pouca energia' },
  { id: 'q5', text: '5. Falta de apetite ou comendo demais' },
  { id: 'q6', text: '6. Sentir-se mal consigo mesmo(a) — ou achar que é um fracasso ou que decepcionou a si mesmo(a) ou sua família' },
  { id: 'q7', text: '7. Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão' },
  { id: 'q8', text: '8. Lentidão para se mover ou falar (a ponto de outras pessoas perceberem), ou o oposto: agitação física' },
  { id: 'q9', text: '9. Pensamentos de que seria melhor estar morto(a) ou de se ferir de alguma maneira' },
];

export const PHQ9_METADATA = {
  title: 'PHQ-9 (Patient Health Questionnaire-9)',
  acronym: 'PHQ-9',
  targetGroup: 'Adultos na APS com suspeita de episódio depressivo',
  description: 'Instrumento padrão-ouro para rastreamento e estratificação de gravidade dos sintomas depressivos nas últimas duas semanas.',
  shortInstruction: 'Avalie a frequência de cada sintoma nas últimas 2 semanas.',
  instructions: 'Para cada item abaixo, selecione com que frequência você (ou o paciente) foi incomodado(a) por esse problema nas últimas 2 semanas.',
  referenceCitation: 'Kroenke K, Spitzer RL, Williams JB. J Gen Intern Med. 2001; 16(9):606-13. Validação brasileira: de Lima Osório F et al. (2009) e Santos IS et al. (2013).',
  validationInfo: 'Validada no Brasil na APS. Sensibilidade: 88%, Especificidade: 88% (para corte ≥ 10).',
  cutoffInfo: '0-4: Mínimo | 5-9: Leve | 10-14: Moderado | 15-19: Mod. Grave | 20-27: Grave (Corte ≥ 10)',
  estimatedMinutes: 3,
} as const;

export const PHQ9_EVIDENCE: NexusEvidenceSnapshot[] = [
  {
    evidenceKey: 'phq9-kroenke-2001',
    title: 'The PHQ-9: validity of a brief depression severity measure',
    source: 'Kroenke K, Spitzer RL, Williams JB. J Gen Intern Med. 2001;16(9):606-13.',
    year: 2001,
    version: PHQ9_RULE_VERSION,
  },
  {
    evidenceKey: 'phq9-brazil-validation',
    title: 'Validação brasileira do PHQ-9',
    source: 'Osório FL et al. (2009); Santos IS et al. (2013).',
    version: PHQ9_RULE_VERSION,
  },
];

export const PHQ9_CLINICAL_CONDUCT = [
  {
    title: 'Escore 0 a 4 — Sintomas Mínimos ou Ausentes',
    description: 'Conduta habitual na APS. Reforçar hábitos de vida saudáveis, prática regular de atividade física (150 min/semana), higiene do sono e estratégias de redução do estresse. Não há indicação de antidepressivos.',
    badge: '0-4 pts: Mínimo',
  },
  {
    title: 'Escore 5 a 9 — Depressão Leve (Watchful Waiting)',
    description: 'Estratégia de monitoramento vigilante ativo ("Watchful Waiting") associada à psicoeducação e ativação comportamental. Estimular engajamento social, autocuidado e reavaliar em 4 a 8 semanas antes de cogitar intervenção farmacológica.',
    badge: '5-9 pts: Leve',
  },
  {
    title: 'Escore 10 a 14 — Depressão Moderada (Corte ≥ 10)',
    description: 'Ponto de corte clínico positivo. Indicação formal de Psicoterapia baseada em evidências (Terapia Cognitivo-Comportamental ou Interpessoal) e/ou Farmacoterapia com ISRS de 1ª linha (Sertralina 50-100mg, Fluoxetina 20-40mg, Escitalopram 10-20mg). Pactuar consultas mensais na APS.',
    badge: '10-14 pts: Moderado',
  },
  {
    title: 'Escore 15 a 19 — Depressão Moderadamente Grave',
    description: 'Iniciar tratamento medicamentoso estruturado com ISRS/ISRN em doses terapêuticas plenas. Retorno em 2 semanas para avaliação de tolerabilidade e adesão. Avaliar suporte familiar e articulação com equipe multiprofissional (eMulti).',
    badge: '15-19 pts: Mod. Grave',
  },
  {
    title: 'Escore 20 a 27 — Depressão Grave',
    description: 'Tratamento farmacológico imediato em dose otimizada associado a acompanhamento intensivo. Investigação sistemática de ideação suicida, suporte familiar e discussão do caso com Apoio Matricial em Saúde Mental ou CAPS.',
    badge: '20-27 pts: Grave',
  },
  {
    title: '⚠️ Manejo Obrigatório do Item 9 (Ideação Suicida / Autolesão)',
    description: 'Qualquer pontuação > 0 no item 9 exige aplicação imediata do protocolo C-SSRS (Columbia), investigação de plano/meios, bloqueio de meios letais e pactuação de Plano de Segurança Pessoal.',
    badge: 'Alerta Item 9',
  },
] as const;

export const PHQ9_MONITORING_GOALS = [
  {
    title: 'Resposta Clínica Inicial (4 a 6 semanas)',
    description: 'Redução ≥ 50% na pontuação basal do PHQ-9 após 4 a 6 semanas de uso do antidepressivo em dose terapêutica plena (CANMAT / APA / SUS).',
  },
  {
    title: 'Remissão Sintomática Completa',
    description: 'Escore PHQ-9 < 5 pontos mantido de forma contínua por pelo menos 6 a 12 meses na fase de manutenção para consolidação neurobiológica e prevenção de recaídas.',
  },
  {
    title: 'Conduta em Falha Terapêutica (< 25% de melhora)',
    description: 'Ausência de resposta significativa (< 25% de redução no PHQ-9) após 4-6 semanas em dose terapêutica exige: 1. Confirmar adesão; 2. Otimizar dose até o teto terapêutico; 3. Trocar de classe ou potencializar (ex: Lítio, Quetiapina, TCC).',
  },
] as const;

export const PHQ9_CLINICAL_PEARLS = [
  {
    type: 'evidence',
    title: 'Acurácia Diagnóstica e Validação Brasileira',
    text: 'O PHQ-9 possui sensibilidade de 88% e especificidade de 88% para o diagnóstico de Episódio Depressivo Maior na Atenção Primária no ponto de corte ≥ 10 (Kroenke et al., 2001; validação brasileira por Osório et al., 2009 e Santos et al., 2013).',
    reference: 'Kroenke K et al. J Gen Intern Med. 2001; Osório FL et al. Cad Saude Publica. 2009.',
  },
  {
    type: 'pearl',
    title: 'Pérola Clínica: A Regra dos 2 Itens Cardeais (PHQ-2)',
    text: 'Os itens 1 (anedonia) e 2 (humor deprimido) são os sintomas cardinais obrigatórios do DSM-5. Se ambos forem zero ("Nenhuma vez"), a probabilidade de depressão maior é inferior a 2%.',
  },
  {
    type: 'pitfall',
    title: 'Armadilha Clínica: Sintomas Somáticos em Doenças Crônicas e Idosos',
    text: 'Em pacientes com diabetes descompensada, insuficiência cardíaca, DPOC ou idosos frágeis, itens somáticos (fadiga, alteração de sono e apetite) podem estar aumentados pela condição de base. Valorize anedonia, culpa excessiva e humor rebaixado para confirmar a etiologia psiquiátrica.',
  },
] as const;

export function isPhq9Complete(answers: Phq9Answers): answers is Record<Phq9QuestionId, Phq9AnswerValue> {
  return PHQ9_QUESTIONS.every(({ id }) => answers[id] === 0 || answers[id] === 1 || answers[id] === 2 || answers[id] === 3);
}

export function calculatePhq9(answers: Phq9Answers): Phq9Result {
  if (!isPhq9Complete(answers)) {
    throw new Error('PHQ-9 incompleto: responda os 9 itens antes do cálculo final.');
  }

  const answersArray = PHQ9_QUESTIONS.map(({ id }) => answers[id]);
  const totalScore = answersArray.reduce((total, value) => total + value, 0);

  let classification = '';
  let severity: NexusSeverity = 'low';
  let interpretation = '';
  const recommendations: string[] = [];

  if (totalScore <= 4) {
    classification = 'Sintomas depressivos mínimos ou ausentes';
    severity = 'low';
    interpretation = 'Escore baixo (0-4 pts), sem indicação de intervenção farmacológica para depressão.';
    recommendations.push('Acompanhamento longitudinal de rotina na APS', 'Orientações gerais de estilo de vida e higiene do sono');
  } else if (totalScore <= 9) {
    classification = 'Depressão leve';
    severity = 'low';
    interpretation = 'Sintomas leves (5-9 pts). Avaliar contexto psicossocial e impacto funcional.';
    recommendations.push('Psicoeducação e suporte na APS', 'Ativação comportamental e atividade física orientada', 'Reavaliação em 4 a 8 semanas');
  } else if (totalScore <= 14) {
    classification = 'Depressão moderada';
    severity = 'moderate';
    interpretation = 'Sintomas moderados (10-14 pts, corte ≥ 10 atingido) com comprometimento das atividades diárias.';
    recommendations.push('Considerar psicoterapia (TCC/interpessoal) e/ou farmacoterapia (ISRS de 1ª linha)', 'Pactuar plano de acompanhamento em APS');
  } else if (totalScore <= 19) {
    classification = 'Depressão moderadamente grave';
    severity = 'high';
    interpretation = 'Sintomas significativos (15-19 pts) exigindo intervenção clínica e medicamentosa estruturada.';
    recommendations.push('Iniciar tratamento medicamentoso com ISRS', 'Pactuar retorno em 2 semanas', 'Avaliar suporte familiar e rede de apoio social');
  } else {
    classification = 'Depressão grave';
    severity = 'severe';
    interpretation = 'Sintomas graves (20-27 pts) com alto risco de prejuízo funcional e sofrimento psíquico severo.';
    recommendations.push('Iniciar farmacoterapia combinada/otimizada', 'Investigar ativamente ideação e planejamento suicida', 'Considerar discussão de caso em Apoio Matricial / Psiquiatria');
  }

  const hasSuicideRiskFlag = answers.q9 > 0;
  if (hasSuicideRiskFlag) {
    recommendations.unshift('⚠️ ALERTA: Resposta positiva na pergunta 9 (ideação suicida/autolesão). Aplicar imediatamente o protocolo C-SSRS e pactuar Plano de Segurança.');
  }

  const soapText = `PHQ-9: ${totalScore}/27 pts (${classification}) | Respostas: [${answersArray.join(', ')}] | Fonte: Kroenke et al., 2001 (Validação BR: Osório, 2009)`;

  return {
    totalScore,
    maxScore: 27,
    classification,
    severity,
    interpretation,
    recommendations,
    answersArray,
    soapText,
    hasSuicideRiskFlag,
  };
}
