import type { NexusScaleRedFlag } from './scaleRuntime';

export type EemDomainKey =
  | 'aparencia'
  | 'atitude'
  | 'fala'
  | 'humor'
  | 'afeto'
  | 'pensamentoCurso'
  | 'pensamentoForma'
  | 'pensamentoConteudo'
  | 'sensopercepcao'
  | 'orientacao'
  | 'atencaoMemoria'
  | 'insight'
  | 'julgamento';

export type NexusEemState = Record<EemDomainKey, string[]> & {
  observacoesLivres: string;
};

export type EemDomain = {
  id: EemDomainKey;
  title: string;
  instructions: string;
  options: readonly { id: string; label: string }[];
};

export const NEXUS_EEM_RULE_VERSION = 'nexus-eem-2026-09-03';

export const EEM_DOMAINS: readonly EemDomain[] = [
  { id: 'aparencia', title: '1. Aparência', instructions: 'Higiene, vestuário e apresentação física.', options: [
    { id: 'higienizado', label: 'Cuidados pessoais e higiene adequados' }, { id: 'desleixado', label: 'Desleixo com higiene e autocuidado' },
    { id: 'vestuario_adequado', label: 'Vestuário adequado ao clima e contexto' }, { id: 'vestuario_extravagante', label: 'Vestuário extravagante, bizarro ou desalinhado' },
    { id: 'aparente_idade', label: 'Compatível com a idade cronológica' }, { id: 'aparente_envelhecido', label: 'Visivelmente envelhecida / fragilidade' },
  ]},
  { id: 'atitude', title: '2. Atitude e Comportamento', instructions: 'Postura relacional com o examinador e padrão motor.', options: [
    { id: 'cooperativo', label: 'Cooperativo e participativo' }, { id: 'desconfiado', label: 'Desconfiado, esquivo ou vigilante' }, { id: 'hostil', label: 'Hostil, opositor ou irritável' },
    { id: 'inhibido', label: 'Inibido, retraído ou lentificado' }, { id: 'agita_psicomotora', label: 'Agitação psicomotora / inquietude' }, { id: 'seductor_teatral', label: 'Teatral, dramático ou sedutor' },
  ]},
  { id: 'fala', title: '3. Fala e Linguagem', instructions: 'Volume, ritmo, tom e articulação.', options: [
    { id: 'fala_normal', label: 'Tom, ritmo e volume normais e fluidos' }, { id: 'fala_lentificada', label: 'Bradilalia (pausada / lentificada)' }, { id: 'fala_acelerada', label: 'Taquilalia / pressão de discurso' },
    { id: 'fala_baixo_volume', label: 'Hipofonia' }, { id: 'fala_disartrica', label: 'Disartria ou voz pastosa' }, { id: 'mutismo', label: 'Mutismo parcial ou total' },
  ]},
  { id: 'humor', title: '4. Humor', instructions: 'Estado emocional predominante autorrelatado ou observado.', options: [
    { id: 'eutimico', label: 'Eutímico' }, { id: 'distimico', label: 'Distímico / Deprimido / Triste' }, { id: 'ansioso', label: 'Ansioso / Apreensivo' }, { id: 'euforico', label: 'Eufórico / Expansivo / Exaltado' }, { id: 'disforico', label: 'Disfórico / Irritável' }, { id: 'apatico', label: 'Apatia / Indiferença emocional' },
  ]},
  { id: 'afeto', title: '5. Afeto', instructions: 'Expressão emocional objetiva e modulação.', options: [
    { id: 'normoemotivo', label: 'Normoemotivo' }, { id: 'embotado', label: 'Embotado / Plano' }, { id: 'labil', label: 'Lábil' }, { id: 'incongruente', label: 'Incongruente / Paratimia' }, { id: 'hipomodulado', label: 'Hipomodulado / Restrito' },
  ]},
  { id: 'pensamentoCurso', title: '6. Pensamento - Curso', instructions: 'Velocidade e fluxo do pensamento.', options: [
    { id: 'curso_normopsiquico', label: 'Normopsíquico' }, { id: 'curso_bradipsiquico', label: 'Bradipsiquismo' }, { id: 'curso_taquipsiquico', label: 'Taquipsiquismo' }, { id: 'curso_bloqueio', label: 'Bloqueio / interrupção brusca' },
  ]},
  { id: 'pensamentoForma', title: '6b. Pensamento - Forma e Organização', instructions: 'Lógica e encadeamento das ideias.', options: [
    { id: 'forma_coerente', label: 'Lógico, coerente e direcionado a metas' }, { id: 'forma_circunstancial', label: 'Circunstancial / Prolixo' }, { id: 'forma_tangencial', label: 'Tangencial' }, { id: 'forma_fuga_ideias', label: 'Fuga de ideias' }, { id: 'forma_frouxidao', label: 'Frouxidão de associações / Descarrilamento' },
  ]},
  { id: 'pensamentoConteudo', title: '6c. Pensamento - Conteúdo', instructions: 'Temas centrais, ruminações, preocupações ou crenças delirantes.', options: [
    { id: 'conteudo_sem_alteracoes', label: 'Sem alterações no conteúdo' }, { id: 'conteudo_ruminacoes', label: 'Ruminações / Preocupações excessivas' }, { id: 'conteudo_ideias_obsessivas', label: 'Ideias fixas / obsessivas intrusivas' },
    { id: 'conteudo_ideacao_suicida', label: 'Ideação suicida / Pensamentos de morte ou autolesão' }, { id: 'conteudo_delirio_perseguitorio', label: 'Ideias delirantes persecutórias / paranoides' }, { id: 'conteudo_delirio_grandeza', label: 'Ideias delirantes de grandeza / místicas' }, { id: 'conteudo_delirio_ruina', label: 'Ideias delirantes de ruína / culpa' },
  ]},
  { id: 'sensopercepcao', title: '7. Sensopercepção', instructions: 'Alucinações, ilusões e vivência do Eu.', options: [
    { id: 'senso_sem_alteracoes', label: 'Sem alterações perceptivas' }, { id: 'senso_alucinacao_auditiva', label: 'Alucinações auditivas' }, { id: 'senso_alucinacao_visual', label: 'Alucinações visuais' }, { id: 'senso_ilusoes', label: 'Ilusões' }, { id: 'senso_despersonalizacao', label: 'Despersonalização / Desrealização' },
  ]},
  { id: 'orientacao', title: '8. Orientação', instructions: 'Autopsíquica, temporal, espacial e situacional.', options: [
    { id: 'orientado_global', label: 'Lúcido e orientado globalmente' }, { id: 'orientado_autopsiquica', label: 'Orientação autopsíquica preservada' }, { id: 'desorientado_autopsiquica', label: 'Desorientação autopsíquica' }, { id: 'desorientado_tempo', label: 'Desorientação temporal' }, { id: 'desorientado_espaco', label: 'Desorientação espacial' }, { id: 'desorientacao_situacional', label: 'Desorientação situacional' },
  ]},
  { id: 'atencaoMemoria', title: '9. Atenção, Concentração e Memória', instructions: 'Prosexia, fixação e evocação.', options: [
    { id: 'atencao_normoprosexica', label: 'Normoprosexia' }, { id: 'atencao_hipoprosexia', label: 'Hipoprosexia' }, { id: 'atencao_hiperprosexia', label: 'Hiperprosexia / Hipervigilância' }, { id: 'memoria_preservada', label: 'Memória preservada' }, { id: 'memoria_hipomnesia_fixacao', label: 'Hipomnésia de fixação' }, { id: 'memoria_hipomnesia_evocacao', label: 'Hipomnésia de evocação' },
  ]},
  { id: 'insight', title: '10. Insight / Consciência da Enfermidade', instructions: 'Compreensão sobre dificuldades ou transtorno.', options: [
    { id: 'insight_preservado', label: 'Preservado' }, { id: 'insight_parcial', label: 'Parcial' }, { id: 'insight_ausente', label: 'Ausente / Negação do transtorno' },
  ]},
  { id: 'julgamento', title: '11. Julgamento e Crítica da Realidade', instructions: 'Decisões realistas, crítica e autoproteção.', options: [
    { id: 'julgamento_preservado', label: 'Conservado' }, { id: 'julgamento_comprometido', label: 'Prejudicado' }, { id: 'julgamento_parcial', label: 'Parcialmente prejudicado' },
  ]},
];

