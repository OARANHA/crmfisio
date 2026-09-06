import { supabase } from './supabaseClient';
import type { Database } from './database.types';
import type { AuditEntry, PatientPackage, SessionPackage, User, WaLog } from './types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type PatientPackageRow = Database['public']['Tables']['patient_packages']['Row'];
type SessionPackageRow = Database['public']['Tables']['session_packages']['Row'];
type WaLogRow = Database['public']['Tables']['wa_logs']['Row'];
type AuditRow = Database['public']['Tables']['audit_log']['Row'];

const mapProfile = (row: ProfileRow): User => ({
  id: row.id,
  nome: row.nome,
  email: row.email,
  role: row.role,
  registro: row.registro ?? '',
  cor: row.cor ?? '#cbd5e1',
  ativo: row.ativo,
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

const optionalRows = <T>(label: string, result: { data: T[] | null; error: unknown }): T[] => {
  if (result.error) {
    console.warn(`[MedicsPro] ${label} indisponível por enquanto:`, result.error);
    return [];
  }
  return result.data ?? [];
};

export interface ClinicShellData {
  clinicId: string;
  users: User[];
  patientPackages: PatientPackage[];
  packages: SessionPackage[];
  waLogs: WaLog[];
  audit: AuditEntry[];
}

/**
 * Carga residual do shell da clínica.
 *
 * Financeiro, Agenda, Pacientes e Clínico possuem providers próprios e não
 * devem voltar a ser carregados por este agregado. Este loader existe apenas
 * enquanto configuração/pacotes/comunicação/auditoria ainda não foram
 * extraídos para domínios independentes.
 */
export async function loadClinicShellData(userId: string): Promise<ClinicShellData> {
  const { data: caller, error: callerError } = await supabase
    .from('profiles')
    .select('clinic_id')
    .eq('id', userId)
    .eq('ativo', true)
    .single();

  if (callerError || !caller?.clinic_id) {
    throw callerError ?? new Error('Perfil sem clínica vinculada');
  }

  const clinicId = caller.clinic_id;
  const [profiles, patientPackages, packages, waLogs, audit] = await Promise.all([
    supabase.from('profiles').select('*').eq('clinic_id', clinicId).eq('ativo', true).order('nome'),
    supabase.from('patient_packages').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    supabase.from('session_packages').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    supabase.from('wa_logs').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    supabase.from('audit_log').select('*').eq('clinic_id', clinicId).order('ts', { ascending: false }).limit(250),
  ]);

  if (profiles.error) throw profiles.error;

  return {
    clinicId,
    users: (profiles.data ?? []).map(mapProfile),
    patientPackages: optionalRows('pacotes de pacientes', patientPackages).map(mapPatientPackage),
    packages: optionalRows('catálogo de pacotes', packages).map(mapSessionPackage),
    waLogs: optionalRows('logs de comunicação', waLogs).map(mapWaLog),
    audit: optionalRows('auditoria', audit).map(mapAudit),
  };
}
