import type { NexusEvidenceSnapshot, NexusSeverity } from '../nexusClinical';

export const GAD7_RULE_KEY = 'nexus.gad7';
export const GAD7_RULE_VERSION = 'nexus-2026-09-03';
export const GAD7_REQUIRED_CAPABILITY = 'nexus.scales';

export type Gad7QuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7';
export type Gad7AnswerValue = 0 | 1 | 2 | 3;
export type Gad7Answers = Partial<Record<Gad7QuestionId, Gad7AnswerValue>>;

export type Gad7Result = {
  totalScore: number;
  maxScore: 21;
  classification: string;
  severity: NexusSeverity;
  interpretation: string;
  recommendations: string[];
  answersArray: Gad7AnswerValue[];
  soapText: string;
};

export const GAD7_OPTIONS: { label: string; value: Gad7AnswerValue }[] = [
  { label: 'Nenhuma vez', value: 0 },
  { label: 'Vários dias', value: 1 },
  { label: 'Mais da metade dos dias', value: 2 },
  { label: 'Quase todos os dias', value: 3 },
];

export const GAD7_QUESTIONS: { id: Gad7QuestionId; text: string }[] = [
  { id: 'q1', text: '1. Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)' },
  { id: 'q2', text: '2. Não ser capaz de impedir ou de controlar as preocupações' },
  { id: 'q3', text: '3. Preocupar-se demais com diversas coisas' },
  { id: 'q4', text: '4. Dificuldade para relaxar' },
  { id: 'q5', text: '5. Ficar tão agitado(a) que se torna difícil permanecer sentado(a)' },
  { id: 'q6', text: '6. Ficar facilmente irritado(a) ou chateado(a)' },
  { id: 'q7', text: '7. Sentir medo como se algo terrível fosse acontecer' },
];

export const GAD7_METADATA = {
  title: 'GAD-7 (Generalized Anxiety Disorder-7)',
  acronym: 'GAD-7',
  targetGroup: 'Adultos na APS com queixas de ansiedade, tensão ou preocupação excessiva',
  description: 'Instrumento validado para triagem e mensuração da gravidade do Transtorno de Ansiedade Generalizada.',
  instructions: 'Para cada item abaixo, selecione com que frequência você (ou o paciente) foi incomodado(a) pelo sintoma nas últimas 2 semanas.',
  referenceCitation: 'Spitzer RL, Kroenke K, Williams JB, Löwe B. Arch Intern Med. 2006;166(10):1092-7. Validação brasileira: Moreno AL et al. (2016).',
  validationInfo: 'Versão brasileira validada. Sensibilidade: 89%, Especificidade: 82% para corte ≥ 10.',
  cutoffInfo: '0-4: Mínima | 5-9: Leve | 10-14: Moderada | 15-21: Grave (Corte ≥ 10 para TAG provável)',
  estimatedMinutes: 2,
} as const;

export const GAD7_EVIDENCE: NexusEvidenceSnapshot[] = [
  { evidenceKey: 'gad7-spitzer-2006', title: 'A brief measure for assessing generalized anxiety disorder', source: 'Spitzer RL, Kroenke K, Williams JB, Löwe B. Arch Intern Med. 2006;166(10):1092-7.', year: 2006, version: GAD7_RULE_VERSION },
  { evidenceKey: 'gad7-brazil-validation', title: 'Validação brasileira do GAD-7', source: 'Moreno AL et al. Trends Psychiatry Psychother. 2016.', year: 2016, version: GAD7_RULE_VERSION },
];

export const GAD7_CLINICAL_CONDUCT = [
  { title: 'Escore 0 a 4 — Ansiedade Mínima ou Ausente', description: 'Sintomas dentro do espectro adaptativo. Reforçar hábitos de vida saudáveis, manejo do estresse no trabalho e higiene do sono.' },
  { title: 'Escore 5 a 9 — Ansiedade Leve', description: 'Oferecer psicoeducação sobre o ciclo da ansiedade, treino de respiração diafragmática e incentivo à atividade física aeróbica regular. Reavaliar em 4 a 6 semanas.' },
  { title: 'Escore 10 a 14 — Ansiedade Moderada', description: 'Rastreio positivo para TAG. Considerar psicoterapia baseada em evidências e/ou farmacoterapia conforme avaliação clínica individual.' },
  { title: 'Escore 15 a 21 — Ansiedade Grave', description: 'Quadro de maior gravidade exige plano terapêutico estruturado e reavaliação próxima, conforme julgamento clínico.' },
  { title: 'Uso racional de benzodiazepínicos', description: 'Quando clinicamente indicados, usar com cautela, menor dose eficaz e plano explícito de duração/descontinuação.' },
] as const;

