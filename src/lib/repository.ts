import { supabase } from './supabaseClient';
import type { Database, Json } from './database.types';
import type {
  Appointment,
  AuditEntry,
  ConsentTerm,
  Evolution,
  FinancialTransaction,
  NpsSurvey,
  Patient,
  PatientPackage,
  SessionPackage,
  User,
  WaLog,
} from './types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type PatientRow = Database['public']['Tables']['patients']['Row'];
type AppointmentRow = Database['public']['Tables']['appointments']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];
type EvolutionRow = Database['public']['Tables']['physiotherapy_evolutions']['Row'];
type ConsentRow = Database['public']['Tables']['consent_terms']['Row'];
type NpsRow = Database['public']['Tables']['nps_surveys']['Row'];
type PatientPackageRow = Database['public']['Tables']['patient_packages']['Row'];
type SessionPackageRow = Database['public']['Tables']['session_packages']['Row'];
type WaLogRow = Database['public']['Tables']['wa_logs']['Row'];
type AuditRow = Database['public']['Tables']['audit_log']['Row'];

const emptyAnamnese: Patient['anamnese'] = {
  historia: '',
  cirurgias: '',
  medicamentos: '',
  alergias: '',
  objetivo: '',
};

const parseAnamnese = (value: Json | null): Patient['anamnese'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyAnamnese;
  const v = value as Record<string, Json | undefined>;
  return {
    historia: typeof v.historia === 'string' ? v.historia : '',
    cirurgias: typeof v.cirurgias === 'string' ? v.cirurgias : '',
    medicamentos: typeof v.medicamentos === 'string' ? v.medicamentos : '',
    alergias: typeof v.alergias === 'string' ? v.alergias : '',
    objetivo: typeof v.objetivo === 'string' ? v.objetivo : '',
  };
};

export const mapProfile = (row: ProfileRow): User => ({
  id: row.id,
  nome: row.nome,
  email: row.email,
  role: row.role === 'owner' || row.role === 'financeiro' ? (row.role === 'owner' ? 'admin' : 'recep') : row.role,
  registro: row.registro ?? '',
  cor: row.cor ?? '#cbd5e1',
  ativo: row.ativo,
});

export const mapPatient = (row: PatientRow): Patient => ({
  id: row.id,
  nome: row.nome,
  nascimento: row.nascimento,
  telefone: row.telefone ?? '',
  email: row.email ?? '',
  cpf: row.cpf ?? '',
  convenio: row.convenio,
  queixaPrincipal: row.queixa_principal ?? '',
  cid10: row.cid10 ?? [],
  funilStage: row.funil_stage,
  status: row.status,
  ultimaVisita: row.ultima_visita,
  createdAt: row.created_at,
  optInWhats: row.opt_in_whats,
  anonimizado: row.anonimizado,
  anamnese: parseAnamnese(row.anamnese),
});

export const mapAppointment = (row: AppointmentRow): Appointment => ({
  id: row.id,
  pacienteId: row.paciente_id,
  fisioId: row.fisio_id,
  roomId: row.room_id ?? '',
  data: row.data,
  inicio: row.inicio.slice(0, 5),
  fim: row.fim.slice(0, 5),
  status: row.status,
  tipo: row.tipo,
  valor: row.valor,
  pacoteId: row.pacote_id,
  serieId: row.serie_id,
  notas: row.notas ?? '',
});

export const mapPayment = (row: PaymentRow): FinancialTransaction => ({
  id: row.id,
  tipo: row.tipo,
  descricao: row.descricao,
  categoria: row.categoria,
  valor: row.valor,
  vencimento: row.vencimento,
  status: row.status,
  pacienteId: row.patient_id,
  metodo: row.metodo,
});

const mapEvolution = (row: EvolutionRow): Evolution => ({
  id: row.id,
  pacienteId: row.patient_id,
  fisioId: row.professional_id,
  data: row.created_at.slice(0, 10),
  texto: row.texto,
  anexos: row.anexos ?? [],
});

const mapConsent = (row: ConsentRow): ConsentTerm => ({
  id: row.id,
  pacienteId: row.patient_id,
  nome: row.nome,
  versao: row.versao,
  assinado: row.assinado,
  dataAssinatura: row.data_assinatura,
  hash: row.hash,
  assinaturaUrl: row.assinatura_url,
  ip: row.ip,
});

