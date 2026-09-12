import { supabase } from './supabaseClient';

export type ExamOrderPriority = 'routine' | 'high' | 'urgent';

export type ExamOrderItem = {
  examName: string;
  code: string;
  category: string;
  instructions: string;
  urgent: boolean;
};

export type ExamOrderPayload = {
  items: ExamOrderItem[];
  clinicalIndication: string;
  impression: string;
  priority: ExamOrderPriority;
  observations: string;
};

export type ExamOrderTemplate = {
  id: string;
  name: string;
  description: string;
  currentVersionId: string;
};

export type ExamOrderDocumentStatus = 'draft' | 'issued' | 'canceled';

export type ExamOrderDocument = {
  id: string;
  patientId: string;
  appointmentId: string;
  issuerId: string;
  templateId: string;
  templateVersionId: string;
  status: ExamOrderDocumentStatus;
  payload: ExamOrderPayload;
  payloadSnapshot: ExamOrderPayload | null;
  contextSnapshot: Record<string, unknown> | null;
  templateDefinitionSnapshot: Record<string, unknown> | null;
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
  status: ExamOrderDocumentStatus;
  payload: unknown;
  payload_snapshot: unknown;
  context_snapshot: Record<string, unknown> | null;
  template_definition_snapshot: Record<string, unknown> | null;
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

export const emptyExamOrderItem = (): ExamOrderItem => ({
  examName: '',
  code: '',
  category: '',
  instructions: '',
  urgent: false,
});

export const emptyExamOrderPayload = (): ExamOrderPayload => ({
  items: [emptyExamOrderItem()],
  clinicalIndication: '',
  impression: '',
  priority: 'routine',
  observations: '',
});

export function normalizeExamOrderPayload(value: unknown): ExamOrderPayload {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems.map((item) => {
    const row = item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    return {
      examName: trim(row.exam_name ?? row.examName),
      code: trim(row.code),
      category: trim(row.category),
      instructions: trim(row.instructions),
      urgent: row.urgent === true,
    };
  });
  const priority = source.priority === 'high' || source.priority === 'urgent' ? source.priority : 'routine';

  return {
    items: items.length > 0 ? items : [emptyExamOrderItem()],
    clinicalIndication: trim(source.clinical_indication ?? source.clinicalIndication),
    impression: trim(source.impression),
    priority,
    observations: trim(source.observations),
  };
}

export function serializeExamOrderPayload(payload: ExamOrderPayload): Record<string, unknown> {
  return {
    items: payload.items.map((item) => ({
      exam_name: item.examName.trim(),
      code: item.code.trim(),
      category: item.category.trim(),
      instructions: item.instructions.trim(),
      urgent: item.urgent,
    })),
    clinical_indication: payload.clinicalIndication.trim(),
    impression: payload.impression.trim(),
    priority: payload.priority,
    observations: payload.observations.trim(),
  };
}

export function examOrderReadyToIssue(payload: ExamOrderPayload): boolean {
  return payload.items.length > 0 && payload.items.every((item) => item.examName.trim().length > 0);
}

const mapTemplate = (row: TemplateRow): ExamOrderTemplate | null => row.current_version_id ? ({
  id: row.id,
  name: row.name,
  description: row.description,
  currentVersionId: row.current_version_id,
}) : null;

const mapDocument = (row: DocumentRow): ExamOrderDocument => ({
  id: row.id,
  patientId: row.patient_id,
  appointmentId: row.appointment_id,
  issuerId: row.issuer_id,
  templateId: row.template_id,
  templateVersionId: row.template_version_id,
  status: row.status,
  payload: normalizeExamOrderPayload(row.payload),
  payloadSnapshot: row.payload_snapshot ? normalizeExamOrderPayload(row.payload_snapshot) : null,
  contextSnapshot: row.context_snapshot,
  templateDefinitionSnapshot: row.template_definition_snapshot,
  renderedSnapshot: row.rendered_snapshot,
  rendererVersion: row.renderer_version,
  documentIdentifier: row.document_identifier,
  issuedAt: row.issued_at,
  canceledAt: row.canceled_at,
  cancelReason: row.cancel_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function canIssueExamOrder(): Promise<boolean> {
  const { data, error } = await db.rpc('current_user_can_issue_clinical_document', {
    p_document_type: 'exam_order',
  });
  if (error) throw error;
  return data === true;
}

export async function loadExamOrderTemplates(): Promise<ExamOrderTemplate[]> {
  const { data, error } = await db
    .from('clinical_document_templates')
    .select('id,name,description,current_version_id')
    .eq('document_type', 'exam_order')
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TemplateRow[])
    .map(mapTemplate)
    .filter((value): value is ExamOrderTemplate => Boolean(value));
}

export async function loadExamOrderDocuments(patientId: string): Promise<ExamOrderDocument[]> {
  const { data, error } = await db
    .from('clinical_documents')
    .select('id,patient_id,appointment_id,issuer_id,template_id,template_version_id,status,payload,payload_snapshot,context_snapshot,template_definition_snapshot,rendered_snapshot,renderer_version,document_identifier,issued_at,canceled_at,cancel_reason,created_at,updated_at')
    .eq('patient_id', patientId)
    .eq('document_type', 'exam_order')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DocumentRow[]).map(mapDocument);
}

export async function createExamOrderDraft(
  appointmentId: string,
  templateVersionId: string,
  payload: ExamOrderPayload = emptyExamOrderPayload(),
): Promise<ExamOrderDocument> {
  const { data, error } = await db.rpc('create_clinical_document_draft', {
    p_appointment_id: appointmentId,
    p_template_version_id: templateVersionId,
    p_payload: serializeExamOrderPayload(payload),
  });
  if (error || !data) throw error ?? new Error('Rascunho de pedido de exames sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function saveExamOrderDraft(
  documentId: string,
  payload: ExamOrderPayload,
): Promise<ExamOrderDocument> {
  const { data, error } = await db.rpc('save_clinical_document_draft', {
    p_document_id: documentId,
    p_payload: serializeExamOrderPayload(payload),
  });
  if (error || !data) throw error ?? new Error('Pedido de exames sem confirmação de salvamento do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function issueExamOrder(documentId: string): Promise<ExamOrderDocument> {
  const { data, error } = await db.rpc('issue_clinical_document', { p_document_id: documentId });
  if (error || !data) throw error ?? new Error('Emissão do pedido de exames sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function cancelExamOrder(documentId: string, reason: string): Promise<ExamOrderDocument> {
  const { data, error } = await db.rpc('cancel_clinical_document', {
    p_document_id: documentId,
    p_reason: reason.trim(),
  });
  if (error || !data) throw error ?? new Error('Cancelamento do pedido de exames sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export type ExamOrderErrorKind = 'eligibility' | 'active_encounter' | 'payload' | 'draft' | 'unknown';

export function classifyExamOrderError(error: unknown): ExamOrderErrorKind {
  const value = String(
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : error,
  ).toLowerCase();
  if (value.includes('clinical_document_eligibility_required') || value.includes('42501')) return 'eligibility';
  if (value.includes('clinical_document_own_active_encounter_required')) return 'active_encounter';
  if (value.includes('clinical_document_exam') || value.includes('clinical_document_payload')) return 'payload';
  if (value.includes('clinical_document_draft_required')) return 'draft';
  return 'unknown';
}

export function examOrderPriorityLabel(priority: ExamOrderPriority): string {
  if (priority === 'urgent') return 'Urgente';
  if (priority === 'high') return 'Prioridade alta';
  return 'Rotina';
}
