import type { NexusScaleDefinition, NexusScaleQuestion, NexusScaleResult } from './scaleRuntime';

const yesNo = [{ label: 'Não', value: 0 }, { label: 'Sim', value: 1 }] as const;
const severity5 = [
  { label: 'Nada (0)', value: 0 },
  { label: 'Pouco (1)', value: 1 },
  { label: 'Moderado (2)', value: 2 },
  { label: 'Muito (3)', value: 3 },
  { label: 'Extremamente (4)', value: 4 },
] as const;
const hamilton5 = [
  { label: 'Ausente (0)', value: 0 },
  { label: 'Leve (1)', value: 1 },
  { label: 'Moderado (2)', value: 2 },
  { label: 'Grave (3)', value: 3 },
  { label: 'Muito Grave (4)', value: 4 },
] as const;
const snap4 = [
  { label: 'Nem um pouco (0)', value: 0 },
  { label: 'Só um pouco (1)', value: 1 },
  { label: 'Bastante (2)', value: 2 },
  { label: 'Demais (3)', value: 3 },
] as const;

const sum = (answers: Record<string, number>, ids: string[]) => ids.reduce((acc, id) => acc + (answers[id] ?? 0), 0);

const SNAP_QUESTIONS: readonly NexusScaleQuestion[] = [
  'Não consegue prestar muita atenção a detalhes ou comete erros por descuido nos trabalhos escolares ou tarefas.',
  'Tem dificuldade para manter a atenção em tarefas ou jogos.',
  'Parece não escutar quando se fala diretamente com ela.',
  'Não segue instruções até o fim e não termina deveres escolares, tarefas domésticas ou deveres.',
  'Tem dificuldade para organizar tarefas e atividades.',
  'Evita, não gosta ou reluta em tarefas que exigem esforço mental constante.',
  'Perde coisas necessárias para tarefas ou atividades.',
  'É facilmente distraído(a) por estímulos externos.',
  'É esquecido(a) em atividades do dia a dia.',
  'Mexe com as mãos ou os pés ou se remexe na cadeira.',
  'Sai da cadeira em situações em que se espera que fique sentado(a).',
  'Corre ou sobe nas coisas em demasia em situações inapropriadas.',
  'Tem dificuldade para brincar ou se envolver silenciosamente em atividades de lazer.',
  'Age frequentemente como se estivesse a todo vapor ou movido(a) por um motor.',
  'Fala demais.',
  'Responde precipitadamente antes de as perguntas terem sido terminadas.',
  'Tem dificuldade para esperar a sua vez.',
  'Interrompe os outros ou se intromete em conversas ou jogos.',
].map((text, index) => ({ id: `q${index + 1}`, text: `${index + 1}. ${text}`, subscale: index < 9 ? 'desatencao' : 'hiperatividade', options: snap4 }));

