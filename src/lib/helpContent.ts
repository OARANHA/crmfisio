import type { Role } from './types';

export type HelpContextKey = 'agenda' | 'pacientes' | 'atendimento' | 'financeiro' | 'crm' | 'mensagens' | 'relatorios';

export type HelpStep = {
  title: string;
  body: string;
  roles?: readonly Role[];
};

export type HelpContext = {
  key: HelpContextKey;
  eyebrow: string;
  title: string;
  summary: string;
  allowedRoles: readonly Role[];
  steps: HelpStep[];
  safetyNote?: string;
};

const ALL_CLINIC_ROLES: readonly Role[] = ['owner', 'admin', 'fisio', 'recep', 'financeiro'];
const MANAGERS_AND_RECEPTION: readonly Role[] = ['owner', 'admin', 'recep'];
const FINANCE_WRITERS: readonly Role[] = ['owner', 'admin', 'recep', 'financeiro'];
const REPORT_READERS: readonly Role[] = ['owner', 'admin', 'fisio', 'financeiro'];

const HELP_CONTEXTS: Record<HelpContextKey, HelpContext> = {
  agenda: {
    key: 'agenda',
    eyebrow: 'Ajuda · Agenda',
    title: 'Como usar a agenda com segurança',
    summary: 'A agenda organiza disponibilidade, confirmação, chegada e o handoff para o atendimento clínico sem perder o histórico da sessão.',
    allowedRoles: ALL_CLINIC_ROLES,
    steps: [
      { title: 'Localize a sessão correta', body: 'Use data, unidade, profissional e sala/recurso para confirmar que está operando o atendimento certo antes de alterar qualquer status.' },
      { title: 'Crie, remarque ou cancele com histórico', body: 'A recepção e a gestão devem usar os fluxos próprios de agendamento, remarcação e cancelamento. Evite criar atalhos manuais fora da agenda.', roles: MANAGERS_AND_RECEPTION },
      { title: 'Registre chegada e confirmação', body: 'Check-in e confirmação são etapas operacionais. Elas não substituem o início do atendimento pelo profissional responsável.', roles: MANAGERS_AND_RECEPTION },
      { title: 'Inicie somente sua própria sessão', body: 'O fisioterapeuta inicia apenas atendimentos atribuídos a ele. Ao iniciar, siga para o prontuário e registre a evolução antes de finalizar.', roles: ['fisio'] },
      { title: 'Consulta sem mutação clínica', body: 'Perfis com acesso somente de leitura podem consultar agenda e contexto operacional sem executar atos clínicos.', roles: ['financeiro'] },
    ],
    safetyNote: 'Finalização clínica deve acontecer no prontuário, depois da evolução vinculada à sessão.',
  },
  pacientes: {
    key: 'pacientes',
    eyebrow: 'Ajuda · Pacientes',
    title: 'Cadastro operacional e acesso ao paciente',
    summary: 'O cadastro básico pertence à clínica e serve para agenda, contato e operação. Conteúdo clínico sensível respeita a relação assistencial e o papel do usuário.',
    allowedRoles: ALL_CLINIC_ROLES,
    steps: [
      { title: 'Procure antes de cadastrar', body: 'Pesquise por nome, telefone ou documento antes de criar um novo paciente para reduzir duplicidades no prontuário e no financeiro.', roles: ['owner', 'admin', 'recep', 'fisio'] },
      { title: 'Mantenha o cadastro operacional objetivo', body: 'Use os campos administrativos para identificação, contato e convênio. Informações clínicas devem ficar no prontuário.', roles: ['owner', 'admin', 'recep', 'fisio'] },
      { title: 'Respeite o limite do prontuário', body: 'Ver o paciente na clínica não significa ter acesso automático ao conteúdo clínico. O sistema aplica o boundary de relação assistencial no backend.' },
      { title: 'Use o paciente como ponto de partida', body: 'A partir do cadastro, siga para agenda, documentos, pacotes ou prontuário somente quando essas funções estiverem disponíveis para seu papel.' },
    ],
    safetyNote: 'Não copie anamnese, evolução ou informações sensíveis para observações administrativas só para contornar permissões.',
  },
  atendimento: {
    key: 'atendimento',
    eyebrow: 'Ajuda · Atendimento',
    title: 'Sessão, prontuário e evolução no mesmo fluxo',
    summary: 'O atendimento clínico canônico acontece no workspace do paciente e mantém sessão, autoria, avaliações e evolução ligados ao mesmo contexto assistencial.',
    allowedRoles: ['owner', 'admin', 'fisio'],
    steps: [
      { title: 'Confirme a sessão em andamento', body: 'Verifique data, horário, tipo e profissional responsável. O fisioterapeuta só pode executar atos clínicos na própria sessão.' },
      { title: 'Revise o contexto clínico', body: 'Use resumo, avaliações e histórico para entender o estado atual antes de registrar nova conduta.' },
      { title: 'Use Avaliação padrão ou Minhas avaliações conscientemente', body: 'Modelos padrão mantêm um núcleo clínico comum. Avaliações próprias devem ser usadas quando a clínica realmente precisa de um instrumento adicional e o módulo estiver liberado.', roles: ['fisio'] },
      { title: 'Registre a evolução da sessão', body: 'Descreva achados, resposta ao tratamento, conduta, intercorrências, orientações e próximo plano. A evolução fica vinculada ao session_id.', roles: ['fisio'] },
      { title: 'Finalize somente depois do registro', body: 'O banco exige evolução vinculada antes da finalização. Se a sessão não for sua, a transição clínica é bloqueada.', roles: ['fisio'] },
      { title: 'Gestão acompanha sem assumir autoria clínica', body: 'Owner e administrador podem consultar o prontuário dentro das regras atuais, mas não devem produzir atos clínicos como se fossem o profissional responsável.', roles: ['owner', 'admin'] },
    ],
    safetyNote: 'Paciente pertence à clínica; o prontuário pertence ao contexto assistencial e permanece auditável.',
  },
  financeiro: {
    key: 'financeiro',
    eyebrow: 'Ajuda · Financeiro',
    title: 'Cobrança, baixa, pacotes e histórico financeiro',
    summary: 'O Financeiro registra o que a clínica tem a receber ou pagar, acompanha pacotes e protege liquidações contra edição silenciosa depois da baixa.',
    allowedRoles: ALL_CLINIC_ROLES,
    steps: [
      { title: 'Entenda o status antes de agir', body: 'Pendente significa ainda não liquidado; atrasado indica vencimento sem baixa; pago representa valor efetivamente recebido ou quitado.' },
      { title: 'Baixe somente quando o valor foi recebido', body: 'Use a baixa para refletir recebimento real. O lançamento pago preserva histórico e não deve ser corrigido por edição silenciosa.', roles: FINANCE_WRITERS },
      { title: 'Pacote não é o mesmo que lançamento avulso', body: 'Venda e renovação de pacote devem usar o fluxo próprio para preservar saldo de sessões, validade, vínculo do paciente e consumo automático.', roles: FINANCE_WRITERS },
      { title: 'Recepção opera recebíveis permitidos', body: 'A recepção pode executar operações financeiras autorizadas para cobrança do paciente, mas não ganha acesso a conteúdo clínico por isso.', roles: ['recep'] },
      { title: 'Profissional clínico consulta sem operar caixa', body: 'O fisioterapeuta possui leitura financeira conforme a matriz de acesso e não deve usar o módulo como usuário de caixa.', roles: ['fisio'] },
      { title: 'Exceções pré-pagas exigem resolução explícita', body: 'Cancelamentos com pagamento liquidado usam o fluxo de resolução financeira próprio, preservando o pagamento e registrando crédito, reembolso devido ou retenção.', roles: ['owner', 'admin', 'financeiro'] },
    ],
    safetyNote: 'Se o dinheiro ainda não entrou, não marque como pago apenas para “limpar” a pendência.',
  },
  crm: {
    key: 'crm',
    eyebrow: 'Ajuda · CRM',
    title: 'Jornada do paciente sem misturar CRM e prontuário',
    summary: 'O CRM acompanha relacionamento, continuidade e estágio operacional. Ele não substitui documentação clínica nem deve receber conteúdo de prontuário.',
    allowedRoles: ALL_CLINIC_ROLES,
    steps: [
      { title: 'Use o funil para estado operacional', body: 'Atualize o estágio para representar a jornada do paciente: captação, avaliação, tratamento, retenção ou outro estágio configurado pela operação.', roles: MANAGERS_AND_RECEPTION },
      { title: 'Fisioterapia e financeiro consultam sem mover o funil', body: 'Perfis read-only podem usar o contexto do CRM para entender a jornada, mas a mutação do funil permanece com gestão e recepção.', roles: ['fisio', 'financeiro'] },
      { title: 'Sinais de risco são apoio operacional', body: 'Risco de churn e continuidade são regras explicáveis para priorizar contato. Não são diagnóstico clínico nem previsão probabilística garantida.' },
      { title: 'Leve a conversa para o canal certo', body: 'Quando houver ação de contato, use a central de Mensagens/WhatsApp e preserve o histórico operacional em vez de registrar conversa solta no prontuário.', roles: ['owner', 'admin', 'recep'] },
    ],
    safetyNote: 'Não use o CRM para armazenar anamnese, hipótese diagnóstica, evolução ou outros dados clínicos sensíveis.',
  },
  mensagens: {
    key: 'mensagens',
    eyebrow: 'Ajuda · WhatsApp',
    title: 'Mensagens com rastreabilidade e sem retry cego',
    summary: 'A central mostra fila, envio, entrega, leitura, resposta e falhas. Casos de entrega incerta exigem cautela para não duplicar contato com o paciente.',
    allowedRoles: ALL_CLINIC_ROLES,
    steps: [
      { title: 'Diferencie fila, envio e entrega', body: 'Fila ainda aguarda processamento; enviado indica aceite conhecido pelo provedor; entregue/lido dependem de eventos posteriores do WhatsApp.' },
      { title: 'Resultado incerto não é falha definitiva', body: 'DELIVERY_UNCERTAIN significa que o sistema não conseguiu provar se o envio chegou ao provedor. Não reenvie automaticamente.', roles: ['owner', 'admin', 'recep'] },
      { title: 'Observe reconciliações', body: 'Quando um evento posterior identifica com segurança um único envio incerto, a central marca a reconciliação sem repetir a mensagem.' },
      { title: 'Use revisão humana quando necessário', body: 'Mensagens sensíveis, campanhas de reativação e situações ambíguas devem permanecer sob revisão operacional conforme o fluxo disponível.', roles: ['owner', 'admin', 'recep'] },
      { title: 'Perfis de leitura acompanham sem disparar ações', body: 'Fisioterapia e financeiro podem consultar o contexto permitido sem transformar o módulo em canal de envio não autorizado.', roles: ['fisio', 'financeiro'] },
    ],
    safetyNote: 'Nunca interprete DELIVERY_UNCERTAIN como autorização para reenviar a mesma mensagem automaticamente.',
  },
  relatorios: {
    key: 'relatorios',
    eyebrow: 'Ajuda · Relatórios',
    title: 'Leia indicadores sem confundir operação com resultado financeiro',
    summary: 'Os relatórios combinam agenda, financeiro, NPS, recuperação e continuidade. Cada indicador deve ser lido conforme sua fonte e período.',
    allowedRoles: REPORT_READERS,
    steps: [
      { title: 'NPS usa a escala padrão', body: 'Promotores menos detratores gera um NPS entre -100 e +100. A média das notas 0–10 é uma métrica diferente.' },
      { title: 'Sem amostra não significa 100%', body: 'Indicadores sem eventos válidos aparecem sem percentual em vez de inventar uma taxa perfeita.' },
      { title: 'Realizado e pipeline são diferentes', body: 'Valor realizado corresponde a eventos já realizados; pipeline representa potencial ainda sujeito a conversão e recebimento. Eles não devem ser somados como receita.' },
      { title: 'Risco atual não é retenção histórica', body: 'O snapshot de continuidade ajuda a priorizar operação, mas não prova retenção histórica nem causalidade de automação.' },
    ],
    safetyNote: 'Use os relatórios para decisão operacional; para conciliação financeira, a fonte de verdade continua sendo o Financeiro.',
  },
};

