import type { NexusScaleDefinition, NexusScaleQuestion, NexusScaleResult } from './scaleRuntime';

const yesNo = [{ label: 'Não (0)', value: 0 }, { label: 'Sim (1)', value: 1 }] as const;
const q = (id: string, text: string, subscale: 'ativacao' | 'risco'): NexusScaleQuestion => ({ id, text, subscale, options: yesNo });

const questions: readonly NexusScaleQuestion[] = [
  q('q1', '1. Preciso de menos sono.', 'ativacao'),
  q('q2', '2. Sinto-me com mais energia e mais ativo(a).', 'ativacao'),
  q('q3', '3. Sou mais autoconfiante.', 'ativacao'),
  q('q4', '4. Aprecio mais o meu trabalho / Trabalho com mais prazer.', 'ativacao'),
  q('q5', '5. Sou mais sociável (faço mais telefonemas, saio mais com as pessoas).', 'ativacao'),
  q('q6', '6. Tenho vontade de viajar e/ou viajo mais.', 'ativacao'),
  q('q7', '7. Tendo a dirigir mais rápido ou correr mais riscos na direção/trânsito.', 'risco'),
  q('q8', '8. Gasto mais dinheiro ou gasto dinheiro demais (compras impulsivas).', 'risco'),
  q('q9', '9. Corro mais riscos na minha vida diária (no trabalho e/ou em outras atividades).', 'risco'),
  q('q10', '10. Fico fisicamente mais ativo(a) (prática de esportes, caminhadas, etc.).', 'ativacao'),
  q('q11', '11. Planejo mais atividades ou projetos.', 'ativacao'),
  q('q12', '12. Tenho mais ideias, sou mais criativo(a).', 'ativacao'),
  q('q13', '13. Sou menos tímido(a) ou inibido(a).', 'ativacao'),
  q('q14', '14. Visto roupas mais coloridas, extravagantes ou uso mais maquiagem.', 'ativacao'),
  q('q15', '15. Quero conhecer ou de fato conheço mais pessoas.', 'ativacao'),
  q('q16', '16. Tenho mais interesse em sexo e/ou aumento do desejo sexual.', 'ativacao'),
  q('q17', '17. Sou mais paquerador(a) / sedutor(a) e/ou mais sexualmente ativo(a).', 'risco'),
  q('q18', '18. Falo mais / falo pelos cotovelos.', 'ativacao'),
  q('q19', '19. Penso mais rápido.', 'ativacao'),
  q('q20', '20. Faço mais piadas ou trocadilhos quando estou conversando.', 'ativacao'),
  q('q21', '21. Fico facilmente distraído(a).', 'risco'),
  q('q22', '22. Envolvo-me em muitas coisas novas.', 'ativacao'),
  q('q23', '23. Meus pensamentos pulam de um assunto para outro (fuga de ideias).', 'risco'),
  q('q24', '24. Faço as coisas com mais rapidez e/ou mais facilidade.', 'ativacao'),
  q('q25', '25. Fico mais impaciente e/ou me irrito mais facilmente.', 'risco'),
  q('q26', '26. Posso ser cansativo(a) ou irritante para os outros.', 'risco'),
  q('q27', '27. Entro em mais discussões, brigas ou conflitos.', 'risco'),
  q('q28', '28. Meu humor fica mais elevado, mais otimista.', 'ativacao'),
  q('q29', '29. Bebo mais café ou cafeína.', 'risco'),
  q('q30', '30. Fumo mais cigarros ou derivados do tabaco.', 'risco'),
  q('q31', '31. Bebo mais bebidas alcoólicas.', 'risco'),
  q('q32', '32. Uso mais medicamentos ou outras substâncias (sedativos, estimulantes, ansiolíticos).', 'risco'),
];

const activationIds = new Set(['q1','q2','q3','q4','q5','q6','q10','q11','q12','q13','q14','q15','q16','q18','q19','q20','q22','q24','q28']);
const riskIds = new Set(['q7','q8','q9','q17','q21','q23','q25','q26','q27','q29','q30','q31','q32']);