function calculateSnap(answers: Record<string, number>): NexusScaleResult {
  const inattIds = Array.from({ length: 9 }, (_, i) => `q${i + 1}`);
  const hyperIds = Array.from({ length: 9 }, (_, i) => `q${i + 10}`);
  const inattTotal = sum(answers, inattIds);
  const hyperTotal = sum(answers, hyperIds);
  const inattItems = inattIds.filter((id) => (answers[id] ?? 0) >= 2).length;
  const hyperItems = hyperIds.filter((id) => (answers[id] ?? 0) >= 2).length;
  const meanInatt = (inattTotal / 9).toFixed(2);
  const meanHyper = (hyperTotal / 9).toFixed(2);
  let classification = 'Rastreio SNAP-IV Negativo para TDAH';
  let severity: NexusScaleResult['severity'] = 'low';
  let interpretation = 'Sintomas abaixo do ponto de corte (menos de 6 itens significativos por domínio).';
  const recommendations: string[] = ['Acompanhamento longitudinal de puericultura/APS'];
  if (inattItems >= 6 && hyperItems >= 6) {
    classification = 'Rastreio Positivo para TDAH na Infância/Adolescência (Apresentação Combinada)';
    severity = 'high';
    interpretation = `Critérios atingidos em Desatenção (${inattItems}/9; média ${meanInatt}) e Hiperatividade (${hyperItems}/9; média ${meanHyper}).`;
    recommendations.splice(0, 1, 'Solicitar preenchimento por professores/escola para confirmar sintomas em múltiplos ambientes', 'Avaliar desenvolvimento, visão e audição', 'Discussão matricial com saúde mental infantil/pediatria');
  } else if (inattItems >= 6) {
    classification = 'Rastreio Positivo para TDAH (Predomínio Desatento)';
    severity = 'moderate';
    interpretation = `Critérios atingidos para Desatenção (${inattItems}/9; média ${meanInatt}). Hiperatividade: ${hyperItems}/9.`;
    recommendations.splice(0, 1, 'Avaliar ambiente escolar e de aprendizagem', 'Acompanhamento na APS');
  } else if (hyperItems >= 6) {
    classification = 'Rastreio Positivo para TDAH (Predomínio Hiperativo/Impulsivo)';
    severity = 'moderate';
    interpretation = `Critérios atingidos para Hiperatividade (${hyperItems}/9; média ${meanHyper}). Desatenção: ${inattItems}/9.`;
    recommendations.splice(0, 1, 'Orientações de rotina, limites e estrutura comportamental', 'Acompanhamento na APS');
  }
  return {
    totalScore: inattTotal + hyperTotal, maxScore: 54, classification, severity, interpretation, recommendations,
    answersArray: SNAP_QUESTIONS.map((q) => answers[q.id] ?? 0),
    structuredData: { desatencaoItems: inattItems, hiperatividadeItems: hyperItems, desatencaoTotal: inattTotal, hiperatividadeTotal: hyperTotal, meanDesatencao: meanInatt, meanHiperatividade: meanHyper },
    soapText: `SNAP-IV: Desatenção média ${meanInatt} (${inattItems}/9 itens) | Hiperatividade média ${meanHyper} (${hyperItems}/9 itens) - ${classification} | Fonte: Swanson, 2001 (Validação BR: Mattos et al., 2006)`,
  };
}

export const SNAP_IV_DEFINITION: NexusScaleDefinition = {
  toolKey: 'snap-iv', moduleKey: 'mental-health', ruleKey: 'nexus.snap-iv', ruleVersion: 'nexus-2026-09-03', requiredCapability: 'nexus.scales',
  title: 'SNAP-IV (Swanson, Nolan, and Pelham Rating Scale)', acronym: 'SNAP-IV', targetGroup: 'Crianças e adolescentes na APS; preenchimento por pais/professores',
  description: 'Escala de 18 itens para triagem de Desatenção e Hiperatividade/Impulsividade.',
  instructions: 'Avalie o grau em que cada comportamento ocorreu nos últimos 6 meses no ambiente doméstico ou escolar.',
  referenceCitation: 'Swanson JM et al. 2001. Validação brasileira: Mattos P et al. Rev Psiquiatr Rio Gd Sul. 2006;28(3):290-297.',
  validationInfo: 'Versão brasileira validada. A função Nexus considera significativo valor >=2 e corte de >=6 itens por domínio.',
  cutoffInfo: 'Desatenção: >=6/9 itens significativos | Hiperatividade: >=6/9 itens significativos', estimatedMinutes: 4,
  questions: SNAP_QUESTIONS,
  evidence: [{ evidenceKey: 'snap-iv-mattos-2006', title: 'Validação brasileira SNAP-IV', source: 'Mattos P et al. Rev Psiquiatr Rio Gd Sul. 2006;28(3):290-297.', year: 2006, version: 'nexus-2026-09-03' }],
  clinicalConduct: [{ title: 'Coleta em múltiplos ambientes', description: 'O rastreio deve ser confrontado com informações de casa e escola.', badge: 'Pais + escola', tone: 'warning' }],
  monitoringGoals: [{ title: 'Prejuízo funcional', description: 'Acompanhar desempenho escolar, relações, organização e comportamento em múltiplos contextos.' }],
  clinicalPearls: [{ type: 'pitfall', title: 'Rastreio não é diagnóstico', text: 'Resultado positivo deve ser integrado à história do desenvolvimento, prejuízo funcional e diagnósticos diferenciais.' }],
  calculate: calculateSnap,
};

