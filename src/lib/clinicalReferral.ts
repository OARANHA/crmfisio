import { supabase } from './supabaseClient';

export type ReferralPriority = 'routine' | 'high' | 'urgent';
export type ReferralRecipientScope = 'external' | 'internal_professional' | 'internal_service';

export type ReferralRecipient = {
  scope: ReferralRecipientScope;
  targetProfileId: string;
  professionalName: string;
  professionalType: string;
  specialty: string;
  service: string;
  facility: string;
  contact: string;
};

export type ReferralInternalTarget = {
  profileId: string;
  name: string;
  professionalType: string;
  specialty: string;
  councilType: string;
  councilState: string;
  registration: string;
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
  renderDefinition: Record<string, unknown>;
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
  rendererVersion: string | null;
  documentIdentifier: string;
  issuedAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type TemplateRow = { id: string; name: string; description: string; current_version_id: string | null };
type TemplateVersionRow = { id: string; render_definition: unknown };
type InternalTargetRow = {
  profile_id: string;
  name: string;
  professional_type: string | null;
  specialty: string | null;
  council_type: string | null;
  council_state: string | null;
  registration: string | null;
};
type DocumentRow = {
  id: string; patient_id: string; appointment_id: string; issuer_id: string; template_id: string;
  template_version_id: string; status: ReferralDocumentStatus; payload: unknown; payload_snapshot: unknown;
  context_snapshot: Record<string, unknown> | null; template_definition_snapshot: Record<string, unknown> | null;
  rendered_snapshot: string | null; renderer_version: string | null; document_identifier: string;
  issued_at: string | null; canceled_at: string | null; cancel_reason: string | null; created_at: string; updated_at: string;
};

const db = supabase as any;
const trim = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const asObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);
const normalizeProfessionalTypeToken = (value: unknown): string => trim(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const INTERNAL_PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  fisioterapeuta: 'Fisioterapeuta',
  medico: 'Médico',
  psicologo: 'Psicólogo',
  quiropraxista: 'Quiropraxista',
};

export function referralProfessionalTypeLabel(value: unknown): string {
  const raw = trim(value);
  if (!raw) return '';
  return INTERNAL_PROFESSIONAL_TYPE_LABELS[normalizeProfessionalTypeToken(raw)] ?? raw;
}

function serializeInternalProfessionalType(value: unknown): string {
  const raw = trim(value);
  if (!raw) return '';
  const token = normalizeProfessionalTypeToken(raw);
  return Object.prototype.hasOwnProperty.call(INTERNAL_PROFESSIONAL_TYPE_LABELS, token) ? token : raw;
}

export const emptyReferralRecipient = (): ReferralRecipient => ({
  scope: 'external', targetProfileId: '', professionalName: '', professionalType: '', specialty: '', service: '', facility: '', contact: '',
});

export const emptyReferralPayload = (): ReferralPayload => ({
  recipient: emptyReferralRecipient(), reason: '', clinicalSummary: '', requestedAction: '', priority: 'routine', observations: '',
});

export function normalizeReferralPayload(value: unknown): ReferralPayload {
  const source = asObject(value);
  const recipientSource = asObject(source.recipient);
  const rawScope = trim(source.destination_scope ?? recipientSource.scope);
  const scope: ReferralRecipientScope = rawScope === 'internal_professional' || rawScope === 'internal_service' ? rawScope : 'external';
  const priority = source.priority === 'high' || source.priority === 'urgent' ? source.priority : 'routine';
  const rawProfessionalType = trim(recipientSource.professional_type ?? recipientSource.professionalType);
  return {
    recipient: {
      scope,
      targetProfileId: trim(source.target_profile_id ?? recipientSource.target_profile_id ?? recipientSource.targetProfileId),
      professionalName: trim(recipientSource.professional_name ?? recipientSource.professionalName),
      professionalType: scope === 'external' ? rawProfessionalType : referralProfessionalTypeLabel(rawProfessionalType),
      specialty: trim(recipientSource.specialty), service: trim(recipientSource.service), facility: trim(recipientSource.facility), contact: trim(recipientSource.contact),
    },
    reason: trim(source.reason), clinicalSummary: trim(source.clinical_summary ?? source.clinicalSummary),
    requestedAction: trim(source.requested_action ?? source.requestedAction), priority, observations: trim(source.observations),
  };
}

