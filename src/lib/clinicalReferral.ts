import { supabase } from './supabaseClient';

export type ReferralPriority = 'routine' | 'high' | 'urgent';

export type ReferralRecipient = {
  professionalName: string;
  professionalType: string;
  specialty: string;
  service: string;
  facility: string;
  contact: string;
};

export type ReferralPayload = {
  recipient: ReferralRecipient;
  reason: string;
  clinicalSummary: string;
  requestedAction: string;
  priority: ReferralPriority;
  observations: string;
};

export type ReferralTemplate = {
  id: string;
  name: string;
  description: string;
  currentVersionId: string;
};

export type ReferralDocumentStatus = 'draft' | 'issued' | 'canceled';

export type ReferralDocument = {
  id: string;
  patientId: string;
  appointmentId: string;
  issuerId: string;
  templateId: string;
  templateVersionId: string;
  status: ReferralDocumentStatus;
  payload: ReferralPayload;
  payloadSnapshot: ReferralPayload | null;
  contextSnapshot: Record<string, unknown> | null;
  templateDefinitionSnapshot: Record<string, unknown> | null;
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
  status: ReferralDocumentStatus;
  payload: unknown;
  payload_snapshot: unknown;
  context_snapshot: Record<string, unknown> | null;
  template_definition_snapshot: Record<string, unknown> | null;
  rendered_snapshot: string | null;
  document_identifier: string;
  issued_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

const db = supabase as any;
const trim = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export const emptyReferralRecipient = (): ReferralRecipient => ({
  professionalName: '',
  professionalType: '',
  specialty: '',
  service: '',
  facility: '',
  contact: '',
});

export const emptyReferralPayload = (): ReferralPayload => ({
  recipient: emptyReferralRecipient(),
  reason: '',
  clinicalSummary: '',
  requestedAction: '',
  priority: 'routine',
  observations: '',
});

export function normalizeReferralPayload(value: unknown): ReferralPayload {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const recipientSource = source.recipient && typeof source.recipient === 'object' && !Array.isArray(source.recipient)
    ? source.recipient as Record<string, unknown>
    : {};
  const priority = source.priority === 'high' || source.priority === 'urgent' ? source.priority : 'routine';

  return {
    recipient: {
      professionalName: trim(recipientSource.professional_name ?? recipientSource.professionalName),
      professionalType: trim(recipientSource.professional_type ?? recipientSource.professionalType),
      specialty: trim(recipientSource.specialty),
      service: trim(recipientSource.service),
      facility: trim(recipientSource.facility),
      contact: trim(recipientSource.contact),
    },
    reason: trim(source.reason),
    clinicalSummary: trim(source.clinical_summary ?? source.clinicalSummary),
    requestedAction: trim(source.requested_action ?? source.requestedAction),
    priority,
    observations: trim(source.observations),
  };
}

export function serializeReferralPayload(payload: ReferralPayload): Record<string, unknown> {
  return {
    recipient: {
      professional_name: payload.recipient.professionalName.trim(),
      professional_type: payload.recipient.professionalType.trim(),
      specialty: payload.recipient.specialty.trim(),
      service: payload.recipient.service.trim(),
      facility: payload.recipient.facility.trim(),
      contact: payload.recipient.contact.trim(),
    },
    reason: payload.reason.trim(),
    clinical_summary: payload.clinicalSummary.trim(),
    requested_action: payload.requestedAction.trim(),
    priority: payload.priority,
    observations: payload.observations.trim(),
  };
}

export function referralReadyToIssue(payload: ReferralPayload): boolean {
  const recipient = payload.recipient;
  const hasRecipient = [
    recipient.professionalName,
    recipient.professionalType,
    recipient.specialty,
    recipient.service,
    recipient.facility,
  ].some((value) => value.trim().length > 0);
  return hasRecipient && payload.reason.trim().length > 0;
}

const mapTemplate = (row: TemplateRow): ReferralTemplate | null => row.current_version_id ? ({
  id: row.id,
  name: row.name,
  description: row.description,
  currentVersionId: row.current_version_id,
}) : null;

const mapDocument = (row: DocumentRow): ReferralDocument => ({
  id: row.id,
  patientId: row.patient_id,
  appointmentId: row.appointment_id,
  issuerId: row.issuer_id,
  templateId: row.template_id,
  templateVersionId: row.template_version_id,
  status: row.status,
  payload: normalizeReferralPayload(row.payload),
  payloadSnapshot: row.payload_snapshot ? normalizeReferralPayload(row.payload_snapshot) : null,
  contextSnapshot: row.context_snapshot,
  templateDefinitionSnapshot: row.template_definition_snapshot,
  renderedSnapshot: row.rendered_snapshot,
  documentIdentifier: row.document_identifier,
  issuedAt: row.issued_at,
  canceledAt: row.canceled_at,
  cancelReason: row.cancel_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function canIssueReferral(): Promise<boolean> {
  const { data, error } = await db.rpc('current_user_can_issue_clinical_document', {
    p_document_type: 'referral',
  });
  if (error) throw error;
  return data === true;
}

export async function loadReferralTemplates(): Promise<ReferralTemplate[]> {
  const { data, error } = await db
    .from('clinical_document_templates')
    .select('id,name,description,current_version_id')
    .eq('document_type', 'referral')
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TemplateRow[])
    .map(mapTemplate)
    .filter((value): value is ReferralTemplate => Boolean(value));
}

export async function loadReferralDocuments(patientId: string): Promise<ReferralDocument[]> {
  const { data, error } = await db
    .from('clinical_documents')
    .select('id,patient_id,appointment_id,issuer_id,template_id,template_version_id,status,payload,payload_snapshot,context_snapshot,template_definition_snapshot,rendered_snapshot,document_identifier,issued_at,canceled_at,cancel_reason,created_at,updated_at')
    .eq('patient_id', patientId)
    .eq('document_type', 'referral')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DocumentRow[]).map(mapDocument);
}

export async function createReferralDraft(
  appointmentId: string,
  templateVersionId: string,
  payload: ReferralPayload = emptyReferralPayload(),
): Promise<ReferralDocument> {
  const { data, error } = await db.rpc('create_clinical_document_draft', {
    p_appointment_id: appointmentId,
    p_template_version_id: templateVersionId,
    p_payload: serializeReferralPayload(payload),
  });
  if (error || !data) throw error ?? new Error('Rascunho de encaminhamento sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function saveReferralDraft(documentId: string, payload: ReferralPayload): Promise<ReferralDocument> {
  const { data, error } = await db.rpc('save_clinical_document_draft', {
    p_document_id: documentId,
    p_payload: serializeReferralPayload(payload),
  });
  if (error || !data) throw error ?? new Error('Encaminhamento sem confirmação de salvamento do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function issueReferral(documentId: string): Promise<ReferralDocument> {
  const { data, error } = await db.rpc('issue_clinical_document', { p_document_id: documentId });
  if (error || !data) throw error ?? new Error('Emissão do encaminhamento sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function cancelReferral(documentId: string, reason: string): Promise<ReferralDocument> {
  const { data, error } = await db.rpc('cancel_clinical_document', {
    p_document_id: documentId,
    p_reason: reason.trim(),
  });
  if (error || !data) throw error ?? new Error('Cancelamento do encaminhamento sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export type ReferralErrorKind = 'eligibility' | 'active_encounter' | 'payload' | 'draft' | 'unknown';

export function classifyReferralError(error: unknown): ReferralErrorKind {
  const value = String(
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : error,
  ).toLowerCase();
  if (value.includes('clinical_document_eligibility_required') || value.includes('42501')) return 'eligibility';
  if (value.includes('clinical_document_own_active_encounter_required')) return 'active_encounter';
  if (value.includes('clinical_document_referral') || value.includes('clinical_document_payload')) return 'payload';
  if (value.includes('clinical_document_draft_required')) return 'draft';
  return 'unknown';
}

export function referralPriorityLabel(priority: ReferralPriority): string {
  if (priority === 'urgent') return 'Urgente';
  if (priority === 'high') return 'Prioridade alta';
  return 'Rotina';
}