const ISI_QUESTIONS: readonly NexusScaleQuestion[] = [
  ['Dificuldade para pegar no sono (adormecer)', ['Nenhuma','Leve','Moderada','Grave','Muito grave']],
  ['Dificuldade para permanecer dormindo (despertares no meio da noite)', ['Nenhuma','Leve','Moderada','Grave','Muito grave']],
  ['Problemas com acordar muito cedo pela manhã', ['Nenhuma','Leve','Moderada','Grave','Muito grave']],
  ['Quão satisfeito(a) ou insatisfeito(a) está com seu padrão de sono atual?', ['Muito satisfeito','Satisfeito','Indiferente','Insatisfeito','Muito insatisfeito']],
  ['Quanto o problema de sono interfere no funcionamento diário?', ['Nada','Um pouco','Moderadamente','Muito','Extremamente']],
  ['Quão evidente para os outros é o prejuízo causado pelo problema de sono?', ['Nada perceptível','Um pouco perceptível','Moderadamente perceptível','Muito perceptível','Extremamente perceptível']],
  ['Quão preocupado(a) ou angustiado(a) está com seu problema de sono atual?', ['Nada preocupado','Um pouco','Moderadamente','Muito','Extremamente']],
].map(([text, labels], index) => ({ id: `q${index + 1}`, text: `${index + 1}. ${text as string}`, options: (labels as string[]).map((label, value) => ({ label, value })) }));

function calculateIsi(answers: Record<string, number>): NexusScaleResult {
  const totalScore = sum(answers, ISI_QUESTIONS.map((q) => q.id));
  let classification = 'Ausência de insônia clínica significativa';
  let severity: NexusScaleResult['severity'] = 'low';
  if (totalScore >= 22) { classification = 'Insônia clínica grave'; severity = 'severe'; }
  else if (totalScore >= 15) { classification = 'Insônia clínica de gravidade moderada'; severity = 'high'; }
  else if (totalScore >= 8) { classification = 'Insônia subclínica (limítrofe)'; severity = 'moderate'; }
  return { totalScore, maxScore: 28, classification, severity, interpretation: `Escore de ${totalScore}/28 pontos no ISI. ${classification}.`, recommendations: ['Higiene do sono e intervenção comportamental (TCC-I)', 'Avaliar comorbidades clínicas/psiquiátricas', 'Evitar uso indiscriminado de benzodiazepínicos'], answersArray: ISI_QUESTIONS.map((q) => answers[q.id] ?? 0), soapText: `ISI: ${totalScore}/28 pts (${classification})` };
}

export const ISI_DEFINITION: NexusScaleDefinition = {
  toolKey: 'isi', moduleKey: 'mental-health', ruleKey: 'nexus.isi', ruleVersion: 'nexus-2026-09-03', requiredCapability: 'nexus.scales', title: 'ISI (Índice de Gravidade da Insônia)', acronym: 'ISI', targetGroup: 'Adultos com queixas de insônia', description: 'Sete itens sobre natureza, gravidade e impacto da insônia nas últimas duas semanas.', instructions: 'Avalie a gravidade dos problemas com sono nas últimas duas semanas.', referenceCitation: 'Bastien CH, Vallières A, Morin CM. Sleep Med. 2001;2(4):297-307. Validação brasileira: Castro LS et al. 2009.', validationInfo: 'Nexus informa sensibilidade 86,1% e especificidade 87,7% para insônia clínica (corte >=15).', cutoffInfo: '0-7 ausente | 8-14 subclínica | 15-21 moderada | 22-28 grave', estimatedMinutes: 2, questions: ISI_QUESTIONS,
  evidence: [{ evidenceKey: 'isi-bastien-2001', title: 'Insomnia Severity Index validation', source: 'Bastien CH et al. Sleep Med. 2001;2(4):297-307.', year: 2001, version: 'nexus-2026-09-03' }],
  clinicalConduct: [{ title: 'TCC-I (Primeira Linha)', description: 'Controle de estímulos, restrição de tempo de leito e higiene do sono.', badge: 'Primeira Linha', tone: 'neutral' }], monitoringGoals: [{ title: 'Resposta longitudinal', description: 'Reaplicar para acompanhar gravidade e impacto funcional.' }], clinicalPearls: [], calculate: calculateIsi,
};