export function createInitialEemState(): NexusEemState {
  return {
    aparencia: ['higienizado', 'vestuario_adequado', 'aparente_idade'], atitude: ['cooperativo'], fala: ['fala_normal'], humor: ['eutimico'], afeto: ['normoemotivo'],
    pensamentoCurso: ['curso_normopsiquico'], pensamentoForma: ['forma_coerente'], pensamentoConteudo: ['conteudo_sem_alteracoes'], sensopercepcao: ['senso_sem_alteracoes'], orientacao: ['orientado_global'],
    atencaoMemoria: ['atencao_normoprosexica', 'memoria_preservada'], insight: ['insight_preservado'], julgamento: ['julgamento_preservado'], observacoesLivres: '',
  };
}

const normalVsAltered: Partial<Record<EemDomainKey, { normal: string; altered: string[] }>> = {
  atitude: { normal: 'cooperativo', altered: ['desconfiado','hostil','inhibido','agita_psicomotora','seductor_teatral'] },
  fala: { normal: 'fala_normal', altered: ['fala_lentificada','fala_acelerada','fala_baixo_volume','fala_disartrica','mutismo'] },
  humor: { normal: 'eutimico', altered: ['distimico','ansioso','euforico','disforico','apatico'] },
  afeto: { normal: 'normoemotivo', altered: ['embotado','labil','incongruente','hipomodulado'] },
  pensamentoCurso: { normal: 'curso_normopsiquico', altered: ['curso_bradipsiquico','curso_taquipsiquico','curso_bloqueio'] },
  pensamentoForma: { normal: 'forma_coerente', altered: ['forma_circunstancial','forma_tangencial','forma_fuga_ideias','forma_frouxidao'] },
  pensamentoConteudo: { normal: 'conteudo_sem_alteracoes', altered: ['conteudo_ruminacoes','conteudo_ideias_obsessivas','conteudo_ideacao_suicida','conteudo_delirio_perseguitorio','conteudo_delirio_grandeza','conteudo_delirio_ruina'] },
  sensopercepcao: { normal: 'senso_sem_alteracoes', altered: ['senso_alucinacao_auditiva','senso_alucinacao_visual','senso_ilusoes','senso_despersonalizacao'] },
};

