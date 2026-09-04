import type { NexusEvidenceSnapshot, NexusSeverity } from '../nexusClinical';

export const CSSRS_RULE_KEY = 'nexus.cssrs';
export const CSSRS_RULE_VERSION = 'nexus-2026-09-03';
export const CSSRS_REQUIRED_CAPABILITY = 'nexus.scales';

export type CssrsQuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6';
export type CssrsAnswerValue = 0 | 1 | 2 | 3 | 4 | 5;
export type CssrsAnswers = Partial<Record<CssrsQuestionId, CssrsAnswerValue>>;

export type CssrsResult = {
  totalScore: number;
  maxScore: 5;
  classification: string;
  severity: NexusSeverity;
  interpretation: string;
  recommendations: string[];
  answersArray: CssrsAnswerValue[];
  soapText: string;
};

export const CSSRS_QUESTIONS: { id: CssrsQuestionId; text: string; yesValue: Exclude<CssrsAnswerValue, 0> }[] = [
  { id: 'q1', text: '1. Desejo passivo de estar morto(a) (Ex: "Teve pensamentos de que gostaria de dormir e não acordar mais?")', yesValue: 1 },
  { id: 'q2', text: '2. Pensamentos suicidas ativos não específicos (Ex: "Pensou em se matar, mesmo sem ter um método definido?")', yesValue: 2 },
  { id: 'q3', text: '3. Ideação suicida ativa com método em mente (sem plano estruturado nem intenção de agir)', yesValue: 3 },
  { id: 'q4', text: '4. Ideação suicida ativa com alguma intenção de agir (sem plano totalmente elaborado)', yesValue: 4 },
  { id: 'q5', text: '5. Ideação suicida com plano elaborado e intenção específica de agir', yesValue: 5 },
  { id: 'q6', text: '6. Comportamento suicida prévio ou recente (tentativa prévia ao longo da vida ou atos preparatórios nos últimos 3 meses)', yesValue: 5 },
];

export const CSSRS_METADATA = {
  title: 'Avaliação de Risco de Suicídio e Segurança (C-SSRS Adaptada APS)',
  acronym: 'C-SSRS / Suicídio',
  targetGroup: 'Qualquer paciente na APS com ideação, sofrimento psíquico intenso ou comportamento autolesivo',
  description: 'Protocolo padronizado de triagem de ideação e comportamento suicida da Universidade de Columbia, adaptado para a Atenção Primária para estratificação de risco imediata e construção de plano de segurança.',
  shortInstruction: 'Aplique de forma direta, empática e acolhedora, sem emitir julgamentos morais.',
  instructions: 'Pergunte diretamente ao paciente de forma empática e sem tabus. Se a resposta for SIM, investigue o detalhamento de plano, meios e histórico prévio.',
  referenceCitation: 'Posner K, Brown GK, Stanley B, et al. Am J Psychiatry. 2011; 168(12):1266-77. Recomendado pelo Ministério da Saúde e Associação Brasileira de Psiquiatria (ABP).',
  validationInfo: 'Instrumento padrão-ouro global com alta confiabilidade preditiva para comportamento e ideação suicida.',
  cutoffInfo: '0: Sem ideação | 1-2: Risco Baixo | 3: Risco Moderado | 4-5: Risco Alto / Emergência',
  estimatedMinutes: 2,
} as const;

export const CSSRS_EVIDENCE: NexusEvidenceSnapshot[] = [
  {
    evidenceKey: 'cssrs-posner-2011',
    title: 'The Columbia-Suicide Severity Rating Scale: initial validity and internal consistency findings',
    source: 'Posner K, Brown GK, Stanley B, et al. Am J Psychiatry. 2011;168(12):1266-77.',
    year: 2011,
    version: CSSRS_RULE_VERSION,
  },
];

export const CSSRS_CLINICAL_CONDUCT = [
  { title: 'Nível 0 — Sem Ideação Suicida Ativa', description: 'Manter postura de acolhimento e escuta empática. Reforçar fatores protetores pessoais e manter canal aberto para que o paciente procure a UBS caso ocorra agravamento do sofrimento emocional.', badge: 'Nível 0: Sem Risco Imediato' },
  { title: 'Níveis 1 e 2 — Risco Baixo (Desejo Passivo ou Pensamentos Não Específicos)', description: '1. Elaborar o Plano de Segurança Pessoal; 2. Identificar rede de apoio socioafetivo; 3. Fornecer contatos de emergência (CVV 188, UBS, SAMU 192); 4. Agendar retorno em 1 a 2 semanas na APS.', badge: 'Níveis 1-2: Risco Baixo' },
  { title: 'Nível 3 — Risco Moderado (Ideação Ativa com Método, sem Intenção Imediata)', description: '1. Envolver familiar ou pessoa de confiança (com consentimento); 2. Bloquear e remover imediatamente o acesso a meios letais no domicílio (guardar medicamentos sob chave, recolher armas/objetos perfurocortantes); 3. Pactuar contato telefônico ou retorno em 24-48h; 4. Discussão com Apoio Matricial / Saúde Mental.', badge: 'Nível 3: Risco Moderado' },
  { title: 'Níveis 4 a 6 — Risco Alto / Emergência em Saúde Mental', description: '⚠️ NUNCA DEIXAR O PACIENTE SOZINHO. Manter acolhido na unidade com vigilância contínua da equipe. Remover imediatamente quaisquer objetos cortantes ou medicamentos. Acionar familiar responsável e organizar encaminhamento regulado para emergência psiquiátrica (CAPS III, UPA ou Hospital de Referência).', badge: 'Níveis 4-6: Risco Alto / Emergência' },
  { title: 'Construção do Plano de Segurança em 6 Etapas (Stanley & Brown)', description: '1. Reconhecer sinais precoces de crise; 2. Estratégias internas de distração (caminhada, música); 3. Pessoas e ambientes sociais para distração; 4. Familiares para pedir ajuda; 5. Profissionais e serviços de crise; 6. Segurança do ambiente domiciliar.', badge: 'Protocolo de Segurança' },
] as const;