const filterForRole = (context: HelpContext, role: Role): HelpContext | null => {
  if (!context.allowedRoles.includes(role)) return null;
  return { ...context, steps: context.steps.filter((step) => !step.roles || step.roles.includes(role)) };
};

export function resolveHelpContext(pathname: string, role: Role): HelpContext | null {
  if (pathname === '/agenda' || pathname === '/hoje' || pathname.startsWith('/agenda/')) return filterForRole(HELP_CONTEXTS.agenda, role);
  if (pathname === '/pacientes' || pathname.startsWith('/pacientes?')) return filterForRole(HELP_CONTEXTS.pacientes, role);
  if (pathname.startsWith('/pacientes/')) return filterForRole(HELP_CONTEXTS.atendimento, role) ?? filterForRole(HELP_CONTEXTS.pacientes, role);
  if (pathname === '/financeiro' || pathname.startsWith('/financeiro/')) return filterForRole(HELP_CONTEXTS.financeiro, role);
  if (pathname === '/crm' || pathname.startsWith('/crm/')) return filterForRole(HELP_CONTEXTS.crm, role);
  if (pathname === '/mensagens' || pathname.startsWith('/mensagens/')) return filterForRole(HELP_CONTEXTS.mensagens, role);
  if (pathname === '/relatorios' || pathname.startsWith('/relatorios/')) return filterForRole(HELP_CONTEXTS.relatorios, role);
  return null;
}