const mapNps = (row: NpsRow): NpsSurvey => ({
  id: row.id,
  pacienteId: row.patient_id,
  nota: row.nota,
  comentario: row.comentario ?? '',
  data: row.data,
});

const mapPatientPackage = (row: PatientPackageRow): PatientPackage => ({
  id: row.id,
  pacienteId: row.patient_id,
  pacoteId: row.package_id,
  sessoesTotais: row.sessoes_totais,
  sessoesUsadas: row.sessoes_usadas,
  compraData: row.compra_data,
  valorPago: row.valor_pago,
  status: row.status,
});

const mapSessionPackage = (row: SessionPackageRow): SessionPackage => ({
  id: row.id,
  nome: row.nome,
  sessoes: row.sessoes,
  preco: row.preco,
  validadeDias: row.validade_dias,
});

const mapWaLog = (row: WaLogRow): WaLog => ({
  id: row.id,
  pacienteId: row.patient_id,
  template: row.template,
  mensagem: row.mensagem,
  enviadoEm: row.enviado_em,
  status: row.status,
});

const mapAudit = (row: AuditRow): AuditEntry => ({
  id: row.id,
  ts: row.ts,
  usuarioId: row.usuario_id,
  acao: row.acao,
  detalhe: row.detalhe,
});

export interface ClinicData {
  clinicId: string;
  users: User[];
  patients: Patient[];
  appointments: Appointment[];
  transactions: FinancialTransaction[];
  evolutions: Evolution[];
  consents: ConsentTerm[];
  surveys: NpsSurvey[];
  patientPackages: PatientPackage[];
  packages: SessionPackage[];
  waLogs: WaLog[];
  audit: AuditEntry[];
}

export async function resolveClinicId(userId: string): Promise<string> {
  const { data, error } = await supabase.from('profiles').select('clinic_id').eq('id', userId).single();
  if (error || !data?.clinic_id) throw error ?? new Error('Perfil sem clínica vinculada');
  return data.clinic_id;
}

const optionalRows = <T>(label: string, result: { data: T[] | null; error: unknown }): T[] => {
  if (result.error) {
    console.warn(`[MedicsPro] ${label} indisponível por enquanto:`, result.error);
    return [];
  }
  return result.data ?? [];
};