export function serializeReferralPayload(payload: ReferralPayload): Record<string, unknown> {
  const professionalType = payload.recipient.scope === 'external'
    ? payload.recipient.professionalType.trim()
    : serializeInternalProfessionalType(payload.recipient.professionalType);
  return {
    destination_scope: payload.recipient.scope,
    target_profile_id: payload.recipient.targetProfileId.trim(),
    recipient: {
      professional_name: payload.recipient.professionalName.trim(),
      professional_type: professionalType,
      specialty: payload.recipient.specialty.trim(), service: payload.recipient.service.trim(),
      facility: payload.recipient.facility.trim(), contact: payload.recipient.contact.trim(),
    },
    reason: payload.reason.trim(), clinical_summary: payload.clinicalSummary.trim(),
    requested_action: payload.requestedAction.trim(), priority: payload.priority, observations: payload.observations.trim(),
  };
}

export function referralReadyToIssue(payload: ReferralPayload): boolean {
  const recipient = payload.recipient;
  if (!payload.reason.trim()) return false;
  if (recipient.scope === 'internal_professional') return Boolean(recipient.targetProfileId.trim() && recipient.professionalName.trim());
  if (recipient.scope === 'internal_service') return Boolean(recipient.specialty.trim() || recipient.service.trim() || recipient.professionalType.trim());
  return [recipient.professionalName, recipient.professionalType, recipient.specialty, recipient.service, recipient.facility].some((item) => item.trim().length > 0);
}

const mapTemplate = (row: TemplateRow, renderDefinition: Record<string, unknown>): ReferralTemplate | null => row.current_version_id ? ({
  id: row.id, name: row.name, description: row.description, currentVersionId: row.current_version_id, renderDefinition,
}) : null;

const mapDocument = (row: DocumentRow): ReferralDocument => ({
  id: row.id, patientId: row.patient_id, appointmentId: row.appointment_id, issuerId: row.issuer_id,
  templateId: row.template_id, templateVersionId: row.template_version_id, status: row.status,
  payload: normalizeReferralPayload(row.payload), payloadSnapshot: row.payload_snapshot ? normalizeReferralPayload(row.payload_snapshot) : null,
  contextSnapshot: row.context_snapshot, templateDefinitionSnapshot: row.template_definition_snapshot,
  renderedSnapshot: row.rendered_snapshot, rendererVersion: row.renderer_version, documentIdentifier: row.document_identifier,
  issuedAt: row.issued_at, canceledAt: row.canceled_at, cancelReason: row.cancel_reason, createdAt: row.created_at, updatedAt: row.updated_at,
});

export async function canIssueReferral(): Promise<boolean> {
  const { data, error } = await db.rpc('current_user_can_issue_clinical_document', { p_document_type: 'referral' });
  if (error) throw error;
  return data === true;
}

export async function loadReferralInternalTargets(): Promise<ReferralInternalTarget[]> {
  const { data, error } = await db.rpc('list_clinical_referral_internal_targets');
  if (error) throw error;
  return ((data ?? []) as InternalTargetRow[]).map((row) => ({
    profileId: row.profile_id, name: row.name, professionalType: referralProfessionalTypeLabel(row.professional_type), specialty: trim(row.specialty),
    councilType: trim(row.council_type), councilState: trim(row.council_state), registration: trim(row.registration),
  }));
}

