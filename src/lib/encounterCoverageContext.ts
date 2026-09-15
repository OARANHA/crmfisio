import { supabase } from './supabaseClient';

export type EncounterCoverageKind = 'private' | 'package';
export type EncounterCoverageState =
  | 'private_planned'
  | 'private_no_charge'
  | 'private_paid'
  | 'private_pending'
  | 'private_overdue'
  | 'package_reserved'
  | 'package_attention';

export interface EncounterCoverageContext {
  appointmentId: string;
  coverageKind: EncounterCoverageKind;
  coverageState: EncounterCoverageState;
  packageName: string | null;
  administrativeAttention: boolean;
}

interface EncounterCoverageRow {
  appointment_id: string;
  coverage_kind: string;
  coverage_state: string;
  package_name: string | null;
  administrative_attention: boolean;
}

const PRIVATE_STATES = new Set<EncounterCoverageState>(['private_planned', 'private_no_charge', 'private_paid', 'private_pending', 'private_overdue']);
const PACKAGE_STATES = new Set<EncounterCoverageState>(['package_reserved', 'package_attention']);

export function parseEncounterCoverageRow(row: EncounterCoverageRow, appointmentId: string): EncounterCoverageContext {
  const kind = row.coverage_kind as EncounterCoverageKind;
  const state = row.coverage_state as EncounterCoverageState;
  const validKind = kind === 'private' || kind === 'package';
  const validPair = kind === 'private' ? PRIVATE_STATES.has(state) : kind === 'package' ? PACKAGE_STATES.has(state) : false;
  if (!validKind || !validPair || row.appointment_id !== appointmentId || typeof row.administrative_attention !== 'boolean') {
    throw new Error('Cobertura contextual retornou um estado inválido.');
  }
  if (kind === 'private' && row.package_name !== null) {
    throw new Error('Cobertura particular retornou metadado de pacote inesperado.');
  }
  return {
    appointmentId: row.appointment_id,
    coverageKind: kind,
    coverageState: state,
    packageName: row.package_name,
    administrativeAttention: row.administrative_attention,
  };
}

export async function loadEncounterCoverageContext(appointmentId: string): Promise<EncounterCoverageContext> {
  const { data, error } = await supabase.rpc('get_encounter_coverage_context', { p_appointment_id: appointmentId });
  if (error) throw error;
  const row = (data as EncounterCoverageRow[] | null)?.[0];
  if (!row) throw new Error('Cobertura contextual indisponível.');
  return parseEncounterCoverageRow(row, appointmentId);
}

export interface EncounterCoveragePresentation {
  kindLabel: string;
  stateLabel: string;
  detail: string;
  tone: 'neutral' | 'success' | 'attention';
}

export function encounterCoveragePresentation(context: EncounterCoverageContext): EncounterCoveragePresentation {
  switch (context.coverageState) {
    case 'private_planned':
      return { kindLabel: 'Particular', stateLabel: 'Cobrança após conclusão', detail: 'O recebível é materializado somente depois da conclusão clínica.', tone: 'neutral' };
    case 'private_no_charge':
      return { kindLabel: 'Particular', stateLabel: 'Sem cobrança prevista', detail: 'Este atendimento não possui cobrança prevista no momento.', tone: 'neutral' };
    case 'private_paid':
      return { kindLabel: 'Particular', stateLabel: 'Pagamento registrado', detail: 'O estado deste atendimento está regularizado.', tone: 'success' };
    case 'private_pending':
      return { kindLabel: 'Particular', stateLabel: 'Cobrança pendente', detail: 'Há uma cobrança vinculada a este atendimento, sem ação financeira no Consultório.', tone: 'neutral' };
    case 'private_overdue':
      return { kindLabel: 'Particular', stateLabel: 'Atenção administrativa', detail: 'A equipe administrativa possui uma pendência deste atendimento para acompanhar.', tone: 'attention' };
    case 'package_reserved':
      return { kindLabel: 'Pacote', stateLabel: 'Sessão reservada', detail: 'A cobertura está reservada; o consumo é materializado somente na conclusão.', tone: 'success' };
    case 'package_attention':
      return { kindLabel: 'Pacote', stateLabel: 'Atenção administrativa', detail: 'A cobertura precisa de revisão administrativa. A conclusão clínica permanece independente.', tone: 'attention' };
  }
}
