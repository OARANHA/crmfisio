import type { NexusScaleDefinition, NexusScaleQuestion, NexusScaleResult } from './scaleRuntime';

const yesNo = [{ label: 'Não', value: 0 }, { label: 'Sim', value: 1 }] as const;
const binary = (id: string, text: string, subscale?: string): NexusScaleQuestion => ({ id, text, subscale, options: yesNo });
const somaticOptions = [{ label: 'Nem um pouco (0)', value: 0 }, { label: 'Incomodou um pouco (1)', value: 1 }, { label: 'Incomodou muito (2)', value: 2 }] as const;
const ybocsOptions = (labels: string[]): { label: string; value: number }[] => labels.map((label, value) => ({ label: `${label} (${value})`, value }));
const RULE_VERSION = 'nexus-2026-09-03';

// -----------------------------------------------------------------------------
// ASRS-18
// -----------------------------------------------------------------------------
const asrsOptions = [
  { label: 'Nunca (0)', value: 0 },
  { label: 'Raramente (0)', value: 0 },
  { label: 'Às vezes (1)', value: 1 },
  { label: 'Frequentemente (1)', value: 1 },
  { label: 'Muito frequentemente (1)', value: 1 },
] as const;

const ASRS18_QUESTIONS: readonly NexusScaleQuestion[] = [
  { id: 'q1', text: '1. Com que frequência você comete erros por falta de atenção quando precisa trabalhar num projeto chato ou difícil?', subscale: 'desatencao', options: asrsOptions },
  { id: 'q2', text: '2. Com que frequência você tem dificuldade para manter a atenção quando está fazendo um trabalho chato ou repetitivo?', subscale: 'desatencao', options: asrsOptions },
  { id: 'q3', text: '3. Com que frequência você tem dificuldade para se concentrar no que as pessoas dizem, mesmo quando estão falando diretamente com você?', subscale: 'desatencao', options: asrsOptions },
  { id: 'q4', text: '4. Com que frequência você tem dificuldade para finalizar os últimos detalhes de um projeto, depois de já ter feito as partes mais difíceis?', subscale: 'desatencao', options: asrsOptions },
  { id: 'q5', text: '5. Com que frequência você tem dificuldade para organizar as coisas quando precisa fazer uma tarefa que exige organização?', subscale: 'desatencao', options: asrsOptions },
  { id: 'q6', text: '6. Quando você tem uma tarefa que exige muito pensamento, com que frequência você evita ou adia o início?', subscale: 'desatencao', options: asrsOptions },
  { id: 'q7', text: '7. Com que frequência você perde ou tem dificuldade para encontrar objetos necessários em casa ou no trabalho?', subscale: 'desatencao', options: asrsOptions },
  { id: 'q8', text: '8. Com que frequência você se distrai com barulhos ou outras coisas que acontecem ao seu redor?', subscale: 'desatencao', options: asrsOptions },
  { id: 'q9', text: '9. Com que frequência você se esquece de compromissos ou obrigações cotidianas?', subscale: 'desatencao', options: asrsOptions },
  { id: 'q10', text: '10. Com que frequência você mexe as mãos ou os pés ou se contorce na cadeira quando precisa ficar sentado(a)?', subscale: 'hiperatividade', options: asrsOptions },
  { id: 'q11', text: '11. Com que frequência você se levanta da cadeira em reuniões ou em outras situações nas quais deveria ficar sentado(a)?', subscale: 'hiperatividade', options: asrsOptions },
  { id: 'q12', text: '12. Com que frequência você se sente inquieto(a) ou agitado(a) por dentro?', subscale: 'hiperatividade', options: asrsOptions },
  { id: 'q13', text: '13. Com que frequência você tem dificuldade para relaxar e praticar atividades de lazer calmamente?', subscale: 'hiperatividade', options: asrsOptions },
  { id: 'q14', text: '14. Com que frequência você se sente "a todo vapor" ou dirigido(a) por um motor?', subscale: 'hiperatividade', options: asrsOptions },
  { id: 'q15', text: '15. Com que frequência você se pega falando demais em conversas?', subscale: 'hiperatividade', options: asrsOptions },
  { id: 'q16', text: '16. Quando está conversando, com que frequência você termina as frases das pessoas antes delas?', subscale: 'hiperatividade', options: asrsOptions },
  { id: 'q17', text: '17. Com que frequência você tem dificuldade para esperar sua vez em situações nas quais há fila ou espera?', subscale: 'hiperatividade', options: asrsOptions },
  { id: 'q18', text: '18. Com que frequência você interrompe os outros quando eles estão ocupados?', subscale: 'hiperatividade', options: asrsOptions },
];

