import { supabase } from './supabaseClient';

export interface PackageCatalogItem {
  id: string;
  nome: string;
  sessoes: number;
  preco: number;
  validadeDias: number;
  descricao: string | null;
  ativo: boolean;
}

export interface PackageRenewalCandidate {
  patientPackageId: string;
  patientId: string;
  patientName: string;
  packageId: string;
  packageName: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  validUntil: string | null;
  daysToExpiry: number | null;
  riskReason: 'vencido' | 'saldo_baixo' | 'validade_proxima' | 'continuidade';
}

export interface SavePackageInput {
  id?: string | null;
  nome: string;
  sessoes: number;
  preco: number;
  validadeDias: number;
  descricao?: string | null;
  ativo?: boolean;
}

export interface SellPackageInput {
  patientId: string;
  packageId: string;
  dueDate: string;
  paymentStatus: 'pendente' | 'pago';
  paymentMethod: 'pix' | 'cartao' | 'dinheiro' | 'boleto' | null;
  renewedFromId?: string | null;
}

export async function loadPackageCatalog(): Promise<PackageCatalogItem[]> {
  const { data, error } = await supabase
    .from('session_packages')
    .select('id,nome,sessoes,preco,validade_dias,descricao,ativo')
    .order('ativo', { ascending: false })
    .order('nome');

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    nome: String(row.nome),
    sessoes: Number(row.sessoes),
    preco: Number(row.preco),
    validadeDias: Number(row.validade_dias),
    descricao: row.descricao ? String(row.descricao) : null,
    ativo: row.ativo !== false,
  }));
}

export async function loadPackageRenewalCandidates(): Promise<PackageRenewalCandidate[]> {
  const { data, error } = await supabase.rpc('get_package_renewal_candidates', {
    p_remaining_threshold: 2,
    p_expiry_days: 15,
  });
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    patientPackageId: String(row.patient_package_id),
    patientId: String(row.patient_id),
    patientName: String(row.patient_name),
    packageId: String(row.package_id),
    packageName: String(row.package_name),
    sessionsTotal: Number(row.sessions_total),
    sessionsUsed: Number(row.sessions_used),
    sessionsRemaining: Number(row.sessions_remaining),
    validUntil: row.valid_until ? String(row.valid_until) : null,
    daysToExpiry: row.days_to_expiry === null || row.days_to_expiry === undefined ? null : Number(row.days_to_expiry),
    riskReason: String(row.risk_reason) as PackageRenewalCandidate['riskReason'],
  }));
}

export async function upsertSessionPackage(input: SavePackageInput): Promise<void> {
  const { error } = await supabase.rpc('upsert_session_package', {
    p_id: input.id ?? null,
    p_nome: input.nome.trim(),
    p_sessoes: input.sessoes,
    p_preco: input.preco,
    p_validade_dias: input.validadeDias,
    p_descricao: input.descricao?.trim() || null,
    p_ativo: input.ativo ?? true,
  });
  if (error) throw error;
}

export async function sellSessionPackage(input: SellPackageInput): Promise<void> {
  const { error } = await supabase.rpc('sell_session_package', {
    p_patient_id: input.patientId,
    p_package_id: input.packageId,
    p_due_date: input.dueDate,
    p_payment_status: input.paymentStatus,
    p_payment_method: input.paymentStatus === 'pago' ? input.paymentMethod : null,
    p_renewed_from_id: input.renewedFromId ?? null,
  });
  if (error) throw error;
}