const HAMA_LABELS = ['Humor Ansioso','Tensão Psíquica','Medos / Fobias','Insônia','Cognição / Intelectual','Humor Deprimido','Somático Muscular','Somático Sensorial','Cardiovascular','Respiratório','Gastrointestinal','Genitourinário','Sintomas Autonômicos','Comportamento na Entrevista'];
const HAMA_QUESTIONS: readonly NexusScaleQuestion[] = HAMA_LABELS.map((text, index) => ({ id: `q${index + 1}`, text: `${index + 1}. ${text}`, options: hamilton5 }));
function calculateHama(answers: Record<string, number>): NexusScaleResult {
  const totalScore = sum(answers, HAMA_QUESTIONS.map((q) => q.id));
  let classification = 'Ansiedade leve ou ausência de ansiedade clinicamente significativa'; let severity: NexusScaleResult['severity'] = 'low';
  if (totalScore >= 25) { classification = 'Ansiedade grave a incapacitante'; severity = 'severe'; }
  else if (totalScore >= 18) { classification = 'Ansiedade moderada a grave'; severity = 'high'; }
  else if (totalScore >= 14) { classification = 'Ansiedade leve a moderada'; severity = 'moderate'; }
  return { totalScore, maxScore: 56, classification, severity, interpretation: `Escore de ${totalScore}/56 pontos na HAM-A. ${classification}.`, recommendations: ['Avaliar suporte psicoterapêutico e intervenção farmacológica conforme contexto', 'Mapear predomínio de sintomas psíquicos versus somáticos'], answersArray: HAMA_QUESTIONS.map((q) => answers[q.id] ?? 0), soapText: `HAM-A: ${totalScore}/56 pts (${classification})` };
}
export const HAMA_DEFINITION: NexusScaleDefinition = {
  toolKey: 'ham-a', moduleKey: 'mental-health', ruleKey: 'nexus.ham-a', ruleVersion: 'nexus-2026-09-03', requiredCapability: 'nexus.scales', title: 'HAM-A (Escala de Avaliação de Ansiedade de Hamilton)', acronym: 'HAM-A', targetGroup: 'Adultos com sintomas ansiosos para quantificação de gravidade', description: 'Escala clínica de 14 itens avaliada pelo profissional.', instructions: 'Avalie cada agrupamento de sintomas de 0 a 4 com base na entrevista clínica.', referenceCitation: 'Hamilton M. Br J Med Psychol. 1959;32(1):50-5.', validationInfo: 'Padrão clássico de quantificação dimensional em ensaios clínicos.', cutoffInfo: '<14 leve/normal | 14-17 leve-moderada | 18-24 moderada-grave | >=25 grave', estimatedMinutes: 5, questions: HAMA_QUESTIONS,
  evidence: [{ evidenceKey: 'hama-hamilton-1959', title: 'Hamilton Anxiety Rating Scale', source: 'Hamilton M. Br J Med Psychol. 1959;32(1):50-5.', year: 1959, version: 'nexus-2026-09-03' }], clinicalConduct: [{ title: 'Diferenciação somático vs psíquico', description: 'Separar componentes autonômicos/motores de preocupações cognitivas.' }], monitoringGoals: [{ title: 'Resposta terapêutica', description: 'Comparar escore ao longo do acompanhamento.' }], clinicalPearls: [], calculate: calculateHama,
};

