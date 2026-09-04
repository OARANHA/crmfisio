import { supabase } from './supabaseClient';
import type { NexusClinicalResult } from './nexusClinical';

export type SoapSectionKey = 'subjective' | 'objective' | 'assessment' | 'plan';
export type ClinicalNoteStatus = 'draft' | 'signed';
export type ClinicalNoteImportStatus = 'proposed' | 'accepted' | 'rejected';

export type ClinicalNote = {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  appointmentId: string | null;
  status: ClinicalNoteStatus;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  structuredData: Record<string, unknown>;
  amendsNoteId: string | null;
  signedAt: string | null;
  signedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicalNoteImport = {
  id: string;
  clinicId: string;
  noteId: string;
  nexusResultId: string;
  targetSection: SoapSectionKey;
  suggestedText: string;
  status: ClinicalNoteImportStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
};

export type CreateClinicalNoteInput = {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  amendsNoteId?: string | null;
};

export type UpdateSoapInput = Partial<Pick<ClinicalNote, 'subjective' | 'objective' | 'assessment' | 'plan' | 'structuredData'>>;

const db = supabase as any;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const mapNote = (row: any): ClinicalNote => ({
  id: row.id,
  clinicId: row.clinic_id,
  patientId: row.patient_id,
  professionalId: row.professional_id,
  appointmentId: row.appointment_id ?? null,
  status: row.status,
  subjective: row.subjective ?? '',
  objective: row.objective ?? '',
  assessment: row.assessment ?? '',
  plan: row.plan ?? '',
  structuredData: asRecord(row.structured_data),
  amendsNoteId: row.amends_note_id ?? null,
  signedAt: row.signed_at ?? null,
  signedBy: row.signed_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapImport = (row: any): ClinicalNoteImport => ({
  id: row.id,
  clinicId: row.clinic_id,
  noteId: row.note_id,
  nexusResultId: row.nexus_result_id,
  targetSection: row.target_section,
  suggestedText: row.suggested_text,
  status: row.status,
  reviewedAt: row.reviewed_at ?? null,
  reviewedBy: row.reviewed_by ?? null,
  createdAt: row.created_at,
});

export async function createClinicalNote(input: CreateClinicalNoteInput): Promise<ClinicalNote> {
  const { data, error } = await db
    .from('clinical_notes')
    .insert({
      patient_id: input.patientId,
      professional_id: input.professionalId,
      appointment_id: input.appointmentId ?? null,
      amends_note_id: input.amendsNoteId ?? null,
      note_type: 'soap',
      status: 'draft',
    })
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível criar o prontuário SOAP.');
  return mapNote(data);
}

export async function updateClinicalNoteDraft(noteId: string, patch: UpdateSoapInput): Promise<ClinicalNote> {
  const updates: Record<string, unknown> = {};
  if (patch.subjective !== undefined) updates.subjective = patch.subjective;
  if (patch.objective !== undefined) updates.objective = patch.objective;
  if (patch.assessment !== undefined) updates.assessment = patch.assessment;
  if (patch.plan !== undefined) updates.plan = patch.plan;
  if (patch.structuredData !== undefined) updates.structured_data = patch.structuredData;

  const { data, error } = await db
    .from('clinical_notes')
    .update(updates)
    .eq('id', noteId)
    .eq('status', 'draft')
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível salvar o rascunho SOAP.');
  return mapNote(data);
}

export async function signClinicalNote(noteId: string): Promise<ClinicalNote> {
  const { data, error } = await db
    .from('clinical_notes')
    .update({ status: 'signed' })
    .eq('id', noteId)
    .eq('status', 'draft')
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível assinar o prontuário.');
  return mapNote(data);
}

export async function listPatientClinicalNotes(patientId: string): Promise<ClinicalNote[]> {
  const { data, error } = await db
    .from('clinical_notes')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapNote);
}

export async function getClinicalNoteForAppointment(appointmentId: string): Promise<ClinicalNote | null> {
  const { data, error } = await db
    .from('clinical_notes')
    .select('*')
    .eq('appointment_id', appointmentId)
    .is('amends_note_id', null)
    .maybeSingle();

  if (error) throw error;
  return data ? mapNote(data) : null;
}

export async function proposeNexusImport(
  noteId: string,
  result: NexusClinicalResult,
  targetSection: SoapSectionKey,
  suggestedText = result.soapText ?? '',
): Promise<ClinicalNoteImport> {
  const text = suggestedText.trim();
  if (!text) throw new Error('Resultado Nexus sem texto clínico para importar.');

  const { data, error } = await db
    .from('clinical_note_imports')
    .insert({
      note_id: noteId,
      nexus_result_id: result.id,
      target_section: targetSection,
      suggested_text: text,
      status: 'proposed',
    })
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível propor a importação Nexus.');
  return mapImport(data);
}

export async function listClinicalNoteImports(noteId: string): Promise<ClinicalNoteImport[]> {
  const { data, error } = await db
    .from('clinical_note_imports')
    .select('*')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapImport);
}

export async function acceptClinicalNoteImport(importId: string): Promise<ClinicalNote> {
  const { data, error } = await db.rpc('accept_clinical_note_import', { p_import_id: importId });
  if (error || !data) throw error ?? new Error('Não foi possível aceitar a contribuição Nexus.');
  return mapNote(data);
}

export async function rejectClinicalNoteImport(importId: string): Promise<void> {
  const { error } = await db.rpc('reject_clinical_note_import', { p_import_id: importId });
  if (error) throw error;
}
