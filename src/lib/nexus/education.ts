export type NexusEducationMaterial = {
  id: string;
  topic: string;
  title: string;
  targetAudience: string;
  summary: string;
  practicalActions: string[];
  fullText: string;
  printFriendly: string;
};

export const NEXUS_EDUCATION_MATERIALS: NexusEducationMaterial[] = [
  { id:'tdah-adultos-criancas', topic:'TDAH', title:'Guia Prático de Estratégias e Organização no TDAH', targetAudience:'Adultos com TDAH, pais e educadores', summary:'Estratégias não farmacológicas fundamentais para estruturação do ambiente, rotinas e manejo do foco na Atenção Primária.', practicalActions:['Técnica Pomodoro Adaptada: blocos curtos de 15 a 25 minutos de foco seguidos de 5 minutos de pausa ativa.','Organização Visual: uso de quadros, post-its e agenda única.','Regra dos 2 Minutos: tarefas muito breves devem ser executadas imediatamente.','Rotina Pré-Sono: desligar telas 1 hora antes de deitar e manter horário fixo de despertar.','Diálogo com Escola/Trabalho: pactuar pausas e reduzir distratores.'], fullText:'O TDAH envolve variações no funcionamento das funções executivas, como controle inibitório, memória de trabalho e planejamento. Medidas práticas incluem redução de distratores, fragmentação de tarefas, alarmes, exercício físico e envolvimento da rede de apoio.', printFriendly:'NEXUS CLÍNICO - GUIA DE ORIENTAÇÕES AO PACIENTE E FAMÍLIA: TDAH\n\n- Divida tarefas grandes em passos pequenos.\n- Use agendas visuais e alarmes.\n- Reduza distrações no ambiente.\n- Pratique atividade física regularmente.\n- Mantenha horários regulares de sono.' },
  { id:'depressao-ativacao', topic:'Depressão', title:'Ativação Comportamental e Cuidados na Depressão', targetAudience:'Pacientes com sintomas depressivos e familiares', summary:'Instruções para quebrar o ciclo de isolamento e inatividade através de pequenos passos diários.', practicalActions:['MicroMetas Diárias.','Ativação Comportamental mesmo sem motivação inicial.','Conexão Social Mínima com pessoa de confiança.','Exposição à luz natural matinal.'], fullText:'Na depressão, esperar a motivação surgir para agir pode prolongar a prostração. A ativação comportamental trabalha com a ideia de que a ação pode anteceder a motivação.', printFriendly:'NEXUS CLÍNICO - GUIA DE SAÚDE MENTAL: MANEJO DA DEPRESSÃO\n\n- Comece pequeno.\n- Movimente o corpo.\n- Evite isolamento completo.\n- Mantenha o tratamento conforme orientação profissional.' },
  { id:'ansiedade-desaceleracao', topic:'Ansiedade', title:'Manejo de Crises de Ansiedade e Desaceleração Ansiogênica', targetAudience:'Pacientes com sintomas de ansiedade e ataques de pânico', summary:'Técnicas corporais e cognitivas para manejo de ansiedade aguda.', practicalActions:['Respiração diafragmática pausada.','Técnica de aterramento 5-4-3-2-1.','Descatastrofização: diferenciar fato de pensamento.'], fullText:'A ansiedade é uma resposta natural de proteção. Durante uma crise, o corpo entra em estado de luta ou fuga. Recomenda-se reduzir hiperventilação, focar na respiração e evitar excesso de estimulantes.', printFriendly:'NEXUS CLÍNICO - ORIENTAÇÕES PARA CRISES DE ANSIEDADE\n\n1. Apoie os pés no chão.\n2. Respire devagar, soltando o ar lentamente.\n3. Use elementos do ambiente para se orientar no presente.' },
  { id:'sono-cronobiologia', topic:'Sono', title:'Higiene do Sono e Estabilização Circadiana', targetAudience:'Pacientes com insônia primária ou secundária', summary:'Regras de higiene do sono para estabilização do ritmo circadiano.', practicalActions:['Horário fixo de despertar.','Quarto escuro, silencioso e confortável.','Se não adormecer, levantar e fazer atividade calma.','Reduzir telas antes de deitar.'], fullText:'A higiene do sono é uma intervenção importante na APS e ajuda a reduzir dependência de estratégias sedativas inadequadas.', printFriendly:'NEXUS CLÍNICO - GUIA DE HIGIENE DO SONO\n\n- Use a cama prioritariamente para dormir.\n- Evite estimulantes no fim do dia.\n- Faça refeições leves à noite.\n- Mantenha rotina regular.' },
  { id:'psicofarmacos-seguranca', topic:'Psicofármacos', title:'Uso Seguro e Consciente de Psicofármacos na APS', targetAudience:'Pacientes em início ou ajuste de medicação psicotrópica', summary:'Orientações essenciais sobre latência terapêutica, efeitos iniciais e descontinuação orientada.', practicalActions:['Alinhar expectativa sobre latência terapêutica.','Observar efeitos iniciais transitórios.','Não interromper abruptamente sem orientação profissional.'], fullText:'O alinhamento de expectativas é fundamental para adesão e segurança no uso de psicofármacos. Ajustes e interrupções devem ser discutidos com o profissional responsável.', printFriendly:'NEXUS CLÍNICO - INFORMAÇÕES SOBRE O USO DE SEU MEDICAMENTO\n\n- Use conforme orientação profissional.\n- Benefícios podem não ser imediatos.\n- Se surgirem desconfortos ou dúvidas, contate sua equipe de saúde.\n- Não altere ou interrompa por conta própria.' },
];

export function suggestEducationTopics(toolKeys: string[]): string[] {
  const keys = new Set(toolKeys);
  const topics: string[] = [];
  if ([...keys].some((key) => ['asrs-18','snap-iv'].includes(key))) topics.push('TDAH');
  if ([...keys].some((key) => ['phq-9','epds','srq-20'].includes(key))) topics.push('Depressão');
  if ([...keys].some((key) => ['gad-7','ham-a'].includes(key))) topics.push('Ansiedade');
  if (keys.has('isi')) topics.push('Sono');
  if ([...keys].some((key) => ['antidepressant-switch','cv-risk-sbc'].includes(key))) topics.push('Psicofármacos');
  return [...new Set(topics)];
}
