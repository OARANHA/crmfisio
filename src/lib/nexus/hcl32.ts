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
    interpretation = `Escore de ${totalScore}/32 pontos ultrapassa a linha de corte validada no Brasil (≥ 18 pontos). Fator Ativação/Elação: ${activationScore}/19; Fator Risco/Irritabilidade: ${riskScore}/13.`;
    recommendations = [
      'Evitar monoterapia antidepressiva sem revisão clínica do risco de bipolaridade.',
      'Realizar anamnese psiquiátrica longitudinal e investigar histórico familiar de transtorno bipolar e suicídio.',
      'Investigar duração dos episódios de hipomania e mudança nítida de comportamento.',
      'Discutir o caso com saúde mental/psiquiatria conforme contexto clínico.',
    ];
  } else if (totalScore >= 14) {
    classification = 'Traços Moderados de Hipomania (Corte Internacional ≥ 14)';
    severity = 'moderate';
    interpretation = `Escore de ${totalScore}/32 pontos atinge a faixa internacional de 14 a 17 pontos. Ativação: ${activationScore}/19; Risco: ${riskScore}/13.`;
    recommendations = [
      'Aprofundar investigação de fases prévias de hiperatividade, redução do sono e impulsividade.',
      'Avaliar resposta a tratamentos antidepressivos anteriores.',
      'Monitorar evolução longitudinal.',
    ];
  } else {
    classification = 'Rastreio Negativo para Hipomania / Espectro Bipolar';
    severity = 'low';
    interpretation = `Escore de ${totalScore}/32 pontos abaixo da linha de corte sugestiva de episódios hipomaníacos (Ativação: ${activationScore}/19, Risco: ${riskScore}/13).`;
    recommendations = [
      'Seguir investigação clínica conforme o quadro atual.',
      'Reavaliar se houver piora paradoxal ou agitação durante tratamento antidepressivo.',
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
  description: 'Instrumento de autorrelato com 32 itens para rastreamento de episódios prévios de hipomania em pacientes com depressão, auxiliando na identificação do Transtorno Bipolar e do Espectro Bipolar.',
  instructions: 'Comparado a como você é habitualmente, pense em períodos da sua vida em que se sentiu em uma fase de alta, com mais energia, disposição ou humor mais elevado. Responda SIM ou NÃO para cada afirmação.',
  referenceCitation: 'Angst J, Adolfsson R, Benazzi F, et al. J Affect Disord. 2005;88(2):217-33. Versão brasileira: Soares OT, Moreno RA, Moura EC, Angst J. Rev Bras Psiquiatr. 2010;32(4):438-445.',
  validationInfo: 'Versão brasileira validada. Alfa de Cronbach 0,86. Ponto de corte brasileiro ≥ 18 (sensibilidade 75%, especificidade 58%).',
  cutoffInfo: '0-13: Negativo | 14-17: Traços moderados | ≥18: Positivo no corte brasileiro',
  estimatedMinutes: 5,
  questions,
  evidence: [
    { evidenceKey: 'hcl32-angst-2005', title: 'The HCL-32: development and validation', source: 'Angst J et al. J Affect Disord. 2005;88(2):217-33.', year: 2005, version: 'nexus-2026-09-03' },
    { evidenceKey: 'hcl32-brazil-soares-2010', title: 'Validação brasileira do HCL-32', source: 'Soares OT et al. Rev Bras Psiquiatr. 2010;32(4):438-445.', year: 2010, version: 'nexus-2026-09-03' },
  ],
  clinicalConduct: [
    { title: 'Escore < 14 — Rastreio Negativo', description: 'Baixa probabilidade de episódios hipomaníacos prévios. Interpretar sempre junto à história clínica.', badge: '0-13 pts', tone: 'neutral' },
    { title: 'Escore 14 a 17 — Traços Moderados', description: 'Aprofundar anamnese cronológica e investigar redução objetiva da necessidade de sono, aumento de energia e impulsividade.', badge: '14-17 pts', tone: 'warning' },
    { title: 'Escore ≥ 18 — Corte Brasileiro Positivo', description: 'Forte suspeita de espectro bipolar. Investigar duração, impacto funcional, história familiar e episódios prévios.', badge: '≥18 pts', tone: 'danger' },
    { title: 'Alerta farmacológico', description: 'Resultado positivo deve provocar revisão diagnóstica antes de decisões farmacológicas, especialmente monoterapia antidepressiva.', badge: 'segurança', tone: 'danger' },
  ],
  monitoringGoals: [
    { title: 'Estabilidade do humor e sono', description: 'Monitorar oscilação de humor, redução da necessidade de sono, impulsividade e funcionamento longitudinal.' },
    { title: 'Monitoramento terapêutico', description: 'Quando houver estabilizadores, seguir monitoramento clínico/laboratorial específico do tratamento prescrito.' },
    { title: 'Psicoeducação de sinais precoces', description: 'Orientar paciente e rede de apoio a reconhecer pródromos de elevação de humor e desorganização comportamental.' },
  ],
  clinicalPearls: [
    { type: 'evidence', title: 'Validação brasileira', text: 'O ponto de corte brasileiro usado pelo Nexus é ≥18, conforme Soares et al. 2010.', reference: 'Soares OT et al. Rev Bras Psiquiatr. 2010;32(4):438-445.' },
    { type: 'pearl', title: 'Hipomania pode ser percebida como bem-estar', text: 'Pacientes podem não relatar espontaneamente fases de hipomania porque as percebem como períodos de produtividade e energia.' },
    { type: 'pitfall', title: 'Não confundir recuperação com hipomania', text: 'Recuperação de depressão não equivale a hipomania; investigar mudança quantitativa do sono, desinibição, pressão para falar e comportamentos fora do padrão.' },
  ],
  calculate: calculateHcl32,
};