function calculateAsrs18(answers: Record<string, number>): NexusScaleResult {
  const inattention = Array.from({ length: 9 }, (_, i) => answers[`q${i + 1}`] ?? 0).reduce((a, b) => a + b, 0);
  const hyperactivity = Array.from({ length: 9 }, (_, i) => answers[`q${i + 10}`] ?? 0).reduce((a, b) => a + b, 0);
  const totalScore = inattention + hyperactivity;
  let classification: string;
  let severity: NexusScaleResult['severity'];
  let interpretation: string;
  let recommendations: string[];
  if (inattention >= 4 && hyperactivity >= 4) {
    classification = 'Rastreio Altamente Sugestivo para TDAH em Adultos (Apresentação Combinada/Mista)'; severity = 'high';
    interpretation = `Corte OMS atingido em ambos os domínios: Desatenção (${inattention}/9 itens positivos) e Hiperatividade/Impulsividade (${hyperactivity}/9 itens positivos).`;
    recommendations = ['Investigar história do desenvolvimento na infância e adolescência (critério retrospectivo DSM-5)', 'Investigar prejuízos funcionais em múltiplos contextos (trabalho, estudos, relacionamentos afetivos)', 'Descartar comorbidades ou diagnósticos diferenciais (Depressão, TAG, Transtorno Bipolar, Apneia do Sono)', 'Discutir caso em Apoio Matricial em Saúde Mental'];
  } else if (inattention >= 4) {
    classification = 'Rastreio Sugestivo para TDAH em Adultos (Predomínio Desatento)'; severity = 'moderate';
    interpretation = `Corte OMS atingido para a dimensão de Desatenção (${inattention}/9 itens positivos). Hiperatividade: ${hyperactivity}/9.`;
    recommendations = ['Avaliação clínica detalhada de estratégias de organização, rotina e foco', 'Acompanhamento longitudinal na APS'];
  } else if (hyperactivity >= 4) {
    classification = 'Rastreio Sugestivo para TDAH em Adultos (Predomínio Hiperativo/Impulsivo)'; severity = 'moderate';
    interpretation = `Corte OMS atingido para a dimensão de Hiperatividade/Impulsividade (${hyperactivity}/9 itens positivos). Desatenção: ${inattention}/9.`;
    recommendations = ['Investigar impulsividade financeira e comportamental e controle inibitório', 'Acompanhamento longitudinal'];
  } else {
    classification = 'Rastreio Negativo para TDAH em Adultos'; severity = 'low';
    interpretation = 'Pontuação abaixo da linha de corte (menos de 4 pontos positivos em cada domínio).';
    recommendations = ['Investigar causas secundárias de queixa de desatenção (sobrecarga de trabalho, privação crônica de sono, estresse, ansiedade)'];
  }
  return { totalScore, maxScore: 18, classification, severity, interpretation, recommendations, answersArray: ASRS18_QUESTIONS.map((q) => answers[q.id] ?? 0), structuredData: { inattention, hyperactivity }, soapText: `ASRS-18 v1.1 (OMS): Desatenção ${inattention}/9 positivos | Hiperatividade ${hyperactivity}/9 positivos (${classification}) | Fonte: Kessler et al., 2005 (Validação BR: Mattos et al., 2006)` };
}

