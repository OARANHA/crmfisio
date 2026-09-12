import { supabase } from './supabaseClient';

export type MedicationPrescriptionItem = {
  medicationName: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
};

export type MedicationPrescriptionPayload = {
  items: MedicationPrescriptionItem[];
  observations: string;
};

export type MedicationPrescriptionTemplate = {
  id: string;
  name: string;
  description: string;
  currentVersionId: string;
};

export type ClinicalDocumentStatus = 'draft' | 'issued' | 'canceled';

export type MedicationPrescriptionDocument = {
  id: string;
  patientId: string;
  appointmentId: string;
  issuerId: string;
  templateId: string;
  templateVersionId: string;
  status: ClinicalDocumentStatus;
  payload: MedicationPrescriptionPayload;
  payloadSnapshot: MedicationPrescriptionPayload | null;
  contextSnapshot: Record<string, unknown> | null;
  renderedSnapshot: string | null;
  documentIdentifier: string;
  issuedAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type TemplateRow = {
  id: string;
  name: string;
  description: string;
  current_version_id: string | null;
};

type DocumentRow = {
  id: string;
  patient_id: string;
  appointment_id: string;
  issuer_id: string;
  template_id: string;
  template_version_id: string;
  status: ClinicalDocumentStatus;
  payload: unknown;
  payload_snapshot: unknown;
  context_snapshot: Record<string, unknown> | null;
  rendered_snapshot: string | null;
  document_identifier: string;
  issued_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

const db = supabase as any;

export const emptyMedicationPrescriptionItem = (): MedicationPrescriptionItem => ({
  medicationName: '',
  dose: '',
  route: '',
  frequency: '',
  duration: '',
  instructions: '',
});

export const emptyMedicationPrescriptionPayload = (): MedicationPrescriptionPayload => ({
  items: [emptyMedicationPrescriptionItem()],
  observations: '',
});

const trim = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function normalizeMedicationPrescriptionPayload(value: unknown): MedicationPrescriptionPayload {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      medicationName: trim(row.medication_name ?? row.medicationName),
      dose: trim(row.dose),
      route: trim(row.route),
      frequency: trim(row.frequency),
      duration: trim(row.duration),
      instructions: trim(row.instructions),
    };
  });
  return {
    items: items.length > 0 ? items : [emptyMedicationPrescriptionItem()],
    observations: trim(source.observations),
  };
}

export function serializeMedicationPrescriptionPayload(payload: MedicationPrescriptionPayload): Record<string, unknown> {
  return {
    items: payload.items.map((item) => ({
      medication_name: item.medicationName.trim(),
      dose: item.dose.trim(),
      route: item.route.trim(),
      frequency: item.frequency.trim(),
      duration: item.duration.trim(),
      instructions: item.instructions.trim(),
    })),
    observations: payload.observations.trim(),
  };
}

export function medicationPrescriptionReadyToIssue(payload: MedicationPrescriptionPayload): boolean {
  return payload.items.length > 0 && payload.items.every((item) => item.medicationName.trim().length > 0);
}

const mapTemplate = (row: TemplateRow): MedicationPrescriptionTemplate | null => row.current_version_id ? ({
  id: row.id,
  name: row.name,
  description: row.description,
  currentVersionId: row.current_version_id,
}) : null;

const mapDocument = (row: DocumentRow): MedicationPrescriptionDocument => ({
  id: row.id,
  patientId: row.patient_id,
  appointmentId: row.appointment_id,
  issuerId: row.issuer_id,
  templateId: row.template_id,
  templateVersionId: row.template_version_id,
  status: row.status,
  payload: normalizeMedicationPrescriptionPayload(row.payload),
  payloadSnapshot: row.payload_snapshot ? normalizeMedicationPrescriptionPayload(row.payload_snapshot) : null,
  contextSnapshot: row.context_snapshot,
  renderedSnapshot: row.rendered_snapshot,
  documentIdentifier: row.document_identifier,
  issuedAt: row.issued_at,
  canceledAt: row.canceled_at,
  cancelReason: row.cancel_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function canIssueMedicationPrescription(): Promise<boolean> {
  const { data, error } = await db.rpc('current_user_can_issue_clinical_document', {
    p_document_type: 'medication_prescription',
  });
  if (error) throw error;
  return data === true;
}

export async function loadMedicationPrescriptionTemplates(): Promise<MedicationPrescriptionTemplate[]> {
  const { data, error } = await db
    .from('clinical_document_templates')
    .select('id,name,description,current_version_id')
    .eq('document_type', 'medication_prescription')
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TemplateRow[])
    .map(mapTemplate)
    .filter((value): value is MedicationPrescriptionTemplate => Boolean(value));
}

export async function loadMedicationPrescriptionDocuments(patientId: string): Promise<MedicationPrescriptionDocument[]> {
  const { data, error } = await db
    .from('clinical_documents')
    .select('id,patient_id,appointment_id,issuer_id,template_id,template_version_id,status,payload,payload_snapshot,context_snapshot,rendered_snapshot,document_identifier,issued_at,canceled_at,cancel_reason,created_at,updated_at')
    .eq('patient_id', patientId)
    .eq('document_type', 'medication_prescription')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DocumentRow[]).map(mapDocument);
}

export async function createMedicationPrescriptionDraft(
  appointmentId: string,
  templateVersionId: string,
  payload: MedicationPrescriptionPayload = emptyMedicationPrescriptionPayload(),
): Promise<MedicationPrescriptionDocument> {
  const { data, error } = await db.rpc('create_clinical_document_draft', {
    p_appointment_id: appointmentId,
    p_template_version_id: templateVersionId,
    p_payload: serializeMedicationPrescriptionPayload(payload),
  });
  if (error || !data) throw error ?? new Error('Rascunho de prescrição sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function saveMedicationPrescriptionDraft(
  documentId: string,
  payload: MedicationPrescriptionPayload,
): Promise<MedicationPrescriptionDocument> {
  const { data, error } = await db.rpc('save_clinical_document_draft', {
    p_document_id: documentId,
    p_payload: serializeMedicationPrescriptionPayload(payload),
  });
  if (error || !data) throw error ?? new Error('Prescrição sem confirmação de salvamento do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function issueMedicationPrescription(documentId: string): Promise<MedicationPrescriptionDocument> {
  const { data, error } = await db.rpc('issue_clinical_document', { p_document_id: documentId });
  if (error || !data) throw error ?? new Error('Emissão sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function cancelMedicationPrescription(documentId: string, reason: string): Promise<MedicationPrescriptionDocument> {
  const { data, error } = await db.rpc('cancel_clinical_document', {
    p_document_id: documentId,
    p_reason: reason,
  });
  if (error || !data) throw error ?? new Error('Cancelamento sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export type ClinicalPrescriptionErrorKind = 'eligibility' | 'active_encounter' | 'payload' | 'draft' | 'unknown';

export function classifyClinicalPrescriptionError(error: unknown): ClinicalPrescriptionErrorKind {
  const value = String(
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : error,
  ).toLowerCase();
  if (value.includes('clinical_document_eligibility_required') || value.includes('42501')) return 'eligibility';
  if (value.includes('clinical_document_own_active_encounter_required')) return 'active_encounter';
  if (value.includes('clinical_document_medication_item') || value.includes('clinical_document_payload')) return 'payload';
  if (value.includes('clinical_document_draft_required')) return 'draft';
  return 'unknown';
}

export function prescriptionItemSummary(item: MedicationPrescriptionItem): string {
  return [item.dose, item.route, item.frequency, item.duration].map((value) => value.trim()).filter(Boolean).join(' · ');
}