const MDQ_TEXTS = ['Sentiu-se tão bem ou hiperativo(a) que outras pessoas acharam que não estava normal?','Ficou tão irritado(a) que gritou com pessoas ou começou brigas?','Sentiu-se muito mais autoconfiante que o habitual?','Dormiu muito menos que o habitual sem sentir falta de sono?','Esteve muito mais falante ou falou muito mais rápido que de costume?','Os pensamentos passavam tão rápido que não conseguia acompanhá-los?','Distraía-se tão facilmente que qualquer coisa tirava sua atenção?','Teve muito mais energia para fazer coisas?','Foi muito mais ativo(a) ou fez muito mais coisas?','Foi muito mais social ou expansivo(a)?','Esteve muito mais interessado(a) em sexo?','Fez coisas arriscadas, imprudentes ou gastou excessivamente?','Gastar dinheiro causou problemas para você ou sua família?'];
const MDQ_QUESTIONS: readonly NexusScaleQuestion[] = MDQ_TEXTS.map((text, index) => ({ id: `q${index + 1}`, text: `${index + 1}. ${text}`, options: yesNo }));
function calculateMdq(answers: Record<string, number>): NexusScaleResult {
  const totalScore = sum(answers, MDQ_QUESTIONS.map((q) => q.id)); const positive = totalScore >= 7;
  return { totalScore, maxScore: 13, classification: positive ? 'MDQ Positivo (Suspeita de Transtorno do Espectro Bipolar)' : 'MDQ Negativo (Baixa probabilidade de hipomania)', severity: positive ? 'high' : 'low', interpretation: `Escore de ${totalScore}/13 itens afirmativos no MDQ. ${positive ? 'Rastreamento positivo para sintomas hipomaníacos.' : 'Rastreio negativo.'}`, recommendations: [positive ? 'Revisar risco de bipolaridade antes de decisões antidepressivas' : 'Seguimento clínico habitual', 'Anamnese psiquiátrica longitudinal e histórico familiar'], answersArray: MDQ_QUESTIONS.map((q) => answers[q.id] ?? 0), structuredData: { clinicalReviewRequired: 'mdq-missing-concurrency-impairment-items' }, soapText: `MDQ: ${totalScore}/13 itens afirmativos (${positive ? 'Positivo >= 7' : 'Negativo'})` };
}
export const MDQ_DEFINITION: NexusScaleDefinition = {
  toolKey: 'mdq', moduleKey: 'mental-health', ruleKey: 'nexus.mdq', ruleVersion: 'nexus-2026-09-03', requiredCapability: 'nexus.scales', title: 'MDQ (Mood Disorder Questionnaire)', acronym: 'MDQ', targetGroup: 'Adultos com queixas de humor para rastreio bipolar', description: 'A implementação atual do Nexus executa 13 itens sintomáticos; a metadata também menciona simultaneidade e prejuízo funcional, registrados para revisão clínica.', instructions: 'Responda se já vivenciou as situações em algum momento da vida.', referenceCitation: 'Hirschfeld RM et al. Am J Psychiatry. 2000;157(11):1873-5. Validação brasileira: Mansur CG et al. 2005.', validationInfo: 'Metadata Nexus: >=7 sintomas + simultaneidade + prejuízo; função executável atual: >=7/13.', cutoffInfo: 'Implementação preservada: >=7/13; revisar itens de simultaneidade/prejuízo.', estimatedMinutes: 3, questions: MDQ_QUESTIONS,
  evidence: [{ evidenceKey: 'mdq-hirschfeld-2000', title: 'Mood Disorder Questionnaire', source: 'Hirschfeld RM et al. Am J Psychiatry. 2000;157(11):1873-5.', year: 2000, version: 'nexus-2026-09-03' }], clinicalConduct: [{ title: 'Risco de viragem maníaca', description: 'Resultado positivo exige revisão diagnóstica antes de monoterapia antidepressiva.', badge: 'Alerta farmacológico', tone: 'warning' }], monitoringGoals: [], clinicalPearls: [], calculate: calculateMdq,
};