export const ASRS18_DEFINITION: NexusScaleDefinition = {
  toolKey: 'asrs-18', moduleKey: 'mental-health', ruleKey: 'nexus.asrs18', ruleVersion: RULE_VERSION, requiredCapability: 'nexus.scales',
  title: 'ASRS-18 (Adult ADHD Self-Report Scale v1.1)', acronym: 'ASRS-18', targetGroup: 'Adultos na APS com suspeita de Transtorno do Déficit de Atenção com Hiperatividade (TDAH)',
  description: 'Instrumento oficial da OMS para rastreamento de sintomas de desatenção e hiperatividade/impulsividade em adultos.', instructions: 'Para cada pergunta abaixo, selecione a resposta que melhor descreve como você se sentiu e se comportou nos últimos 6 meses.',
  referenceCitation: 'Kessler RC, Adler L, Ames M, et al. Psychol Med. 2005;35(2):245-56. Validação brasileira: Mattos P et al. Rev Psiquiatr Clín. 2006;33(4):188-94.', validationInfo: 'Versão brasileira oficial da OMS. Ponto de corte: ≥4 respostas positivas em Desatenção e/ou Hiperatividade/Impulsividade.', cutoffInfo: 'Desatenção: ≥4/9 | Hiperatividade: ≥4/9', estimatedMinutes: 4, questions: ASRS18_QUESTIONS,
  evidence: [{ evidenceKey: 'asrs-kessler-2005', title: 'ASRS v1.1', source: 'Kessler RC et al. Psychol Med. 2005;35(2):245-56.', year: 2005, version: RULE_VERSION }, { evidenceKey: 'asrs-brazil-mattos-2006', title: 'Validação brasileira ASRS-18', source: 'Mattos P et al. Rev Psiquiatr Clín. 2006;33(4):188-94.', year: 2006, version: RULE_VERSION }],
  clinicalConduct: [
    { title: 'Investigação retrospectiva na infância', description: 'Comprovar sintomas antes dos 12 anos, com história do desenvolvimento e informantes quando possível.', badge: 'DSM-5', tone: 'warning' },
    { title: 'Prejuízo em múltiplos contextos', description: 'Verificar impacto funcional persistente em pelo menos dois ambientes da vida adulta.', badge: 'Funcionalidade', tone: 'warning' },
    { title: 'Diagnósticos diferenciais', description: 'Descartar privação de sono, apneia, depressão, TAG, bipolaridade e uso de substâncias.' },
    { title: 'Plano terapêutico integrado', description: 'Psicoeducação, estratégias cognitivo-comportamentais e farmacoterapia quando clinicamente indicada.' },
    { title: '⚠️ Segurança cardiovascular', description: 'Antes de psicoestimulantes, avaliar pressão arterial, frequência cardíaca e história cardiovascular conforme protocolo clínico.', badge: 'Segurança', tone: 'danger' },
  ],
  monitoringGoals: [{ title: 'Função executiva', description: 'Monitorar conclusão de tarefas, erros por distração, pontualidade e gestão do tempo.' }, { title: 'Efeitos adversos', description: 'Monitorar PA, FC, peso, sono, apetite e demais efeitos do tratamento.' }, { title: 'Uso seguro', description: 'Monitorar uso indevido/desvio quando houver medicação controlada.' }],
  clinicalPearls: [{ type: 'evidence', title: 'Validação OMS/Brasil', text: 'ASRS v1.1 desenvolvido com OMS/Harvard e validado no Brasil.', reference: 'Kessler et al. 2005; Mattos et al. 2006.' }, { type: 'pearl', title: 'Hiperatividade no adulto', text: 'Pode aparecer mais como inquietação interna, impaciência e multitarefa do que hiperatividade motora infantil.' }, { type: 'pitfall', title: 'Início recente', text: 'Queixa de desatenção iniciada apenas na vida adulta exige investigação de causas diferenciais antes de atribuir TDAH.' }], calculate: calculateAsrs18,
};

