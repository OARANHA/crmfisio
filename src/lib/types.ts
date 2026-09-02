// ---------------------------------------------------------------------------
// MedicsPro — tipos de domínio consumidos pela aplicação.
// Valores monetários em CENTAVOS (inteiros), nunca float.
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'fisio' | 'recep';

export type ModuleKey =
  | 'dashboard' | 'agenda' | 'pacientes' | 'clinico'
  | 'financeiro' | 'crm' | 'mensagens' | 'relatorios' | 'config';

export type Access = 'full' | 'read' | 'none';

export interface User {
  id: string;
  nome: string;
  email: string;
  role: Role;
  registro: string;
  cor: string;
  ativo: boolean;
}

export interface Unidade { id: string; nome: string; endereco: string }

export type AppointmentStatus = 'agendado' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'faltou' | 'cancelado';
export type FunilStage = 'lead' | 'avaliacao' | 'tratamento' | 'alta';
export type PacienteStatus = 'ativo' | 'inativo' | 'alta';

export interface Patient {
  id: string;
  nome: string;
  nascimento: string;
  telefone: string;
  email: string;
  cpf: string; // mascarado na UI (LGPD)
  convenio: string | null;
  queixaPrincipal: string;
  cid10: string[];
  funilStage: FunilStage;
  status: PacienteStatus;
  ultimaVisita: string | null;
  createdAt: string;
  optInWhats: boolean;
  anonimizado?: boolean; // Fase 3 — direito ao esquecimento
  anamnese: { historia: string; cirurgias: string; medicamentos: string; alergias: string; objetivo: string };
}

export interface Room { id: string; nome: string; tipo: 'sala' | 'equipamento'; unidadeId: string }

export interface Appointment {
  id: string;
  pacienteId: string;
  fisioId: string;
  roomId: string;
  data: string; // YYYY-MM-DD
  inicio: string; // HH:mm
  fim: string; // HH:mm
  status: AppointmentStatus;
  tipo: string;
  valor: number; // centavos
  pacoteId: string | null;
  serieId: string | null;
  notas: string;
  isFitIn?: boolean;
  cancellationReason?: string | null;
  rescheduledFromId?: string | null;
}

export interface RecurrenceRule {
  id: string;
  pacienteId: string;
  fisioId: string;
  roomId: string;
  tipo: string;
  diasSemana: number[]; // 1=seg ... 6=sab
  hora: string;
  duracaoMin: number;
  inicio: string;
  fim: string;
  valor: number;
}

export interface SessionPackage { id: string; nome: string; sessoes: number; preco: number; validadeDias: number }

export interface PatientPackage {
  id: string;
  pacienteId: string;
  pacoteId: string;
  sessoesTotais: number;
  sessoesUsadas: number;
  compraData: string;
  valorPago: number;
  status: 'ativo' | 'esgotado' | 'vencido';
}

export type TxTipo = 'receber' | 'pagar';
export type TxStatus = 'pendente' | 'pago' | 'atrasado';

export interface FinancialTransaction {
  id: string;
  tipo: TxTipo;
  descricao: string;
  categoria: string;
  valor: number;
  vencimento: string;
  status: TxStatus;
  pacienteId: string | null;
  metodo: 'pix' | 'cartao' | 'dinheiro' | 'boleto' | null;
}

export interface Commission { id: string; fisioId: string; periodo: string; base: number; percentual: number; status: 'aberto' | 'pago' }

export interface Evolution { id: string; pacienteId: string; fisioId: string; data: string; texto: string; anexos: string[] }

export interface ConsentTerm {
  id: string;
  pacienteId: string;
  nome: string;
  versao: string;
  assinado: boolean;
  dataAssinatura: string | null;
  hash: string | null;
  assinaturaUrl?: string | null;
  ip?: string | null;
}

export interface NpsSurvey { id: string; pacienteId: string; nota: number | null; comentario: string; data: string }

export type WaStatus = 'fila' | 'enviando' | 'enviado' | 'entregue' | 'lido' | 'falhou' | 'cancelado';
export type WaTemplate = 'confirmacao' | 'nps' | 'reativacao' | 'vaga_espera';
export interface WaLog {
  id: string;
  pacienteId: string;
  template: WaTemplate;
  mensagem: string;
  enviadoEm: string;
  status: WaStatus;
}