export const GAD7_MONITORING_GOALS = [
  { title: 'Resposta Clínica Inicial (4 a 6 semanas)', description: 'Redução ≥ 50% no escore basal do GAD-7 após intervenção terapêutica adequada.' },
  { title: 'Remissão e Manutenção', description: 'Escore final do GAD-7 < 5 pontos mantido após estabilização clínica.' },
  { title: 'Reavaliação longitudinal', description: 'Interpretar variação do escore junto ao funcionamento, adesão, efeitos adversos e contexto clínico.' },
] as const;

export const GAD7_CLINICAL_PEARLS = [
  { type: 'evidence', title: 'Acurácia Diagnóstica e Triagem Multidimensional', text: 'No ponto de corte ≥ 10, o GAD-7 possui boa sensibilidade e especificidade para TAG, com validação brasileira.', reference: 'Spitzer RL et al. 2006; Moreno AL et al. 2016.' },
  { type: 'pearl', title: 'Piora inicial com antidepressivos', text: 'Em alguns pacientes pode ocorrer aumento transitório de ansiedade no início do tratamento; orientar e monitorar reduz abandono.' },
  { type: 'pitfall', title: 'Causas orgânicas e estimulantes', text: 'Sintomas ansiosos podem ser influenciados por condições clínicas, estimulantes, cafeína e abstinência; investigar conforme contexto.' },
] as const;

export function isGad7Complete(answers: Gad7Answers): answers is Record<Gad7QuestionId, Gad7AnswerValue> {
  return GAD7_QUESTIONS.every(({ id }) => [0, 1, 2, 3].includes(answers[id] as number));
}

export function calculateGad7(answers: Gad7Answers): Gad7Result {
  if (!isGad7Complete(answers)) throw new Error('GAD-7 incompleto: responda os 7 itens antes do cálculo final.');
  const answersArray = GAD7_QUESTIONS.map(({ id }) => answers[id]);
  const totalScore = answersArray.reduce((total, value) => total + value, 0);
  let classification = '';
  let severity: NexusSeverity = 'low';
  let interpretation = '';
  const recommendations: string[] = [];

  if (totalScore <= 4) {
    classification = 'Ansiedade mínima ou ausente';
    interpretation = 'Sintomas dentro do espectro fisiológico (0-4 pts).';
    recommendations.push('Acompanhamento longitudinal habitual na APS', 'Orientações para manejo do estresse e estilo de vida');
  } else if (totalScore <= 9) {
    classification = 'Ansiedade leve';
    interpretation = 'Sintomas leves (5-9 pts). Benefício com psicoeducação e técnicas de relaxamento.';
    recommendations.push('Técnicas de respiração diafragmática e higiene do sono', 'Acompanhamento periódico na APS');
  } else if (totalScore <= 14) {
    classification = 'Ansiedade moderada';
    severity = 'moderate';
    interpretation = 'Sintomas moderados (10-14 pts, corte ≥ 10 atingido). Indicação de investigação detalhada para TAG.';
    recommendations.push('Avaliar indicação de psicoterapia e/ou farmacoterapia conforme avaliação clínica', 'Pactuar consultas de acompanhamento');
  } else {
    classification = 'Ansiedade grave';
    severity = 'severe';
    interpretation = 'Sintomas graves (15-21 pts) com prejuízo funcional marcante.';
    recommendations.push('Pactuar plano terapêutico estruturado', 'Reavaliação próxima', 'Considerar apoio especializado conforme contexto');
  }

  const soapText = `GAD-7: ${totalScore}/21 pts (${classification}) | Respostas: [${answersArray.join(', ')}] | Fonte: Spitzer et al., 2006 (Validação BR: Moreno, 2016)`;
  return { totalScore, maxScore: 21, classification, severity, interpretation, recommendations, answersArray, soapText };
}