// -----------------------------------------------------------------------------
// Y-BOCS
// -----------------------------------------------------------------------------
const YBOCS_QUESTIONS: readonly NexusScaleQuestion[] = [
  { id: 'q1', text: '1. Tempo ocupado por pensamentos obsessivos por dia', subscale: 'obsessoes', options: ybocsOptions(['Nenhum','Menos de 1h/dia','1h a 3h/dia','3h a 8h/dia','Mais de 8h/dia']) },
  { id: 'q2', text: '2. Interferência das obsessões nas atividades sociais ou ocupacionais', subscale: 'obsessoes', options: ybocsOptions(['Nenhuma','Leve','Moderada','Grave','Extrema / Incapacitante']) },
  { id: 'q3', text: '3. Sofrimento/angústia causado pelas obsessões', subscale: 'obsessoes', options: ybocsOptions(['Nenhum','Pouco / Leve','Moderado','Grave','Insuportável']) },
  { id: 'q4', text: '4. Resistência contra as obsessões (tentativa de ignorar ou afastar)', subscale: 'obsessoes', options: ybocsOptions(['Sempre tenta resistir','Muitas vezes resiste','Alguma resistência','Raramente resiste','Entrega-se completamente']) },
  { id: 'q5', text: '5. Grau de controle sobre os pensamentos obsessivos', subscale: 'obsessoes', options: ybocsOptions(['Controle total','Muito controle','Controle moderado','Pouco controle','Nenhum controle']) },
  { id: 'q6', text: '6. Tempo gasto executando comportamentos compulsivos ou rituais por dia', subscale: 'compulsoes', options: ybocsOptions(['Nenhum','Menos de 1h/dia','1h a 3h/dia','3h a 8h/dia','Mais de 8h/dia']) },
  { id: 'q7', text: '7. Interferência das compulsões na rotina diária e atividades', subscale: 'compulsoes', options: ybocsOptions(['Nenhuma','Leve','Moderada','Grave','Incapacitante']) },
  { id: 'q8', text: '8. Ansiedade gerada caso as compulsões sejam impedidas de serem realizadas', subscale: 'compulsoes', options: ybocsOptions(['Nenhuma ansiedade','Ansiedade leve','Ansiedade moderada','Ansiedade grave','Ansiedade extrema / pânico']) },
  { id: 'q9', text: '9. Resistência contra a realização dos rituais compulsivos', subscale: 'compulsoes', options: ybocsOptions(['Tenta resistir sempre','Resiste na maioria das vezes','Tenta resistir às vezes','Raramente resiste','Rende-se totalmente']) },
  { id: 'q10', text: '10. Grau de controle sobre os comportamentos compulsivos', subscale: 'compulsoes', options: ybocsOptions(['Controle total','Muito controle','Controle moderado','Pouco controle','Nenhum controle']) },
];
function calculateYbocs(answers: Record<string, number>): NexusScaleResult {
  const obsessions = [1,2,3,4,5].reduce((s, i) => s + (answers[`q${i}`] ?? 0), 0);
  const compulsions = [6,7,8,9,10].reduce((s, i) => s + (answers[`q${i}`] ?? 0), 0);
  const totalScore = obsessions + compulsions;
  let classification: string; let severity: NexusScaleResult['severity']; let interpretation: string; let recommendations: string[];
  if (totalScore <= 7) { classification = 'Sintomas subclínicos ou mínimos de TOC'; severity = 'low'; interpretation = `Escore de ${totalScore}/40 pontos (Obsessões: ${obsessions}/20, Compulsões: ${compulsions}/20). Sintomas sem prejuízo funcional marcante.`; recommendations = ['Acompanhamento longitudinal de rotina na APS']; }
  else if (totalScore <= 15) { classification = 'TOC de intensidade leve'; severity = 'low'; interpretation = `Escore de ${totalScore}/40 pontos. Obsessões: ${obsessions}/20, Compulsões: ${compulsions}/20. Impacto diário leve.`; recommendations = ['Considerar Terapia Cognitivo-Comportamental com Exposição e Prevenção de Resposta (EPR)', 'Acompanhamento na APS']; }
  else if (totalScore <= 23) { classification = 'TOC de intensidade moderada'; severity = 'moderate'; interpretation = `Escore de ${totalScore}/40 pontos. Obsessões: ${obsessions}/20, Compulsões: ${compulsions}/20. Prejuízo funcional significativo no cotidiano.`; recommendations = ['Indicação de ISRS em doses elevadas e/ou TCC focada em TOC', 'Acompanhamento quinzenal']; }
  else if (totalScore <= 31) { classification = 'TOC de intensidade grave'; severity = 'high'; interpretation = `Escore de ${totalScore}/40 pontos. Obsessões: ${obsessions}/20, Compulsões: ${compulsions}/20. Sintomas acentuados e interferência marcante na vida pessoal e familiar.`; recommendations = ['Tratamento combinado (Farmacoterapia otimizada + TCC/EPR)', 'Discutir caso com Apoio Matricial em Psiquiatria']; }
  else { classification = 'TOC extremamente grave / incapacitante'; severity = 'severe'; interpretation = `Escore de ${totalScore}/40 pontos. Obsessões: ${obsessions}/20, Compulsões: ${compulsions}/20. Incapacidade quase total para atividades cotidianas.`; recommendations = ['Apoio Matricial urgente e considerar encaminhamento para CAPS / Ambulatório Especializado de TOC']; }
  return { totalScore, maxScore: 40, classification, severity, interpretation, recommendations, answersArray: YBOCS_QUESTIONS.map((q) => answers[q.id] ?? 0), structuredData: { obsessions, compulsions }, soapText: `Y-BOCS: ${totalScore}/40 pts (${classification}) [Obsessões: ${obsessions}/20 | Compulsões: ${compulsions}/20] | Fonte: Goodman et al., 1989 (Validação BR: Cordioli, 1998)` };
}
export const YBOCS_DEFINITION: NexusScaleDefinition = {
  toolKey: 'ybocs', moduleKey: 'mental-health', ruleKey: 'nexus.ybocs', ruleVersion: RULE_VERSION, requiredCapability: 'nexus.scales', title: 'Y-BOCS (Yale-Brown Obsessive Compulsive Scale)', acronym: 'Y-BOCS', targetGroup: 'Pacientes na APS com queixas de pensamentos obsessivos intrusivos ou rituais compulsivos', description: 'Escala clínica padrão-ouro para mensuração da gravidade dos sintomas do Transtorno Obsessivo-Compulsivo (TOC).', instructions: 'Classifique tempo ocupado, interferência, angústia, resistência e controle de obsessões e compulsões na última semana.', referenceCitation: 'Goodman WK et al. Arch Gen Psychiatry. 1989;46(11):1006-11. Versão brasileira validada: Cordioli AV et al. (1998).', validationInfo: 'Padrão-ouro internacional e brasileiro para gravidade do TOC. 10 itens, 0 a 40 pontos.', cutoffInfo: '0-7: Subclínico | 8-15: Leve | 16-23: Moderado | 24-31: Grave | 32-40: Extremo', estimatedMinutes: 4, questions: YBOCS_QUESTIONS,
  evidence: [{ evidenceKey: 'ybocs-goodman-1989', title: 'Y-BOCS', source: 'Goodman WK et al. Arch Gen Psychiatry. 1989;46(11):1006-11.', year: 1989, version: RULE_VERSION }, { evidenceKey: 'ybocs-brazil-cordioli-1998', title: 'Validação brasileira Y-BOCS', source: 'Cordioli AV et al. 1998.', version: RULE_VERSION }],
  clinicalConduct: [{ title: '0-7 — Subclínico', description: 'Psicoeducação e seguimento na APS.' }, { title: '8-15 — Leve', description: 'TCC com Exposição e Prevenção de Resposta (EPR) é tratamento de primeira linha.' }, { title: '16-23 — Moderado', description: 'Tratamento combinado TCC/EPR e farmacoterapia conforme avaliação clínica.', badge: '16-23', tone: 'warning' }, { title: '24-31 — Grave', description: 'Otimizar tratamento e discutir apoio especializado.', badge: '24-31', tone: 'danger' }, { title: '32-40 — Extremo', description: 'Articular cuidado especializado e suporte psicossocial.', badge: '32-40', tone: 'danger' }, { title: 'Acomodação familiar', description: 'Orientar familiares a não reforçar rituais de checagem/reasseguramento.', tone: 'warning' }],
  monitoringGoals: [{ title: 'Resposta clínica', description: 'Redução ≥25% a 35% na Y-BOCS após tratamento adequado.' }, { title: 'Remissão funcional', description: 'Meta de Y-BOCS ≤12 com restauração do funcionamento.' }, { title: 'Manutenção', description: 'Manter estratégias terapêuticas e monitorar recaída no longo prazo.' }],
  clinicalPearls: [{ type: 'evidence', title: 'Padrão-ouro', text: 'Y-BOCS é referência universal para mensuração de gravidade do TOC.', reference: 'Goodman et al. 1989; Cordioli et al. 1998.' }, { type: 'pearl', title: 'Latência terapêutica', text: 'TOC pode exigir doses terapêuticas altas de ISRS e maior tempo de latência clínica.' }, { type: 'pitfall', title: 'Diferencial fenomenológico', text: 'Diferenciar obsessões egodistônicas de ideias delirantes e traços egossintônicos de personalidade.' }], calculate: calculateYbocs,
};