export function toggleEemOption(state: NexusEemState, key: EemDomainKey, optionId: string): NexusEemState {
  const current = state[key];
  if (current.includes(optionId)) return { ...state, [key]: current.filter((id) => id !== optionId) };
  let next = [...current, optionId];

  if (key === 'aparencia') {
    const pairs = [['higienizado','desleixado'],['vestuario_adequado','vestuario_extravagante'],['aparente_idade','aparente_envelhecido']];
    for (const [a,b] of pairs) if (optionId === a) next = next.filter((id) => id !== b); else if (optionId === b) next = next.filter((id) => id !== a);
  }

  const rule = normalVsAltered[key];
  if (rule) {
    if (optionId === rule.normal) next = next.filter((id) => !rule.altered.includes(id));
    else if (rule.altered.includes(optionId)) next = next.filter((id) => id !== rule.normal);
  }

  if (key === 'fala') {
    if (optionId === 'fala_lentificada') next = next.filter((id) => id !== 'fala_acelerada');
    if (optionId === 'fala_acelerada') next = next.filter((id) => id !== 'fala_lentificada');
  }
  if (key === 'pensamentoCurso') {
    if (optionId === 'curso_bradipsiquico') next = next.filter((id) => id !== 'curso_taquipsiquico');
    if (optionId === 'curso_taquipsiquico') next = next.filter((id) => id !== 'curso_bradipsiquico');
  }
  if (key === 'orientacao') {
    if (optionId === 'orientado_global') next = ['orientado_global'];
    else {
      next = next.filter((id) => id !== 'orientado_global');
      if (optionId === 'orientado_autopsiquica') next = next.filter((id) => id !== 'desorientado_autopsiquica');
      if (optionId === 'desorientado_autopsiquica') next = next.filter((id) => id !== 'orientado_autopsiquica');
    }
  }
  if (key === 'atencaoMemoria') {
    if (optionId === 'atencao_normoprosexica') next = next.filter((id) => !['atencao_hipoprosexia','atencao_hiperprosexia'].includes(id));
    if (['atencao_hipoprosexia','atencao_hiperprosexia'].includes(optionId)) next = next.filter((id) => id !== 'atencao_normoprosexica');
    if (optionId === 'memoria_preservada') next = next.filter((id) => !['memoria_hipomnesia_fixacao','memoria_hipomnesia_evocacao'].includes(id));
    if (['memoria_hipomnesia_fixacao','memoria_hipomnesia_evocacao'].includes(optionId)) next = next.filter((id) => id !== 'memoria_preservada');
  }
  if (key === 'insight' || key === 'julgamento') next = [optionId];
  return { ...state, [key]: next };
}