export async function loadClinicData(userId: string): Promise<ClinicData> {
  const clinicId = await resolveClinicId(userId);
  const [profiles, patients, appointments, payments, evolutions, consents, surveys, patientPackages, packages, waLogs, audit] = await Promise.all([
    supabase.from('profiles').select('*').eq('clinic_id', clinicId).eq('ativo', true).order('nome'),
    supabase.from('patients').select('*').eq('clinic_id', clinicId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('appointments').select('*').eq('clinic_id', clinicId).order('data', { ascending: false }),
    supabase.from('payments').select('*').eq('clinic_id', clinicId).order('vencimento', { ascending: false }),
    supabase.from('physiotherapy_evolutions').select('*').eq('clinic_id', clinicId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('consent_terms').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    supabase.from('nps_surveys').select('*').eq('clinic_id', clinicId).order('data', { ascending: false }),
    supabase.from('patient_packages').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    supabase.from('session_packages').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    supabase.from('wa_logs').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    supabase.from('audit_log').select('*').eq('clinic_id', clinicId).order('ts', { ascending: false }).limit(250),
  ]);

  const requiredFailure = [profiles.error, patients.error, appointments.error, payments.error].find(Boolean);
  if (requiredFailure) throw requiredFailure;

  return {
    clinicId,
    users: (profiles.data ?? []).map(mapProfile),
    patients: (patients.data ?? []).map(mapPatient),
    appointments: (appointments.data ?? []).map(mapAppointment),
    transactions: (payments.data ?? []).map(mapPayment),
    evolutions: optionalRows('evoluções', evolutions).map(mapEvolution),
    consents: optionalRows('consentimentos', consents).map(mapConsent),
    surveys: optionalRows('NPS', surveys).map(mapNps),
    patientPackages: optionalRows('pacotes de pacientes', patientPackages).map(mapPatientPackage),
    packages: optionalRows('catálogo de pacotes', packages).map(mapSessionPackage),
    waLogs: optionalRows('logs de comunicação', waLogs).map(mapWaLog),
    audit: optionalRows('auditoria', audit).map(mapAudit),
  };
}

export async function insertPatient(clinicId: string, patient: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> {
  const { data, error } = await supabase.from('patients').insert({
    clinic_id: clinicId,
    nome: patient.nome,
    nascimento: patient.nascimento,
    telefone: patient.telefone || null,
    email: patient.email || null,
    cpf: patient.cpf || null,
    convenio: patient.convenio,
    queixa_principal: patient.queixaPrincipal || null,
    cid10: patient.cid10,
    funil_stage: patient.funilStage,
    status: patient.status,
    ultima_visita: patient.ultimaVisita,
    opt_in_whats: patient.optInWhats,
    anonimizado: patient.anonimizado ?? false,
    anamnese: patient.anamnese as unknown as Json,
  }).select('*').single();
  if (error || !data) throw error ?? new Error('Falha ao cadastrar paciente');
  return mapPatient(data);
}

export async function updatePatientStage(id: string, stage: Patient['funilStage']): Promise<void> {
  const { error } = await supabase.from('patients').update({ funil_stage: stage }).eq('id', id);
  if (error) throw error;
}

export async function anonymizePatient(id: string): Promise<void> {
  const { error } = await supabase.from('patients').update({
    nome: 'Paciente Anonizado',
    cpf: null,
    telefone: null,
    email: null,
    queixa_principal: null,
    convenio: null,
    cid10: [],
    ultima_visita: null,
    opt_in_whats: false,
    status: 'inativo',
    anonimizado: true,
    anamnese: emptyAnamnese as unknown as Json,
  }).eq('id', id);
  if (error) throw error;
}

export async function insertAppointment(clinicId: string, appointment: Omit<Appointment, 'id'>): Promise<Appointment> {
  const { data, error } = await supabase.from('appointments').insert({
    clinic_id: clinicId,
    paciente_id: appointment.pacienteId,
    fisio_id: appointment.fisioId,
    room_id: appointment.roomId || null,
    data: appointment.data,
    inicio: appointment.inicio,
    fim: appointment.fim,
    status: appointment.status,
    tipo: appointment.tipo,
    valor: appointment.valor,
    pacote_id: appointment.pacoteId,
    serie_id: appointment.serieId,
    notas: appointment.notas || null,
  }).select('*').single();
  if (error || !data) throw error ?? new Error('Falha ao criar agendamento');
  return mapAppointment(data);
}

export async function updateAppointmentStatus(id: string, status: Appointment['status']): Promise<void> {
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function insertPayment(clinicId: string, payment: Omit<FinancialTransaction, 'id'>): Promise<FinancialTransaction> {
  const { data, error } = await supabase.from('payments').insert({
    clinic_id: clinicId,
    patient_id: payment.pacienteId,
    tipo: payment.tipo,
    descricao: payment.descricao,
    categoria: payment.categoria,
    valor: payment.valor,
    vencimento: payment.vencimento,
    status: payment.status,
    metodo: payment.metodo,
  }).select('*').single();
  if (error || !data) throw error ?? new Error('Falha ao criar lançamento');
  return mapPayment(data);
}

export async function updatePayment(id: string, status: FinancialTransaction['status'], metodo?: FinancialTransaction['metodo']): Promise<void> {
  const payload: Database['public']['Tables']['payments']['Update'] = { status };
  if (metodo !== undefined) payload.metodo = metodo;
  const { error } = await supabase.from('payments').update(payload).eq('id', id);
  if (error) throw error;
}

export async function insertEvolution(clinicId: string, evolution: Omit<Evolution, 'id'>): Promise<Evolution> {
  const { data, error } = await supabase.from('physiotherapy_evolutions').insert({
    clinic_id: clinicId,
    patient_id: evolution.pacienteId,
    professional_id: evolution.fisioId,
    texto: evolution.texto,
    anexos: evolution.anexos,
    created_at: evolution.data ? `${evolution.data}T12:00:00.000Z` : undefined,
  }).select('*').single();
  if (error || !data) throw error ?? new Error('Falha ao salvar evolução');
  return mapEvolution(data);
}

export async function updateConsent(id: string, assinaturaUrl?: string): Promise<void> {
  const { error } = await supabase.from('consent_terms').update({
    assinado: true,
    data_assinatura: new Date().toISOString(),
    assinatura_url: assinaturaUrl ?? null,
  }).eq('id', id);
  if (error) throw error;
}

export async function updateSurvey(id: string, nota: number): Promise<void> {
  const { error } = await supabase.from('nps_surveys').update({ nota }).eq('id', id);
  if (error) throw error;
}