// -----------------------------------------------------------------------------
// EPDS
// -----------------------------------------------------------------------------
const EPDS_QUESTIONS: readonly NexusScaleQuestion[] = [
  { id: 'q1', text: '1. Eu tenho sido capaz de rir e ver o lado engraçado das coisas:', options: [{ label: 'Tanto quanto antes', value: 0 }, { label: 'Não tanto quanto antes', value: 1 }, { label: 'Definitivamente menos', value: 2 }, { label: 'De jeito nenhum', value: 3 }] },
  { id: 'q2', text: '2. Eu tenho olhado o futuro com entusiasmo e esperança:', options: [{ label: 'Tanto quanto antes', value: 0 }, { label: 'Um pouco menos do que antes', value: 1 }, { label: 'Definitivamente menos', value: 2 }, { label: 'Quase nunca', value: 3 }] },
  { id: 'q3', text: '3. Eu tenho me culpado sem necessidade quando as coisas dão errado:', options: [{ label: 'Não, nunca', value: 0 }, { label: 'Poucas vezes', value: 1 }, { label: 'Sim, algumas vezes', value: 2 }, { label: 'Sim, a maior parte do tempo', value: 3 }] },
  { id: 'q4', text: '4. Eu tenho ficado ansiosa ou preocupada sem motivo aparente:', options: [{ label: 'Não, de jeito nenhum', value: 0 }, { label: 'Quase nunca', value: 1 }, { label: 'Sim, algumas vezes', value: 2 }, { label: 'Sim, muito frequentemente', value: 3 }] },
  { id: 'q5', text: '5. Eu tenho me sentido com medo ou em pânico sem motivo:', options: [{ label: 'Não, de jeito nenhum', value: 0 }, { label: 'Quase nunca', value: 1 }, { label: 'Sim, algumas vezes', value: 2 }, { label: 'Sim, muito frequentemente', value: 3 }] },
  { id: 'q6', text: '6. Eu tenho me sentido sobrecarregada, sentindo que não dou conta de tudo:', options: [{ label: 'Não, tenho lidado bem', value: 0 }, { label: 'A maior parte do tempo tenho lidado bem', value: 1 }, { label: 'Sim, algumas vezes não tenho conseguido lidar', value: 2 }, { label: 'Sim, na maior parte do tempo não consigo lidar', value: 3 }] },
  { id: 'q7', text: '7. Eu tenho me sentido tão infeliz que tenho tido dificuldade para dormir:', options: [{ label: 'Não, de jeito nenhum', value: 0 }, { label: 'Não com frequência', value: 1 }, { label: 'Sim, algumas vezes', value: 2 }, { label: 'Sim, a maior parte do tempo', value: 3 }] },
  { id: 'q8', text: '8. Eu tenho me sentido triste ou desanimada:', options: [{ label: 'Não, de jeito nenhum', value: 0 }, { label: 'Poucas vezes', value: 1 }, { label: 'Sim, muitas vezes', value: 2 }, { label: 'Sim, a maior parte do tempo', value: 3 }] },
  { id: 'q9', text: '9. Eu tenho me sentido tão infeliz que tenho chorado:', options: [{ label: 'Não, nunca', value: 0 }, { label: 'Só de vez em quando', value: 1 }, { label: 'Sim, com frequência', value: 2 }, { label: 'Sim, a maior parte do tempo', value: 3 }] },
  { id: 'q10', text: '10. O pensamento de fazer mal a mim mesma ocorreu-me:', options: [{ label: 'Nunca', value: 0 }, { label: 'Dificilmente', value: 1 }, { label: 'Algumas vezes', value: 2 }, { label: 'Sim, muitas vezes', value: 3 }] },
];
function calculateEpds(answers: Record<string, number>): NexusScaleResult {
  const answersArray = EPDS_QUESTIONS.map((q) => answers[q.id] ?? 0); const totalScore = answersArray.reduce((a,b) => a+b,0); const item10 = answers.q10 ?? 0;
  let classification: string; let severity: NexusScaleResult['severity'];
  if (totalScore < 10) { classification = 'Sintomas improváveis de depressão puerperal'; severity = 'low'; }
  else if (totalScore < 12) { classification = 'Possibilidade de depressão puerperal (Reavaliação indicada)'; severity = 'moderate'; }
  else { classification = 'Forte suspeita de episódio depressivo puerperal'; severity = 'high'; }
  if (item10 > 0) { classification += ' | ⚠️ ALERTA: Resposta positiva para ideação de autoagressão (Item 10)'; severity = 'severe'; }
  return { totalScore, maxScore: 30, classification, severity, interpretation: `Escore de ${totalScore}/30 pontos na EPDS. ${item10 > 0 ? 'ATENÇÃO: Resposta positiva no item 10 referente a autoagressão requer avaliação médica presencial imediata.' : ''}`, recommendations: [totalScore >= 10 ? 'Avaliação clínica médica aprofundada da puérpera' : 'Reforço do suporte de puericultura e acolhimento na APS', 'Avaliar vínculo mãe-bebê, rede de apoio familiar e amamentação', ...(item10 > 0 ? ['Realizar avaliação direta de risco de suicídio / segurança'] : [])], answersArray, structuredData: { item10 }, redFlags: item10 > 0 ? [{ flagCode: 'epds.item10.self-harm', severity: 'critical', title: 'EPDS — item 10 positivo para autoagressão', message: 'Resposta positiva no item 10 da EPDS referente a pensamento de autoagressão.', requiredAction: 'Realizar avaliação direta de segurança e risco de suicídio imediatamente.' }] : [], soapText: `EPDS: ${totalScore}/30 pts (${classification}) | Item 10 (Autoagressão): ${item10} pts | Itens: [${answersArray.join(', ')}]` };
}
export const EPDS_DEFINITION: NexusScaleDefinition = { toolKey: 'epds', moduleKey: 'mental-health', ruleKey: 'nexus.epds', ruleVersion: RULE_VERSION, requiredCapability: 'nexus.scales', title: 'EPDS (Escala de Depressão Pós-Parto de Edimburgo)', acronym: 'EPDS', targetGroup: 'Gestantes e puérperas na Atenção Primária à Saúde', description: 'Instrumento autoaplicável de 10 itens para rastreamento de sintomas depressivos no ciclo gravídico-puerperal.', instructions: 'Escolha a resposta que melhor descreve como você tem se sentido nos últimos 7 dias, não apenas hoje.', referenceCitation: 'Cox JL, Holden JM, Sagovsky R. Br J Psychiatry. 1987;150:782-6. Validação brasileira: Santos IS et al. Cad Saude Publica. 2007.', validationInfo: 'Validada no Brasil na APS. Ponto de corte ≥10 para rastreamento.', cutoffInfo: '0-9: improvável | 10-11: possibilidade | ≥12: forte suspeita | item 10 positivo: alerta de autoagressão', estimatedMinutes: 3, questions: EPDS_QUESTIONS, evidence: [{ evidenceKey: 'epds-cox-1987', title: 'EPDS', source: 'Cox JL et al. Br J Psychiatry. 1987;150:782-6.', year: 1987, version: RULE_VERSION }, { evidenceKey: 'epds-brazil-santos-2007', title: 'Validação brasileira EPDS', source: 'Santos IS et al. Cad Saude Publica. 2007.', year: 2007, version: RULE_VERSION }], clinicalConduct: [{ title: 'Apoio ao binômio mãe-bebê', description: 'Investigar sobrecarga, privação de sono e apoio do parceiro/família.' }, { title: 'Item 10 positivo', description: 'Priorizar avaliação de segurança; risco supera qualquer recomendação educativa.', badge: 'segurança', tone: 'danger' }], monitoringGoals: [], clinicalPearls: [], calculate: calculateEpds };

