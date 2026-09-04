import type { NexusSeverity } from '../nexusClinical';

export const NEXUS_MEEM_RULE_VERSION = 'nexus-meem-2026-09-04';

export type MeemEducationBand = 'illiterate' | 'years_1_4' | 'years_5_8' | 'years_9_11' | 'years_12_plus';
export type MeemAnswerMap = Record<string, number>;

export type MeemQuestion = {
  id: string;
  text: string;
  domain: string;
  max: number;
  options: readonly { label: string; value: number }[];
};

export const MEEM_EDUCATION_BANDS: Record<MeemEducationBand, { label: string; cutoff: number }> = {
  illiterate: { label: 'Analfabeto', cutoff: 20 },
  years_1_4: { label: '1 a 4 anos de estudo', cutoff: 25 },
  years_5_8: { label: '5 a 8 anos de estudo', cutoff: 26.5 },
  years_9_11: { label: '9 a 11 anos de estudo', cutoff: 28 },
  years_12_plus: { label: '> 11 anos de estudo / superior', cutoff: 29 },
};

const binary = [{ label: 'Incorreto (0)', value: 0 }, { label: 'Correto (1)', value: 1 }] as const;
const range = (max: number, noun = 'acerto') => Array.from({ length: max + 1 }, (_, value) => ({ label: `${value} ${noun}${value === 1 ? '' : 's'} (${value})`, value }));

export const MEEM_QUESTIONS: readonly MeemQuestion[] = [
  { id: 'q1_ano', text: '1. Orientação Temporal: Em que ano estamos?', domain: 'orientacao_temporal', max: 1, options: binary },
  { id: 'q1_semestre', text: '2. Orientação Temporal: Em que semestre ou estação do ano estamos?', domain: 'orientacao_temporal', max: 1, options: binary },
  { id: 'q1_mes', text: '3. Orientação Temporal: Em que mês estamos?', domain: 'orientacao_temporal', max: 1, options: binary },
  { id: 'q1_diasemana', text: '4. Orientação Temporal: Em que dia da semana estamos hoje?', domain: 'orientacao_temporal', max: 1, options: binary },
  { id: 'q1_diames', text: '5. Orientação Temporal: Em que dia do mês estamos hoje?', domain: 'orientacao_temporal', max: 1, options: binary },
  { id: 'q2_estado', text: '6. Orientação Espacial: Em que estado estamos?', domain: 'orientacao_espacial', max: 1, options: binary },
  { id: 'q2_cidade', text: '7. Orientação Espacial: Em que cidade ou município estamos?', domain: 'orientacao_espacial', max: 1, options: binary },
  { id: 'q2_bairro', text: '8. Orientação Espacial: Em que bairro estamos?', domain: 'orientacao_espacial', max: 1, options: binary },
  { id: 'q2_local', text: '9. Orientação Espacial: Que local é este aqui?', domain: 'orientacao_espacial', max: 1, options: binary },
  { id: 'q2_andar', text: '10. Orientação Espacial: Em que sala ou andar estamos?', domain: 'orientacao_espacial', max: 1, options: binary },
  { id: 'q3_memoria', text: '11. Registro de Memória Imediata: diga “Carro, Vaso, Tijolo”. Quantas repetiu corretamente na primeira tentativa?', domain: 'memoria_imediata', max: 3, options: range(3, 'palavra') },
  { id: 'q4_atencao', text: '12. Atenção e Cálculo: subtrair 7 de 100 sucessivamente ou soletrar MUNDO de trás para frente.', domain: 'atencao_calculo', max: 5, options: range(5) },
  { id: 'q5_evocacao', text: '13. Evocação Tardia: quantas das 3 palavras anteriores recordou?', domain: 'evocacao_tardia', max: 3, options: range(3, 'palavra') },
  { id: 'q6_nomeacao', text: '14. Linguagem — Nomeação: nomear um relógio e uma caneta.', domain: 'linguagem', max: 2, options: range(2) },
  { id: 'q7_repeticao', text: '15. Linguagem — Repetição: repetir “Nem aqui, nem ali, nem lá”.', domain: 'linguagem', max: 1, options: binary },
  { id: 'q8_comando', text: '16. Comando de 3 estágios: pegar o papel, dobrá-lo ao meio e colocá-lo no chão.', domain: 'linguagem', max: 3, options: range(3, 'passo') },
  { id: 'q9_leitura', text: '17. Leitura e Execução: ler “FECHE OS OLHOS” e executar.', domain: 'linguagem', max: 1, options: binary },
  { id: 'q10_frase', text: '18. Redação: escrever uma frase completa, com sujeito, verbo e sentido lógico.', domain: 'linguagem', max: 1, options: binary },
  { id: 'q11_desenho', text: '19. Praxia Construtiva: copiar dois pentágonos intersectados formando quadrilátero na interseção.', domain: 'praxia_construtiva', max: 1, options: binary },
];