function labels(domainKey: EemDomainKey, ids: string[]): string[] {
  const domain = EEM_DOMAINS.find((item) => item.id === domainKey);
  return ids.map((id) => domain?.options.find((option) => option.id === id)?.label).filter(Boolean) as string[];
}

export function generateEemNarrative(state: NexusEemState): string {
  const parts: string[] = [];
  const push = (title: string, key: EemDomainKey) => { const value = labels(key, state[key]); if (value.length) parts.push(`${title}: ${value.join(', ').toLowerCase()}`); };
  push('Aparência e Higiene', 'aparencia'); push('Atitude', 'atitude'); push('Fala e Linguagem', 'fala'); push('Humor', 'humor'); push('Afeto', 'afeto');
  const thought = [...labels('pensamentoCurso', state.pensamentoCurso), ...labels('pensamentoForma', state.pensamentoForma), ...labels('pensamentoConteudo', state.pensamentoConteudo)];
  if (thought.length) parts.push(`Pensamento: ${thought.join(', ').toLowerCase()}`);
  push('Sensopercepção', 'sensopercepcao'); push('Orientação (Auto e Alopsíquica)', 'orientacao'); push('Atenção, Concentração e Memória', 'atencaoMemoria'); push('Insight / Consciência de Mórbida', 'insight'); push('Julgamento e Crítica da Realidade', 'julgamento');
  if (state.observacoesLivres.trim()) parts.push(`Observações adicionais: ${state.observacoesLivres.trim()}`);
  return `EXAME DO ESTADO MENTAL (EEM)\n${parts.map((part) => `• ${part}.`).join('\n')}`;
}

export function eemRedFlags(state: NexusEemState): NexusScaleRedFlag[] {
  const flags: NexusScaleRedFlag[] = [];
  if (state.pensamentoConteudo.includes('conteudo_ideacao_suicida')) flags.push({ flagCode: 'eem.thought.suicidal-ideation', severity: 'critical', title: 'EEM: ideação suicida registrada', message: 'O conteúdo do pensamento registra ideação suicida/pensamentos de morte ou autolesão.', requiredAction: 'Avaliar segurança e estratificar risco; considerar C-SSRS conforme julgamento clínico.' });
  if (state.sensopercepcao.includes('senso_alucinacao_auditiva')) flags.push({ flagCode: 'eem.perception.auditory-hallucination', severity: 'warning', title: 'EEM: alucinação auditiva registrada', message: 'Há alteração sensoperceptiva auditiva registrada no exame.', requiredAction: 'Caracterizar conteúdo, comando, crítica e repercussão sobre segurança.' });
  return flags;
}