// -----------------------------------------------------------------------------
// SRQ-20
// -----------------------------------------------------------------------------
const SRQ20_TEXTS = [
  'Você tem dores de cabeça frequentes?', 'Tem falta de apetite?', 'Dorme mal?', 'Assusta-se com facilidade?', 'Tem tremores nas mãos?', 'Sente-se nervoso(a), tenso(a) ou preocupado(a)?', 'Tem má digestão?', 'Tem dificuldade de pensar com clareza?', 'Tem se sentido triste ultimamente?', 'Tem chorado mais do que de costume?', 'Encontra dificuldades para realizar com prazer suas atividades diárias?', 'Tem dificuldades para tomar decisões?', 'É difícil para você realizar o trabalho com prazer?', 'É incapaz de desempenhar um papel útil em sua vida?', 'Tem perdido o interesse pelas coisas?', 'Sente-se uma pessoa inútil, sem valor?', 'Tem tido a ideia de acabar com a própria vida?', 'Sente-se cansado(a) o tempo todo?', 'Tem sensações desagradáveis no estômago?', 'Você se cansa com facilidade?'
];
const SRQ20_QUESTIONS = SRQ20_TEXTS.map((text, index) => binary(`q${index + 1}`, `${index + 1}. ${text}`));
function calculateSrq20(answers: Record<string, number>): NexusScaleResult {
  const answersArray = SRQ20_QUESTIONS.map((q) => answers[q.id] ?? 0); const totalScore = answersArray.reduce((a,b) => a+b,0); const isPositive = totalScore >= 7; const item17 = answers.q17 ?? 0;
  let classification = isPositive ? 'SRQ-20 Positivo (Suspeita de Transtorno Mental Comum)' : 'SRQ-20 Negativo (Sem sofrimento psíquico evidente)'; let severity: NexusScaleResult['severity'] = isPositive ? 'moderate' : 'low';
  if (item17 > 0) { classification += ' | ⚠️ ALERTA: Resposta positiva para ideação de morte (Item 17)'; severity = 'severe'; }
  return { totalScore, maxScore: 20, classification, severity, interpretation: `Escore de ${totalScore}/20 no SRQ-20. ${isPositive ? 'Rastreio positivo sugerindo sofrimento psíquico relevante (TMC).' : 'Rastreio negativo.'} ${item17 > 0 ? 'ATENÇÃO: Item 17 afirmativo exige acolhimento e avaliação direta de segurança.' : ''}`, recommendations: [isPositive ? 'Consulta clínica e escuta qualificada na APS' : 'Ações preventivas e promoção de saúde mental', 'Explorar fatores psicossociais e rede de apoio'], answersArray, structuredData: { item17 }, redFlags: item17 > 0 ? [{ flagCode: 'srq20.item17.death-ideation', severity: 'critical', title: 'SRQ-20 — ideação de morte', message: 'Resposta afirmativa ao item 17 do SRQ-20.', requiredAction: 'Acolher e realizar avaliação direta de segurança/risco de suicídio.' }] : [], soapText: `SRQ-20: ${totalScore}/20 pts (${classification}) | Item 17: ${item17} | Itens: [${answersArray.join(', ')}]` };
}
export const SRQ20_DEFINITION: NexusScaleDefinition = { toolKey: 'srq-20', moduleKey: 'mental-health', ruleKey: 'nexus.srq20', ruleVersion: RULE_VERSION, requiredCapability: 'nexus.scales', title: 'SRQ-20 (Self-Reporting Questionnaire - Rastreio de Transtornos Mentais Comuns)', acronym: 'SRQ-20', targetGroup: 'População geral na Atenção Primária à Saúde para rastreio de TMC', description: 'Instrumento recomendado pela OMS para triagem de transtornos mentais comuns.', instructions: 'Para cada questão, assinale Sim se esteve presente nos últimos 30 dias, ou Não.', referenceCitation: 'Harding TW et al. Psychol Med. 1980;10(2):231-41. Validação brasileira: Mari JJ, Williams P. 1986.', validationInfo: 'Instrumento de rastreio de sofrimento psíquico na APS.', cutoffInfo: 'Implementação Nexus: corte ≥7 | item 17 positivo: alerta de segurança', estimatedMinutes: 3, questions: SRQ20_QUESTIONS, evidence: [{ evidenceKey: 'srq20-harding-1980', title: 'SRQ', source: 'Harding TW et al. Psychol Med. 1980;10(2):231-41.', year: 1980, version: RULE_VERSION }, { evidenceKey: 'srq20-brazil-mari-1986', title: 'Validação brasileira SRQ', source: 'Mari JJ, Williams P. 1986.', year: 1986, version: RULE_VERSION }], clinicalConduct: [{ title: 'Acolhimento na APS', description: 'Investigar determinantes sociais, estressores e rede de apoio.' }, { title: 'Item 17 positivo', description: 'Avaliar segurança imediatamente.', tone: 'danger' }], monitoringGoals: [], clinicalPearls: [], calculate: calculateSrq20 };