export async function loadReferralTemplates(): Promise<ReferralTemplate[]> {
  const { data, error } = await db.from('clinical_document_templates').select('id,name,description,current_version_id')
    .eq('document_type', 'referral').eq('status', 'active').order('name', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as TemplateRow[];
  const versionIds = rows.map((row) => row.current_version_id).filter((value): value is string => Boolean(value));
  const renderByVersion = new Map<string, Record<string, unknown>>();
  if (versionIds.length > 0) {
    const { data: versions, error: versionError } = await db.from('clinical_document_template_versions').select('id,render_definition').in('id', versionIds);
    if (versionError) throw versionError;
    for (const version of (versions ?? []) as TemplateVersionRow[]) renderByVersion.set(version.id, asObject(version.render_definition));
  }
  return rows.map((row) => mapTemplate(row, row.current_version_id ? renderByVersion.get(row.current_version_id) ?? {} : {})).filter((value): value is ReferralTemplate => Boolean(value));
}

export async function loadReferralTemplateRenderDefinition(versionId: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.from('clinical_document_template_versions').select('id,render_definition').eq('id', versionId).single();
  if (error || !data) throw error ?? new Error('Versão do modelo de encaminhamento não encontrada.');
  return asObject((data as TemplateVersionRow).render_definition);
}

export async function loadReferralDocuments(patientId: string): Promise<ReferralDocument[]> {
  const { data, error } = await db.from('clinical_documents')
    .select('id,patient_id,appointment_id,issuer_id,template_id,template_version_id,status,payload,payload_snapshot,context_snapshot,template_definition_snapshot,rendered_snapshot,renderer_version,document_identifier,issued_at,canceled_at,cancel_reason,created_at,updated_at')
    .eq('patient_id', patientId).eq('document_type', 'referral').order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DocumentRow[]).map(mapDocument);
}

export async function createReferralDraft(appointmentId: string, templateVersionId: string, payload: ReferralPayload = emptyReferralPayload()): Promise<ReferralDocument> {
  const { data, error } = await db.rpc('create_clinical_document_draft', { p_appointment_id: appointmentId, p_template_version_id: templateVersionId, p_payload: serializeReferralPayload(payload) });
  if (error || !data) throw error ?? new Error('Rascunho de encaminhamento sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function saveReferralDraft(documentId: string, payload: ReferralPayload): Promise<ReferralDocument> {
  const { data, error } = await db.rpc('save_clinical_document_draft', { p_document_id: documentId, p_payload: serializeReferralPayload(payload) });
  if (error || !data) throw error ?? new Error('Encaminhamento sem confirmação de salvamento do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function issueReferral(documentId: string): Promise<ReferralDocument> {
  const { data, error } = await db.rpc('issue_clinical_document', { p_document_id: documentId });
  if (error || !data) throw error ?? new Error('Emissão do encaminhamento sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export async function cancelReferral(documentId: string, reason: string): Promise<ReferralDocument> {
  const { data, error } = await db.rpc('cancel_clinical_document', { p_document_id: documentId, p_reason: reason.trim() });
  if (error || !data) throw error ?? new Error('Cancelamento do encaminhamento sem confirmação do servidor.');
  return mapDocument(data as DocumentRow);
}

export function referralDocumentRenderDefinition(document: ReferralDocument): unknown {
  const snapshot = document.templateDefinitionSnapshot;
  return snapshot && typeof snapshot === 'object' ? snapshot.render_definition : null;
}

export type ReferralErrorKind = 'eligibility' | 'active_encounter' | 'payload' | 'draft' | 'target' | 'unknown';
export function classifyReferralError(error: unknown): ReferralErrorKind {
  const value = String(typeof error === 'object' && error !== null && 'message' in error ? (error as { message?: unknown }).message : error).toLowerCase();
  if (value.includes('clinical_referral_target_invalid') || value.includes('clinical_referral_internal_service_invalid')) return 'target';
  if (value.includes('clinical_referral_internal_service_required')) return 'payload';
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
