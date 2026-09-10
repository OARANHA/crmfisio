import { supabase } from './supabaseClient';

export type ClinicalEncounterRecordStatus = 'draft' | 'finalized';

export type ClinicalEncounterRecord = {
  id: string;
  clinicId: string;
  appointmentId: string;
  patientId: string;
  professionalId: string;
  reason: string;
  history: string;
  findings: string;
  assessment: string;
  plan: string;
  additionalNotes: string;
  status: ClinicalEncounterRecordStatus;
  revision: number;
  evolutionId: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
};

export type ClinicalEncounterRecordContent = Pick<
  ClinicalEncounterRecord,
  'reason' | 'history' | 'findings' | 'assessment' | 'plan' | 'additionalNotes'
>;

type EncounterRecordRow = {
  id: string;
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  professional_id: string;
  reason: string;
  history: string;
  findings: string;
  assessment: string;
  plan: string;
  additional_notes: string;
  status: ClinicalEncounterRecordStatus;
  revision: number;
  evolution_id: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

type SupabaseEncounterClient = {
  from: (table: 'clinical_encounter_records') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: EncounterRecordRow | null; error: unknown }>;
      };
    };
  };
  rpc: (
    name: 'save_clinical_encounter_record' | 'finalize_clinical_encounter_record',
    args: Record<string, unknown>,
  ) => Promise<{ data: EncounterRecordRow | null; error: unknown }>;
};

const client = supabase as unknown as SupabaseEncounterClient;

const mapRow = (row: EncounterRecordRow): ClinicalEncounterRecord => ({
  id: row.id,
  clinicId: row.clinic_id,
  appointmentId: row.appointment_id,
  patientId: row.patient_id,
  professionalId: row.professional_id,
  reason: row.reason,
  history: row.history,
  findings: row.findings,
  assessment: row.assessment,
  plan: row.plan,
  additionalNotes: row.additional_notes,
  status: row.status,
  revision: row.revision,
  evolutionId: row.evolution_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  finalizedAt: row.finalized_at,
});

export async function loadClinicalEncounterRecord(appointmentId: string): Promise<ClinicalEncounterRecord | null> {
  const { data, error } = await client
    .from('clinical_encounter_records')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function saveClinicalEncounterRecord(
  appointmentId: string,
  expectedRevision: number,
  content: ClinicalEncounterRecordContent,
): Promise<ClinicalEncounterRecord> {
  const { data, error } = await client.rpc('save_clinical_encounter_record', {
    p_appointment_id: appointmentId,
    p_expected_revision: expectedRevision,
    p_reason: content.reason,
    p_history: content.history,
    p_findings: content.findings,
    p_assessment: content.assessment,
    p_plan: content.plan,
    p_additional_notes: content.additionalNotes,
  });
  if (error || !data) throw error ?? new Error('Registro da consulta sem confirmação do servidor.');
  return mapRow(data);
}

export async function finalizeClinicalEncounterRecord(
  appointmentId: string,
  expectedRevision: number,
): Promise<ClinicalEncounterRecord> {
  const { data, error } = await client.rpc('finalize_clinical_encounter_record', {
    p_appointment_id: appointmentId,
    p_expected_revision: expectedRevision,
  });
  if (error || !data) throw error ?? new Error('Conclusão da consulta sem confirmação do servidor.');
  return mapRow(data);
}

export type ClinicalEncounterRecordErrorKind =
  | 'revision_conflict'
  | 'evolution_conflict'
  | 'legacy_evolution'
  | 'content_required'
  | 'access_denied'
  | 'unknown';

export function classifyClinicalEncounterRecordError(error: unknown): ClinicalEncounterRecordErrorKind {
  const value = String(
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : error,
  ).toLowerCase();
  if (value.includes('clinical_encounter_revision_conflict')) return 'revision_conflict';
  if (value.includes('clinical_encounter_evolution_conflict')) return 'evolution_conflict';
  if (value.includes('clinical_encounter_legacy_evolution_exists')) return 'legacy_evolution';
  if (value.includes('clinical_encounter_content_required')) return 'content_required';
  if (value.includes('42501') || value.includes('capability_required') || value.includes('access')) return 'access_denied';
  return 'unknown';
}

export function materializeClinicalEncounterEvolution(content: ClinicalEncounterRecordContent): string {
  const sections: Array<[string, string]> = [
    ['Motivo / demandas', content.reason],
    ['História atual', content.history],
    ['Achados / exame', content.findings],
    ['Avaliação clínica / problemas', content.assessment],
    ['Plano / conduta', content.plan],
    ['Observações', content.additionalNotes],
  ];
  return sections
    .map(([title, value]) => [title, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([title, value]) => `${title}\n${value}`)
    .join('\n\n');
}

export function clinicalEncounterRecordHasContent(content: ClinicalEncounterRecordContent): boolean {
  return materializeClinicalEncounterEvolution(content).trim().length > 0;
}