function calculateHcl32(answers: Record<string, number>): NexusScaleResult {
  let activationScore = 0;
  let riskScore = 0;
  for (const id of activationIds) if (answers[id] === 1) activationScore += 1;
  for (const id of riskIds) if (answers[id] === 1) riskScore += 1;
  const totalScore = activationScore + riskScore;

  let classification: string;
  let severity: NexusScaleResult['severity'];
  let interpretation: string;
  let recommendations: string[];

  if (totalScore >= 18) {
    classification = 'Rastreio Positivo para Transtorno do Espectro Bipolar (Corte Brasileiro ≥ 18)';
    severity = 'high';
    interpretation = `Escore de ${totalScore}/32 pontos ultrapassa a linha de corte validada no Brasil (≥ 18 pontos - Soares & Moreno, 2010; Sensibilidade 75%, Especificidade 58%). Fator Ativação/Elação: ${activationScore}/19; Fator Risco/Irritabilidade: ${riskScore}/13. Sugere forte probabilidade de histórico de hipomania (Transtorno Bipolar Tipo II ou Espectro Bipolar).`;
    recommendations = [
      '⚠️ ATENÇÃO: Evitar monoterapia com antidepressivos (risco de virada maníaca, indução de ciclagem rápida ou agitação psicomotora)',
      'Realizar anamnese psiquiátrica longitudinal e investigar histórico familiar de transtorno bipolar e suicídio',
      'Investigar a duração dos episódios de hipomania (critério DSM-5: mínimo de 4 dias consecutivos com mudança nítida de comportamento)',
      'Discutir caso com Apoio Matricial em Saúde Mental / Psiquiatria para pactuação de estabilizador de humor (ex: Lítio, Lamotrigina, Quetiapina)',
    ];
  } else if (totalScore >= 14) {
    classification = 'Traços Moderados de Hipomania (Corte Internacional ≥ 14)';
    severity = 'moderate';
    interpretation = `Escore de ${totalScore}/32 pontos atinge a faixa de corte internacional (14 a 17 pts). Ativação: ${activationScore}/19; Risco: ${riskScore}/13. Há relato moderado de sintomas de elevação do humor no histórico prévio.`;
    recommendations = [
      'Aprofundar a investigação clínica de fases prévias de hiperatividade, redução do sono e impulsividade financeira/comportamental',
      'Avaliar resposta a tratamentos antidepressivos anteriores (houve piora da insônia, irritabilidade ou perda de efeito?)',
      'Monitorar evolução longitudinal na APS',
    ];
  } else {
    classification = 'Rastreio Negativo para Hipomania / Espectro Bipolar';
    severity = 'low';
    interpretation = `Escore de ${totalScore}/32 pontos abaixo da linha de corte sugestiva de episódios hipomaníacos (Ativação: ${activationScore}/19, Risco: ${riskScore}/13).`;
    recommendations = [
      'Seguir propedêutica e tratamento padrão para Transtorno Depressivo Unipolar ou Ansiedade conforme protocolos clínicos',
      'Reavaliar se houver piora paradoxal ou agitação durante tratamento com antidepressivos',
    ];
  }

  const answersArray = questions.map((question) => answers[question.id] ?? 0);
  return {
    totalScore,
    maxScore: 32,
    classification,
    severity,
    interpretation,
    recommendations,
    answersArray,
    structuredData: { activationScore, riskScore },
    soapText: `HCL-32: ${totalScore}/32 pts (${classification}) [Ativação: ${activationScore}/19 | Risco/Irritabilidade: ${riskScore}/13] | Fonte: Angst et al., 2005 (Validação BR: Soares & Moreno, 2010 - Corte ≥18)`,
  };
}