// -----------------------------------------------------------------------------
// PHQ-15
// -----------------------------------------------------------------------------
const PHQ15_TEXTS = ['Dores de estômago ou abdominais','Dor nas costas ou coluna','Dor nos braços, pernas ou articulações','Dores ou cólicas menstruais (ou outros problemas no período)','Dores de cabeça','Dor no peito ou aperto precordial','Tonturas ou instabilidade','Desmaios ou sensação de apagar','Coração batendo rápido ou acelerado (palpitações)','Falta de ar ou respiração curta','Dor ou desconforto durante a relação sexual','Prisão de ventre ou intestino solto (diarreia)','Náuseas, indigestão ou empachamento','Sentir-se cansado(a) ou com pouca energia','Problemas para dormir'];
const PHQ15_QUESTIONS: readonly NexusScaleQuestion[] = PHQ15_TEXTS.map((text, index) => ({ id: `q${index + 1}`, text: `${index + 1}. ${text}`, options: somaticOptions }));
function calculatePhq15(answers: Record<string, number>): NexusScaleResult {
  const answersArray = PHQ15_QUESTIONS.map((q) => answers[q.id] ?? 0); const totalScore = answersArray.reduce((a,b) => a+b,0); let classification: string; let severity: NexusScaleResult['severity'];
  if (totalScore <= 4) { classification = 'Gravidade somática mínima'; severity = 'low'; } else if (totalScore <= 9) { classification = 'Gravidade somática baixa'; severity = 'low'; } else if (totalScore <= 14) { classification = 'Gravidade somática média'; severity = 'moderate'; } else { classification = 'Gravidade somática alta'; severity = 'high'; }
  return { totalScore, maxScore: 30, classification, severity, interpretation: `Escore de ${totalScore}/30 pontos no PHQ-15 (${classification}).`, recommendations: ['Acolher queixas físicas com abordagem integral na APS', 'Evitar cascata propedêutica de exames repetitivos', 'Investigar comorbidades com transtornos depressivos ou ansiosos'], answersArray, soapText: `PHQ-15: ${totalScore}/30 pts (${classification}) | Itens: [${answersArray.join(', ')}]` };
}
export const PHQ15_DEFINITION: NexusScaleDefinition = { toolKey: 'phq-15', moduleKey: 'mental-health', ruleKey: 'nexus.phq15', ruleVersion: RULE_VERSION, requiredCapability: 'nexus.scales', title: 'PHQ-15 (Módulo de Sintomas Somáticos do PHQ)', acronym: 'PHQ-15', targetGroup: 'Adultos na APS com sintomas físicos múltiplos ou queixas somáticas recorrentes', description: 'Instrumento de 15 itens que avalia gravidade e impacto de sintomas somáticos comuns nas últimas quatro semanas.', instructions: 'Selecione para cada sintoma o quanto você foi incomodado(a) nas últimas 4 semanas.', referenceCitation: 'Kroenke K, Spitzer RL, Williams JB. Psychosom Med. 2002;64(2):258-66.', validationInfo: 'Sensibilidade de 78% e especificidade de 71% para transtorno de sintomas somáticos (corte ≥10), conforme metadata Nexus.', cutoffInfo: '0-4: mínima | 5-9: baixa | 10-14: média | 15-30: alta', estimatedMinutes: 3, questions: PHQ15_QUESTIONS, evidence: [{ evidenceKey: 'phq15-kroenke-2002', title: 'PHQ-15', source: 'Kroenke K, Spitzer RL, Williams JB. Psychosom Med. 2002;64(2):258-66.', year: 2002, version: RULE_VERSION }], clinicalConduct: [{ title: 'Abordagem Centrada na Pessoa', description: 'Validação do sofrimento somático sem reforçar hipermedicalização.' }], monitoringGoals: [], clinicalPearls: [], calculate: calculatePhq15 };