const PCPTSD_TEXTS = ['Teve pesadelos sobre o evento ou pensou sobre ele quando não queria?','Esforçou-se para não pensar no evento ou evitou situações que lembravam o fato?','Esteve constantemente em guarda, vigilante ou se assustou com muita facilidade?','Sentiu-se anestesiado(a) ou distante de outras pessoas, atividades ou ambiente?','Sentiu culpa ou não conseguiu parar de culpar a si mesmo(a) ou terceiros pelo evento?'];
const PCPTSD_QUESTIONS: readonly NexusScaleQuestion[] = PCPTSD_TEXTS.map((text, index) => ({ id: `q${index + 1}`, text: `${index + 1}. ${text}`, options: yesNo }));
function calculatePcPtsd(answers: Record<string, number>): NexusScaleResult { const totalScore = sum(answers, PCPTSD_QUESTIONS.map((q) => q.id)); const positive = totalScore >= 3; return { totalScore, maxScore: 5, classification: positive ? 'PC-PTSD-5 Positivo (Suspeita de TEPT)' : 'PC-PTSD-5 Negativo (Baixa probabilidade de TEPT)', severity: positive ? 'high' : 'low', interpretation: `Escore de ${totalScore}/5. ${positive ? 'Rastreamento positivo; avaliação clínica formal de TEPT indicada.' : 'Rastreio negativo.'}`, recommendations: [positive ? 'Avaliação médica e psicológica focada em trauma' : 'Acompanhamento de rotina', 'Abordagem empática evitando revitimização'], answersArray: PCPTSD_QUESTIONS.map((q) => answers[q.id] ?? 0), soapText: `PC-PTSD-5: ${totalScore}/5 (${positive ? 'Positivo >= 3' : 'Negativo'})` }; }
export const PCPTSD5_DEFINITION: NexusScaleDefinition = {
  toolKey: 'pc-ptsd-5', moduleKey: 'mental-health', ruleKey: 'nexus.pc-ptsd-5', ruleVersion: 'nexus-2026-09-03', requiredCapability: 'nexus.scales', title: 'PC-PTSD-5', acronym: 'PC-PTSD-5', targetGroup: 'Adultos na APS após evento traumático', description: 'Rastreio breve de cinco itens para suspeita de TEPT.', instructions: 'Responda Sim/Não referente ao último mês após evento traumático.', referenceCitation: 'Prins A et al. J Gen Intern Med. 2016;31(10):1206-11.', validationInfo: 'Corte >=3 maximiza sensibilidade/especificidade no Nexus.', cutoffInfo: '0-2 baixa probabilidade | >=3 positivo', estimatedMinutes: 2, questions: PCPTSD_QUESTIONS,
  evidence: [{ evidenceKey: 'pcptsd5-prins-2016', title: 'PC-PTSD-5 development', source: 'Prins A et al. J Gen Intern Med. 2016;31(10):1206-11.', year: 2016, version: 'nexus-2026-09-03' }], clinicalConduct: [{ title: 'Cuidado informado sobre trauma', description: 'Ambiente seguro e escuta empática respeitando o ritmo do paciente.' }], monitoringGoals: [], clinicalPearls: [], calculate: calculatePcPtsd,
};

