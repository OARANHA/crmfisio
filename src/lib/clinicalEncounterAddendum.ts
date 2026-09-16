import { supabase } from './supabaseClient';

export type ClinicalEncounterAddendumKind = 'addendum' | 'correction';

export type FinalizedEncounterRecordReference = {
  id: string;
  appointmentId: string;
  patientId: string;
  professionalId: string;
  evolutionId: string;
  finalizedAt: string;
};

export type ClinicalEncounterRecordAddendum = {
  id: string;
  encounterRecordId: string;
  appointmentId: string;
  patientId: string;
  evolutionId: string;
  originalProfessionalId: string;
  authorId: string;
  requestId: string;
  kind: ClinicalEncounterAddendumKind;
  reason: string;
  content: string;
  createdAt: string;
};

type FinalizedRecordRow = {
  id: string;
  appointment_id: string;
  patient_id: string;
  professional_id: string;
  evolution_id: string | null;
  finalized_at: string | null;
};

type AddendumRow = {
  id: string;
  encounter_record_id: string;
  appointment_id: string;
  patient_id: string;
  evolution_id: string;
  original_professional_id: string;
  author_id: string;
  request_id: string;
  kind: ClinicalEncounterAddendumKind;
  reason: string;
  content: string;
  created_at: string;
};

type AddendumContext = {
  records: FinalizedEncounterRecordReference[];
  addenda: ClinicalEncounterRecordAddendum[];
};

const client = supabase as any;
const mapRecord = (row: FinalizedRecordRow): FinalizedEncounterRecordReference | null => {
  if (!row.evolution_id || !row.finalized_at) return null;
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    evolutionId: row.evolution_id,
    finalizedAt: row.finalized_at,
  };
};

const mapAddendum = (row: AddendumRow): ClinicalEncounterRecordAddendum => ({
  id: row.id,
  encounterRecordId: row.encounter_record_id,
  appointmentId: row.appointment_id,
  patientId: row.patient_id,
  evolutionId: row.evolution_id,
  originalProfessionalId: row.original_professional_id,
  authorId: row.author_id,
  requestId: row.request_id,
  kind: row.kind,
  reason: row.reason,
  content: row.content,
  createdAt: row.created_at,
});

export async function loadClinicalEncounterAddendumContext(patientId: string): Promise<AddendumContext> {
  const [recordsResult, addendaResult] = await Promise.all([
    client
      .from('clinical_encounter_records')
      .select('id,appointment_id,patient_id,professional_id,evolution_id,finalized_at')
      .eq('patient_id', patientId)
      .eq('status', 'finalized')
      .order('finalized_at', { ascending: false }),
    client
      .from('clinical_encounter_record_addenda')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true }),
  ]);

  if (recordsResult.error) throw recordsResult.error;
  if (addendaResult.error) throw addendaResult.error;

  return {
    records: ((recordsResult.data ?? []) as FinalizedRecordRow[])
      .map(mapRecord)
      .filter((record): record is FinalizedEncounterRecordReference => record !== null),
    addenda: ((addendaResult.data ?? []) as AddendumRow[]).map(mapAddendum),
  };
}

export async function createClinicalEncounterRecordAddendum(
  encounterRecordId: string,
  requestId: string,
  kind: ClinicalEncounterAddendumKind,
  reason: string,
  content: string,
): Promise<ClinicalEncounterRecordAddendum> {
  const { data, error } = await client.rpc('create_clinical_encounter_record_addendum', {
    p_encounter_record_id: encounterRecordId,
    p_request_id: requestId,
    p_kind: kind,
    p_reason: reason,
    p_content: content,
  });
  if (error || !data) {
    throw error ?? new Error('Retificação/adendo sem confirmação do servidor.');
  }
  return mapAddendum(data as AddendumRow);
}

export type ClinicalEncounterAddendumErrorKind =
  | 'access_denied'
  | 'record_not_finalized'
  | 'idempotency_conflict'
  | 'invalid_content'
  | 'unknown';

export function classifyClinicalEncounterAddendumError(error: unknown): ClinicalEncounterAddendumErrorKind {
  const value = String(
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : error,
  ).toLowerCase();
  if (value.includes('clinical_encounter_addendum_idempotency_conflict')) return 'idempotency_conflict';
  if (value.includes('clinical_encounter_addendum_finalized_record_required')) return 'record_not_finalized';
  if (value.includes('clinical_encounter_addendum_content_required') || value.includes('clinical_encounter_addendum_kind_invalid')) {
    return 'invalid_content';
  }
  if (
    value.includes('42501')
    || value.includes('clinical_encounter_addendum_original_author_required')
    || value.includes('clinical_encounter_addendum_tenant_mismatch')
    || value.includes('capability_required')
    || value.includes('valid_identity_required')
  ) return 'access_denied';
  return 'unknown';
}