export const CSSRS_MONITORING_GOALS = [
  { title: 'Proteção Imediata e Neutralização de Meios Letais', description: 'Garantir que 100% dos meios letais domiciliares (psicotrópicos estocados, pesticidas, cordas, armas de fogo) estejam sob custódia segura de um familiar ou responsável.' },
  { title: 'Engajamento no Plano de Segurança', description: 'Verificar se o paciente tem cópia física ou digital do Plano de Segurança e se o familiar de referência conhece os números de emergência (188 e 192).' },
  { title: 'Seguimento Estreito na Fase Crítica', description: 'Contatos semanais nas primeiras 4 semanas de tratamento antidepressivo ou pós-alta de internação psiquiátrica (fase de maior vulnerabilidade).' },
] as const;

export const CSSRS_CLINICAL_PEARLS = [
  { type: 'evidence', title: 'Padrão-Ouro Global Recomendado pela ABP e Ministério da Saúde', text: 'O Columbia-Suicide Severity Rating Scale (C-SSRS; Posner et al., Am J Psychiatry, 2011) é o instrumento preditivo padrão-ouro mundial para estratificação do comportamento suicida, reduzindo a sobrecarga nas emergências e identificando precocemente pacientes de risco.', reference: 'Posner K et al. Am J Psychiatry. 2011; 168(12):1266-77.' },
  { type: 'pearl', title: 'Pérola Vital da Atenção Primária: Perguntar NÃO Induz ao Suicídio', text: 'Perguntar clara e diretamente sobre pensamentos de morte ("Você tem pensado em desistir de viver ou se machucar?") NÃO aumenta o risco nem "coloca a ideia na cabeça". Pelo contrário: valida o sofrimento, diminui o isolamento e abre uma janela de acolhimento protetor.' },
  { type: 'pitfall', title: 'Armadilha: Melhora Súbita de Energia no Início do Antidepressivo', text: 'Quando um paciente gravemente deprimido apresenta um aumento rápido e inexplicável de energia logo após iniciar antidepressivos, fique em alerta máximo: o ganho de energia psicomotora pode preceder a melhora do humor e fornecer o impulso necessário para executar um plano suicida.' },
] as const;

export function isCssrsComplete(answers: CssrsAnswers): answers is Record<CssrsQuestionId, CssrsAnswerValue> {
  return CSSRS_QUESTIONS.every(({ id, yesValue }) => answers[id] === 0 || answers[id] === yesValue);
}

export function calculateCssrs(answers: CssrsAnswers): CssrsResult {
  if (!isCssrsComplete(answers)) {
    throw new Error('C-SSRS incompleta: responda os 6 itens antes do cálculo final.');
  }

  const answersArray = CSSRS_QUESTIONS.map(({ id }) => answers[id]);
  const maxVal = Math.max(...answersArray);

  let classification = '';
  let severity: NexusSeverity = 'low';
  let interpretation = '';
  const recommendations: string[] = [];

  if (maxVal === 0) {
    classification = 'Sem ideação suicida ativa identificada na consulta atual';
    severity = 'low';
    interpretation = 'Paciente nega ideação ou pensamentos de autolesão na avaliação atual.';
    recommendations.push('Acompanhamento longitudinal de rotina', 'Manter canal aberto de escuta e acolhimento');
  } else if (maxVal <= 2) {
    classification = 'Risco Baixo de Suicídio';
    severity = 'low';
    interpretation = 'Presença de desejo passivo ou pensamentos não específicos sem plano ou intenção.';
    recommendations.push('Pactuar Plano de Segurança Pessoal e rede de suporte familiar', 'Fornecer contatos de emergência (CVV 188, SAMU 192, UBS de referência)', 'Agendar retorno em curto prazo na APS (1 a 2 semanas)');
  } else if (maxVal <= 3) {
    classification = 'Risco Moderado de Suicídio';
    severity = 'moderate';
    interpretation = 'Ideação ativa com método considerado, porém sem intenção imediata formulada.';
    recommendations.push('Envolver familiar ou pessoa de confiança imediatamente (com consentimento)', 'Restringir acesso a meios letais (medicamentos estocados, armas, objetos perfurocortantes)', 'Pactuar retorno em 24-48h ou contato telefônico com a equipe de APS', 'Discutir caso com Apoio Matricial / Saúde Mental');
  } else {
    classification = 'Risco Alto de Suicídio / Emergência em Saúde Mental';
    severity = 'severe';
    interpretation = 'Ideação com plano elaborado, intenção de agir ou ato preparatório recente. Exige intervenção de segurança imediata!';
    recommendations.push('⚠️ NUNCA deixar o paciente desacompanhado', 'Acolhimento imediato na unidade de saúde com equipe multidisciplinar', 'Remoção e bloqueio imediato de quaisquer meios letais', 'Avaliar necessidade de encaminhamento para emergência psiquiátrica (CAPS III / UPA / Hospital de referência) conforme pactuação da RAPS local');
  }

  const soapText = `C-SSRS (Columbia): ${classification} (Nível ${maxVal}/5) | Fonte: Posner et al., 2011 (Recomendações ABP/MS)`;

  return {
    totalScore: maxVal,
    maxScore: 5,
    classification,
    severity,
    interpretation,
    recommendations,
    answersArray,
    soapText,
  };
}