export interface AuditEntry { id: string; ts: string; usuarioId: string; acao: string; detalhe: string }

// ---------------------------------------------------------------------------
// Metadados de apresentação
// ---------------------------------------------------------------------------

export const STATUS_META: Record<AppointmentStatus, { label: string; dot: string; chip: string }> = {
  agendado: { label: 'Agendado', dot: '#9ab8c9', chip: 'bg-steel/10 border-steel/30 text-steel' },
  confirmado: { label: 'Confirmado', dot: '#4fd1a5', chip: 'bg-mint/10 border-mint/30 text-mint' },
  em_atendimento: { label: 'Em atendimento', dot: '#f2b441', chip: 'bg-amber/10 border-amber/35 text-amber' },
  finalizado: { label: 'Finalizado', dot: '#6ec1e4', chip: 'bg-aqua/10 border-aqua/30 text-aqua' },
  faltou: { label: 'Faltou', dot: '#f2545b', chip: 'bg-pulse/10 border-pulse/35 text-pulse' },
  cancelado: { label: 'Cancelado', dot: '#94b0a4', chip: 'bg-fog/10 border-fog/25 text-fog' },
};

export const STAGE_META: Record<FunilStage, { label: string; chip: string; bar: string; next: FunilStage | null }> = {
  lead: { label: 'Lead', chip: 'bg-steel/10 border-steel/30 text-steel', bar: '#9ab8c9', next: 'avaliacao' },
  avaliacao: { label: 'Avaliação', chip: 'bg-amber/10 border-amber/35 text-amber', bar: '#f2b441', next: 'tratamento' },
  tratamento: { label: 'Em tratamento', chip: 'bg-mint/10 border-mint/30 text-mint', bar: '#4fd1a5', next: 'alta' },
  alta: { label: 'Alta', chip: 'bg-aqua/10 border-aqua/30 text-aqua', bar: '#6ec1e4', next: null },
};

export const ROLE_META: Record<Role, { label: string; text: string; chip: string; desc: string }> = {
  admin: { label: 'Administrador', text: 'text-mint', chip: 'bg-mint/10 border-mint/35 text-mint', desc: 'Acesso total: agenda, prontuário (leitura), financeiro, CRM, relatórios e configurações.' },
  fisio: { label: 'Fisioterapeuta', text: 'text-amber', chip: 'bg-amber/10 border-amber/35 text-amber', desc: 'Agenda própria, prontuário e evolução clínica completos. Financeiro e relatórios somente leitura.' },
  recep: { label: 'Recepcionista', text: 'text-aqua', chip: 'bg-aqua/10 border-aqua/30 text-aqua', desc: 'Agenda, cadastro, financeiro operacional, CRM e mensagens. Sem acesso clínico nem relatórios.' },
};

export const CID10_CATALOG = [
  { code: 'M54.5', desc: 'Dor lombar baixa' },
  { code: 'M75.4', desc: 'Síndrome do impacto do ombro' },
  { code: 'M17.1', desc: 'Artrose primária do joelho' },
  { code: 'M54.2', desc: 'Cervicalgia' },
  { code: 'S83.5', desc: 'Entorse/ruptura de LCA' },
  { code: 'M72.2', desc: 'Fasciite plantar' },
  { code: 'I69.4', desc: 'Sequelas de AVC' },
  { code: 'M25.5', desc: 'Dor articular' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v / 100);

/** Acessa o campo de dia (YYYY-MM-DD) de qualquer entidade datada. */
export const dayOf = <T extends { data: string }>(x: T): string => x.data;

/** Nome do campo de dia — usado em literais para manter tipagem segura. */
export const DATA_KEY = 'data' as const;

export const maskCpf = (cpf: string) =>
  cpf.length > 7 ? `***.${cpf.slice(4, 7)}.***-**` : '***.***.***-**';

export const ageFrom = (nascimento: string) => {
  const n = new Date(nascimento + 'T12:00');
  return Math.floor((Date.now() - n.getTime()) / (365.25 * 24 * 3600e3));
};