const PCL5_TEXTS = ['Memórias indesejadas e perturbadoras do evento','Sonhos perturbadores ou pesadelos sobre o evento','Reviver o evento como se estivesse acontecendo novamente','Sentir-se muito chateado(a) quando algo lembra o evento','Reações físicas fortes quando lembrado do evento','Evitar memórias, pensamentos ou sentimentos ligados ao evento','Evitar lembretes externos do evento','Dificuldade de lembrar partes importantes do evento','Crenças muito negativas sobre si, outros ou o mundo','Culpar a si mesmo(a) ou terceiros de forma distorcida','Sentimentos negativos constantes','Perda de interesse em atividades','Sentir-se distante ou isolado(a)','Dificuldade de sentir sentimentos positivos','Irritabilidade, explosões de raiva ou agressividade','Correr riscos desnecessários ou agir de forma autodestrutiva','Ficar em guarda constante ou hipervigilante','Assustar-se com muita facilidade','Dificuldade de concentração','Problemas para adormecer ou manter o sono'];
const PCL5_QUESTIONS: readonly NexusScaleQuestion[] = PCL5_TEXTS.map((text, index) => ({ id: `q${index + 1}`, text: `${index + 1}. ${text}`, subscale: index <= 4 ? 'intrusao' : index <= 6 ? 'esquiva' : index <= 13 ? 'cognicao_humor' : 'hiperativacao', options: severity5 }));
function calculatePcl5(answers: Record<string, number>): NexusScaleResult {
  const totalScore = sum(answers, PCL5_QUESTIONS.map((q) => q.id)); const positive = totalScore >= 33;
  const cluster = { intrusao: sum(answers, ['q1','q2','q3','q4','q5']), esquiva: sum(answers, ['q6','q7']), cognicaoHumor: sum(answers, ['q8','q9','q10','q11','q12','q13','q14']), hiperativacao: sum(answers, ['q15','q16','q17','q18','q19','q20']) };
  return { totalScore, maxScore: 80, classification: positive ? 'PCL-5 Positivo (Provável TEPT - Escore >= 33)' : 'PCL-5 Negativo (Sintomatologia pós-traumática abaixo do limiar)', severity: positive ? 'high' : 'low', interpretation: `Escore de ${totalScore}/80. ${positive ? 'Presença significativa de sintomas pós-traumáticos.' : 'Sintomas abaixo do ponto de corte.'}`, recommendations: [positive ? 'Psicoterapia baseada em evidências focada em trauma' : 'Monitoramento', 'Avaliar suporte psicofarmacológico adjuvante quando indicado'], answersArray: PCL5_QUESTIONS.map((q) => answers[q.id] ?? 0), structuredData: { ...cluster, clinicalReviewRequired: 'pcl5-cutoff-description-31-vs-33' }, soapText: `PCL-5: ${totalScore}/80 pts (${positive ? 'Positivo >=33' : 'Negativo'}) [Intrusão ${cluster.intrusao}/20 | Esquiva ${cluster.esquiva}/8 | Cognição/Humor ${cluster.cognicaoHumor}/28 | Hiperativação ${cluster.hiperativacao}/24]` };
}
export const PCL5_DEFINITION: NexusScaleDefinition = {
  toolKey: 'pcl-5', moduleKey: 'mental-health', ruleKey: 'nexus.pcl-5', ruleVersion: 'nexus-2026-09-03', requiredCapability: 'nexus.scales', title: 'PCL-5 (PTSD Checklist - DSM-5)', acronym: 'PCL-5', targetGroup: 'Adultos com histórico de trauma', description: '20 sintomas do DSM-5 agrupados em Intrusão, Esquiva, Cognição/Humor e Hiperativação.', instructions: 'Avalie de 0 a 4 o quanto cada sintoma incomodou no último mês.', referenceCitation: 'Blevins CA et al. J Trauma Stress. 2015;28(6):489-98. Validação brasileira: Osório FL et al. 2017.', validationInfo: 'A função executável Nexus usa corte >=33. A metadata também menciona intervalo 31-33 e requer revisão de texto/corte.', cutoffInfo: 'Implementação preservada: <33 abaixo do limiar | >=33 provável TEPT.', estimatedMinutes: 6, questions: PCL5_QUESTIONS,
  evidence: [{ evidenceKey: 'pcl5-blevins-2015', title: 'PCL-5 development and evaluation', source: 'Blevins CA et al. J Trauma Stress. 2015;28(6):489-98.', year: 2015, version: 'nexus-2026-09-03' }], clinicalConduct: [{ title: 'Avaliação focada em trauma', description: 'Interpretar escore com exposição traumática, prejuízo funcional e critérios DSM-5.' }], monitoringGoals: [{ title: 'Quatro clusters', description: 'Acompanhar também a evolução de Intrusão, Esquiva, Cognição/Humor e Hiperativação.' }], clinicalPearls: [], calculate: calculatePcl5,
};