export type MeemResult = {
  totalScore: number;
  maxScore: 30;
  classification: string;
  severity: NexusSeverity;
  educationBand: MeemEducationBand;
  educationLabel: string;
  contextualCutoff: number;
  contextualStatus: 'preserved' | 'below_cutoff';
  domainScores: Record<string, { score: number; max: number }>;
  allEducationBands: Record<MeemEducationBand, boolean>;
  interpretation: string;
  recommendations: string[];
  soapText: string;
};

export function isMeemComplete(answers: MeemAnswerMap): boolean {
  return MEEM_QUESTIONS.every((question) => question.options.some((option) => option.value === answers[question.id]));
}

export function calculateMeem(answers: MeemAnswerMap, educationBand: MeemEducationBand): MeemResult {
  if (!isMeemComplete(answers)) throw new Error('MEEM incompleto: pontue todas as tarefas antes de finalizar.');

  const totalScore = MEEM_QUESTIONS.reduce((sum, question) => sum + (answers[question.id] ?? 0), 0);
  const domainScores: Record<string, { score: number; max: number }> = {};
  for (const question of MEEM_QUESTIONS) {
    const current = domainScores[question.domain] ?? { score: 0, max: 0 };
    current.score += answers[question.id] ?? 0;
    current.max += question.max;
    domainScores[question.domain] = current;
  }

  let classification: string;
  let severity: NexusSeverity;
  if (totalScore >= 27) {
    classification = 'Desempenho Cognitivo Preservado na Maioria das Faixas de Escolaridade';
    severity = 'low';
  } else if (totalScore >= 20) {
    classification = 'Desempenho Limítrofe / Dependente do Nível de Escolaridade (Brucki, 2003)';
    severity = 'moderate';
  } else {
    classification = 'Rastreio Sugestivo de Declínio Cognitivo Significativo em Todas as Escolaridades';
    severity = 'severe';
  }

  const allEducationBands = Object.fromEntries(
    Object.entries(MEEM_EDUCATION_BANDS).map(([key, value]) => [key, totalScore >= value.cutoff]),
  ) as Record<MeemEducationBand, boolean>;
  const band = MEEM_EDUCATION_BANDS[educationBand];
  const contextualStatus = totalScore >= band.cutoff ? 'preserved' : 'below_cutoff';

  const interpretation = `MEEM ${totalScore}/30. Classificação executável histórica do Nexus: ${classification}. Contexto informado: ${band.label}; corte de referência ${band.cutoff}; resultado ${contextualStatus === 'preserved' ? 'igual ou acima do corte contextual' : 'abaixo do corte contextual'}. O MEEM é instrumento de rastreio e deve ser correlacionado com funcionalidade e avaliação clínica.`;

  const recommendations = [
    'Correlacionar o resultado com anos formais de estudo e funcionalidade nas atividades de vida diária.',
    'Avaliar ABVD/AIVD e considerar instrumento funcional complementar quando houver suspeita de declínio.',
    'Considerar Teste do Desenho do Relógio e investigação de causas clínicas potencialmente reversíveis conforme contexto.',
    'Rastrear sintomas depressivos quando houver hipótese de comprometimento cognitivo associado ao humor.',
  ];

  const soapText = `MEEM: ${totalScore}/30 pts — ${classification}. Escolaridade: ${band.label}; corte contextual: ${band.cutoff}; ${contextualStatus === 'preserved' ? 'acima/igual ao corte' : 'abaixo do corte'}.`;

  return {
    totalScore,
    maxScore: 30,
    classification,
    severity,
    educationBand,
    educationLabel: band.label,
    contextualCutoff: band.cutoff,
    contextualStatus,
    domainScores,
    allEducationBands,
    interpretation,
    recommendations,
    soapText,
  };
}