export const HCL32_DEFINITION: NexusScaleDefinition = {
  toolKey: 'hcl-32',
  moduleKey: 'mental-health',
  ruleKey: 'nexus.hcl32',
  ruleVersion: 'nexus-2026-09-03',
  requiredCapability: 'nexus.scales',
  title: 'HCL-32 (Hypomania Checklist - 32 itens)',
  acronym: 'HCL-32',
  targetGroup: 'Adultos na APS com episódios depressivos recorrentes ou oscilações de humor/energia',
  description: 'Instrumento de autorrelato com 32 itens para rastreamento de episódios prévios de hipomania em pacientes com depressão, auxiliando na identificação do Transtorno Bipolar (especialmente Tipo II) e do Espectro Bipolar.',
  instructions: 'Comparado a como você é habitualmente, pense em períodos da sua vida em que você se sentiu "numa fase de alta", com muita energia, disposição ou humor mais elevado. Responda SIM ou NÃO para cada uma das 32 afirmações abaixo.',
  referenceCitation: 'Angst J, Adolfsson R, Benazzi F, et al. J Affect Disord. 2005; 88(2):217-33. Versão Brasileira Validada: Soares OT, Moreno RA, Moura EC, Angst J. Rev Bras Psiquiatr. 2010; 32(4):438-445.',
  validationInfo: 'Versão Brasileira validada (USP). Alfa de Cronbach: 0.86. Ponto de corte validado no Brasil: ≥ 18 pontos (Sensibilidade 75%, Especificidade 58%). Ponto de corte internacional: ≥ 14 pontos.',
  cutoffInfo: '0-13: Rastreio Negativo | 14-17: Traços Moderados de Hipomania | ≥ 18: Rastreio Positivo para Espectro Bipolar (Corte BR)',
  estimatedMinutes: 5,
  questions,
  evidence: [
    { evidenceKey: 'hcl32-angst-2005', title: 'HCL-32 original', source: 'Angst J, Adolfsson R, Benazzi F, et al. J Affect Disord. 2005; 88(2):217-33.', year: 2005, version: 'nexus-2026-09-03' },
    { evidenceKey: 'hcl32-brazil-soares-2010', title: 'Validação brasileira do HCL-32', source: 'Soares OT, Moreno RA, Moura EC, Angst J. Rev Bras Psiquiatr. 2010; 32(4):438-445.', year: 2010, version: 'nexus-2026-09-03' },
  ],
  clinicalConduct: [
    { title: 'Escore < 14 — Rastreio Negativo para Hipomania', description: 'Baixa probabilidade de episódios hipomaníacos prévios. Se o paciente apresentar queixa depressiva atual, conduzir o tratamento de acordo com as diretrizes para Transtorno Depressivo Maior unipolar.', badge: '0-13 pts: Negativo', tone: 'neutral' },
    { title: 'Escore 14 a 17 — Traços Moderados de Hipomania (Corte Internacional)', description: 'Aprofundar a anamnese cronológica com o paciente e informantes familiares. Investigar períodos de aumento súbito de energia, redução objetiva da necessidade de sono (dormir 3-4h e acordar descansado) e impulsividade com dinheiro ou relacionamentos.', badge: '14-17 pts: Moderado', tone: 'warning' },
    { title: 'Escore ≥ 18 — Rastreio Positivo no Brasil (Soares & Moreno, 2010)', description: 'Forte suspeita de Transtorno do Espectro Bipolar (especialmente Transtorno Bipolar Tipo II ou ciclotimia). Investigar duração dos períodos de elação/irritabilidade (mínimo de 4 dias consecutivos conforme DSM-5) e histórico familiar de transtorno de humor ou suicídio.', badge: '≥ 18 pts: Positivo (Corte BR)', tone: 'danger' },
    { title: '⚠️ REGRA DE OURO: Contraindicação de Antidepressivo em Monoterapia', description: 'NUNCA prescrever antidepressivos isolados para pacientes deprimidos com HCL-32 ≥ 18 sem estabilizador de humor associado. A monoterapia antidepressiva pode desencadear virada maníaca, aceleração de ciclagem, disforia mista e aumento agudo do risco de suicídio.', badge: 'Alerta Absoluto', tone: 'danger' },
    { title: 'Pactuação Terapêutica & Apoio Matricial em Saúde Mental', description: 'Discutir o caso no Apoio Matricial / Psiquiatria para introdução e titulação de estabilizadores de humor de 1ª linha (Carbonato de Lítio, Lamotrigina, Quetiapina ou Valproato de Sódio).', badge: 'Matriciamento', tone: 'warning' },
  ],
  monitoringGoals: [
    { title: 'Estabilização Timolépica & Regulação Circadiana', description: 'Alcançar estabilidade do humor sem oscilações maníacas ou depressivas. Estabelecer rotina estrita de sono-vigília (higiene circadiana) como pilar não farmacológico essencial.' },
    { title: 'Monitoramento Laboratorial de Estabilizadores', description: 'Para Lítio: Litiemia a cada 3-6 meses (alvo 0,6 a 0,8 mEq/L na manutenção), TSH, Ureia e Creatinina. Para Valproato: Enzimas hepáticas (TGO/TGP) e hemograma com plaquetas.' },
    { title: 'Psicoeducação Familiar de Sinais Precoces de Recaída', description: 'Orientar o paciente e sua família a reconhecer os pródromos de hipomania (diminuição da necessidade de sono, loquacidade excessiva, compras desnecessárias) para ajuste posológico precoce.' },
  ],
  clinicalPearls: [
    { type: 'evidence', title: 'Estudo de Validação Brasileiro (FMUSP)', text: 'O estudo de validação no Brasil realizado por Soares, Moreno, Moura & Angst (Rev Bras Psiquiatr, 2010; 32(4):438-45) demonstrou que o ponto de corte ótimo na população brasileira é de 18 pontos (Sensibilidade 75%, Especificidade 58% e Alfa de Cronbach 0.86).', reference: 'Soares OT et al. Rev Bras Psiquiatr. 2010; 32(4):438-445.' },
    { type: 'pearl', title: 'Pérola Clínica: A Ilusão do "Estou Apenas Ótimo"', text: 'Pacientes com Bipolar Tipo II demoram em média 8 a 10 anos para receber o diagnóstico correto, pois só procuram a UBS nas fases depressivas e consideram os períodos de hipomania como os únicos momentos em que "finalmente estavam saudáveis, produtivos e inspirados".' },
    { type: 'pitfall', title: 'Armadilha: Diferenciar Hipomania de Alívio Pós-Depressão', text: 'Não confunda a recuperação do humor deprimido com hipomania. A hipomania verdadeira cursa com alteração quantitativa do sono (dorme poucas horas sem sentir cansaço diurno), desinibição social anormal, pressão para falar e projetos mirabolantes não finalizados.' },
  ],
  calculate: calculateHcl32,
};
