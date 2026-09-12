import { supabase } from './supabaseClient';

export type TherapeuticGuidanceItem = {
  guidance: string;
};

export type TherapeuticGuidancePayload = {
  items: TherapeuticGuidanceItem[];
  patientInstructions: string;
  observations: string;
};

export type TherapeuticGuidanceTemplate = {
  id: string;
  name: string;
  description: string;
  currentVersionId: string;
};

export type TherapeuticGuidanceDocumentStatus = 'draft' | 'issued' | 'canceled';

export type TherapeuticGuidanceDocument = {
  id: string;
  patientId: string;
  appointmentId: string;
  issuerId: string;
  templateId: string;
  templateVersionId: string;
  status: TherapeuticGuidanceDocumentStatus;
  payload: TherapeuticGuidancePayload;
  payloadSnapshot: TherapeuticGuidancePayload | null;
  contextSnapshot: Record<string, unknown> | null;
  renderedSnapshot: string | null;
  rendererVersion: string | null;
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
  status: TherapeuticGuidanceDocumentStatus;
  payload: unknown;
  payload_snapshot: unknown;
  context_snapshot: Record<string, unknown> | null;
  rendered_snapshot: string | null;
  renderer_version: string | null;
  document_identifier: string;
  issued_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

const db = supabase as any;
const trim = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export const emptyTherapeuticGuidanceItem = (): TherapeuticGuidanceItem => ({ guidance: '' });

export const emptyTherapeuticGuidancePayload = (): TherapeuticGuidancePayload => ({
  items: [emptyTherapeuticGuidanceItem()],
  patientInstructions: '',
  observations: '',
});

export function normalizeTherapeuticGuidancePayload(value: unknown): TherapeuticGuidancePayload {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return { guidance: trim(row.guidance) };
  });

  return {
    items: items.length > 0 ? items : [emptyTherapeuticGuidanceItem()],
    patientInstructions: trim(source.patient_instructions ?? source.patientInstructions),
    observations: trim(source.observations),
  };
}

export function serializeTherapeuticGuidancePayload(payload: TherapeuticGuidancePayload): Record<string, unknown> {
  return {
    items: payload.items.map((item) => ({ guidance: item.guidance.trim() })),
    patient_instructions: payload.patientInstructions.trim(),
    observations: payload.observations.trim(),
  };
}

export function therapeuticGuidanceReadyToIssue(payload: TherapeuticGuidancePayload): boolean {
  return payload.items.length > 0 && payload.items.every((item) => item.guidance.trim().length > 0);
}

const mapTemplate = (row: TemplateRow): TherapeuticGuidanceTemplate | null => row.current_version_id ? ({
  id: row.id,
  name: row.name,
  description: row.description,
  currentVersionId: row.current_version_id,
}) : null;

const mapDocument = (row: DocumentRow): TherapeuticGuidanceDocument => ({
  id: row.id,
  patientId: row.patient_id,
  appointmentId: row.appointment_id,
  issuerId: row.issuer_id,
  templateId: row.template_id,
  templateVersionId: row.template_version_id,
  status: row.status,
  payload: normalizeTherapeuticGuidancePayload(row.payload),
  payloadSnapshot: row.payload_snapshot ? normalizeTherapeuticGuidancePayload(row.payload_snapshot) : null,
  contextSnapshot: row.context_snapshot,
  renderedSnapshot: row.rendered_snapshot,
  rendererVersion: row.renderer_version,
  documentIdentifier: row.document_identifier,
  issuedAt: row.issued_at,
  canceledAt: row.canceled_at,
  cancelReason: row.cancel_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function canIssueTherapeuticGuidance(): Promise<boolean> {
  const { data, error } = await db.rpc('current_user_can_issue_clinical_document', {
    p_document_type: 'therapeutic_guidance',
  });
  if (error) throw error;
  return data === true;
}

export async function loadTherapeuticGuidanceTemplates(): Promise<TherapeuticGuidanceTemplate[]> {
  const { data, error } = await db
    .from('clinical_document_templates')
    .select('id,name,description,current_version_id')
    .eq('document_type', 'therapeutic_guidance')
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TemplateRow[])
    .map(mapTemplate)
    .filter((value): value is TherapeuticGuidanceTemplate => Boolean(value));
}

export async function loadTherapeuticGuidanceDocuments(patientId: string): Promise<TherapeuticGuidanceDocument[]> {
  const { data, error } = await db
    .from('clinical_documents')
    .select('id,patient_id,appointment_id,issuer_id,template_id,template_version_id,status,payload,payload_snapshot,context_snapshot,rendered_snapshot,renderer_version,document_identifier,issued_at,canceled_at,cancel_reason,created_at,updated_at')
    .eq('patient_id', patientId)
    .eq('document_type', 'therapeutic_guidance')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DocumentRow[]).map(mapDocument);
}

export async function createTherapeuticGuidanceDraft(
  appointmentId: string,
  templateVersionId: string,
  payload: TherapeuticGuidancePayload = emptyTherapeuticGuidancePayload(),
): Promise<TherapeuticGuidanceDocument> {
  const { data, error } = await db.rpc('create_clinical_document_draft', {
    p_appointment_id: appointmentId,
    p_template_version_id: templateVersionId,
    p_payload: serializeTherapeuticGuidancePayload(payload),
  });
  if (error || !data) throw error ?? new Error('Rascunho de orientação sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function saveTherapeuticGuidanceDraft(
  documentId: string,
  payload: TherapeuticGuidancePayload,
): Promise<TherapeuticGuidanceDocument> {
  const { data, error } = await db.rpc('save_clinical_document_draft', {
    p_document_id: documentId,
    p_payload: serializeTherapeuticGuidancePayload(payload),
  });
  if (error || !data) throw error ?? new Error('Orientação sem confirmação de salvamento do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function issueTherapeuticGuidance(documentId: string): Promise<TherapeuticGuidanceDocument> {
  const { data, error } = await db.rpc('issue_clinical_document', { p_document_id: documentId });
  if (error || !data) throw error ?? new Error('Emissão sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export type TherapeuticGuidanceErrorKind = 'eligibility' | 'active_encounter' | 'payload' | 'draft' | 'unknown';

export function classifyTherapeuticGuidanceError(error: unknown): TherapeuticGuidanceErrorKind {
  const value = String(
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : error,
  ).toLowerCase();
  if (value.includes('clinical_document_eligibility_required') || value.includes('42501')) return 'eligibility';
  if (value.includes('clinical_document_own_active_encounter_required')) return 'active_encounter';
  if (value.includes('clinical_document_guidance_item') || value.includes('clinical_document_payload')) return 'payload';
  if (value.includes('clinical_document_draft_required')) return 'draft';
  return 'unknown';
}
