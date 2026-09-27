import { supabase } from './supabaseClient';

export type CommercialCrmStageKind = 'open' | 'won' | 'lost';

export interface CommercialCrmPipeline {
  id: string;
  name: string;
  isDefault: boolean;
  archivedAt: string | null;
}

export interface CommercialCrmStage {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  stageKind: CommercialCrmStageKind;
  archivedAt: string | null;
}

export interface CommercialCrmLead {
  id: string;
  title: string;
  valueCents: number | null;
  source: string | null;
  lostReasonCode: string | null;
  lostReasonDetail: string | null;
  closedAt: string | null;
  ownerId: string | null;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactPatientId: string | null;
  contactAnonymizedAt: string | null;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  stageKind: CommercialCrmStageKind;
  stagePosition: number;
}

export interface CommercialCrmSnapshot {
  pipelines: CommercialCrmPipeline[];
  stages: CommercialCrmStage[];
  leads: CommercialCrmLead[];
}

export interface CommercialCrmProspectInput {
  contactId: string;
  leadId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  title: string;
  pipelineId: string | null;
}

export type CommercialCrmIdentityResolutionMode =
  | 'create_if_clear'
  | 'explicit_reuse'
  | 'explicit_distinct';

export interface CommercialCrmLeadActivity {
  id: string;
  activityType: string;
  createdAt: string;
  fromStageId: string | null;
  toStageId: string | null;
  resolutionMode: CommercialCrmIdentityResolutionMode | null;
}

export interface CommercialCrmIdentityCandidate {
  contactId: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  matchReasons: string[];
  openLeadCount: number;
}

export interface CommercialCrmProspectResolutionInput extends CommercialCrmProspectInput {
  resolutionMode: CommercialCrmIdentityResolutionMode;
  selectedContactId?: string | null;
  distinctReason?: string | null;
}

export interface CommercialCrmProspectResult {
  contactId: string;
  leadId: string;
}

export interface CommercialCrmProspectResolutionResult extends CommercialCrmProspectResult {
  resolutionMode: CommercialCrmIdentityResolutionMode;
}

export interface CommercialCrmProspectOutcome {
  command: CommercialCrmProspectResult;
  snapshot: CommercialCrmSnapshot | null;
  projection: 'fresh' | 'stale';
  projectionWarning: string | null;
}

export interface CommercialCrmProspectResolutionOutcome {
  command: CommercialCrmProspectResolutionResult;
  snapshot: CommercialCrmSnapshot | null;
  projection: 'fresh' | 'stale';
  projectionWarning: string | null;
}

export interface CommercialCrmTransitionInput {
  leadId: string;
  toStageId: string;
  lostReasonDetail?: string | null;
}

export interface CommercialCrmTransitionResult {
  leadId: string;
  fromStageId: string;
  toStageId: string;
  stageKind: CommercialCrmStageKind;
  closedAt: string | null;
}

export interface CommercialCrmCommandOutcome {
  command: CommercialCrmTransitionResult | null;
  snapshot: CommercialCrmSnapshot | null;
  projection: 'fresh' | 'stale';
  projectionWarning: string | null;
}

type PipelineRow = {
  id: string;
  name: string;
  is_default: boolean;
  archived_at: string | null;
};

type StageRow = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  stage_kind: CommercialCrmStageKind;
  archived_at: string | null;
};

type LeadRow = {
  lead_id: string;
  title: string;
  value_cents: number | null;
  source: string | null;
  lost_reason_code: string | null;
  lost_reason_detail: string | null;
  closed_at: string | null;
  owner_id: string | null;
  contact_id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_patient_id: string | null;
  contact_anonymized_at: string | null;
  pipeline_id: string;
  pipeline_name: string;
  stage_id: string;
  stage_name: string;
  stage_kind: CommercialCrmStageKind;
  stage_position: number;
};

type ActivityRow = {
  id: string;
  activity_type: string;
  actor_id: string | null;
  actor_kind: string;
  metadata: unknown;
  created_at: string;
};

type IdentityCandidateRow = {
  contact_id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  match_reasons: string[] | null;
  open_lead_count: number | string | null;
};

type ProspectResolutionRow = {
  contact_id: string;
  lead_id: string;
  resolution_mode: CommercialCrmIdentityResolutionMode;
};

type TransitionRow = {
  lead_id: string;
  from_stage_id: string;
  to_stage_id: string;
  stage_kind: CommercialCrmStageKind;
  closed_at: string | null;
};

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? data as T[] : [];
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function metadataResolutionMode(
  metadata: Record<string, unknown>,
): CommercialCrmIdentityResolutionMode | null {
  const value = metadata.resolution_mode;
  return value === 'create_if_clear' || value === 'explicit_reuse' || value === 'explicit_distinct'
    ? value
    : null;
}

export async function listCurrentClinicCrmPipelines(): Promise<CommercialCrmPipeline[]> {
  const { data, error } = await supabase.rpc('list_current_clinic_crm_pipelines');
  if (error) throw error;

  return rows<PipelineRow>(data).map((row) => ({
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    archivedAt: row.archived_at,
  }));
}

export async function listCurrentClinicCrmStages(): Promise<CommercialCrmStage[]> {
  const { data, error } = await supabase.rpc('list_current_clinic_crm_stages', {
    p_pipeline_id: null,
  });
  if (error) throw error;

  return rows<StageRow>(data).map((row) => ({
    id: row.id,
    pipelineId: row.pipeline_id,
    name: row.name,
    position: row.position,
    stageKind: row.stage_kind,
    archivedAt: row.archived_at,
  }));
}

export async function listCurrentClinicCrmLeads(): Promise<CommercialCrmLead[]> {
  const { data, error } = await supabase.rpc('list_current_clinic_crm_leads');
  if (error) throw error;

  return rows<LeadRow>(data).map((row) => ({
    id: row.lead_id,
    title: row.title,
    valueCents: row.value_cents,
    source: row.source,
    lostReasonCode: row.lost_reason_code,
    lostReasonDetail: row.lost_reason_detail,
    closedAt: row.closed_at,
    ownerId: row.owner_id,
    contactId: row.contact_id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    contactPatientId: row.contact_patient_id,
    contactAnonymizedAt: row.contact_anonymized_at,
    pipelineId: row.pipeline_id,
    pipelineName: row.pipeline_name,
    stageId: row.stage_id,
    stageName: row.stage_name,
    stageKind: row.stage_kind,
    stagePosition: row.stage_position,
  }));
}

export async function listCurrentClinicCrmLeadActivities(
  leadId: string,
): Promise<CommercialCrmLeadActivity[]> {
  const { data, error } = await supabase.rpc('list_current_clinic_crm_lead_activities', {
    p_lead_id: leadId,
  });
  if (error) throw error;

  return rows<ActivityRow>(data).map((row) => {
    const metadata = metadataRecord(row.metadata);
    const stageChanged = row.activity_type === 'stage_changed';
    const identityResolved = row.activity_type === 'contact_identity_resolved';

    return {
      id: row.id,
      activityType: row.activity_type,
      createdAt: row.created_at,
      fromStageId: stageChanged ? metadataString(metadata, 'from_stage_id') : null,
      toStageId: stageChanged ? metadataString(metadata, 'to_stage_id') : null,
      resolutionMode: identityResolved ? metadataResolutionMode(metadata) : null,
    };
  });
}

export async function loadCurrentClinicCommercialCrm(): Promise<CommercialCrmSnapshot> {
  const [pipelines, stages, leads] = await Promise.all([
    listCurrentClinicCrmPipelines(),
    listCurrentClinicCrmStages(),
    listCurrentClinicCrmLeads(),
  ]);
  return { pipelines, stages, leads };
}

export async function listCurrentClinicCrmContactIdentityCandidates(
  input: Pick<CommercialCrmProspectInput, 'phone' | 'email'>,
): Promise<CommercialCrmIdentityCandidate[]> {
  const { data, error } = await supabase.rpc('list_current_clinic_crm_contact_identity_candidates', {
    p_phone: input.phone?.trim() || null,
    p_email: input.email?.trim() || null,
  });
  if (error) throw error;

  return rows<IdentityCandidateRow>(data).map((row) => ({
    contactId: row.contact_id,
    displayName: row.display_name,
    phone: row.phone,
    email: row.email,
    matchReasons: Array.isArray(row.match_reasons)
      ? row.match_reasons.filter((reason): reason is string => typeof reason === 'string')
      : [],
    openLeadCount: Number(row.open_lead_count ?? 0),
  }));
}

export async function resolveCurrentClinicCrmProspectIdentity(
  input: CommercialCrmProspectResolutionInput,
): Promise<CommercialCrmProspectResolutionResult> {
  const { data, error } = await supabase.rpc('resolve_current_clinic_crm_prospect_identity', {
    p_contact_id: input.contactId,
    p_lead_id: input.leadId,
    p_name: input.name.trim(),
    p_title: input.title.trim(),
    p_resolution_mode: input.resolutionMode,
    p_phone: input.phone?.trim() || null,
    p_email: input.email?.trim() || null,
    p_pipeline_id: input.pipelineId,
    p_selected_contact_id: input.selectedContactId ?? null,
    p_distinct_reason: input.distinctReason?.trim() || null,
  });
  if (error) throw error;

  const row = rows<ProspectResolutionRow>(data)[0];
  if (!row) throw new Error('crm_prospect_resolution_empty_result');

  return {
    contactId: row.contact_id,
    leadId: row.lead_id,
    resolutionMode: row.resolution_mode,
  };
}

export async function createCurrentClinicCrmContact(
  input: Pick<CommercialCrmProspectInput, 'contactId' | 'name' | 'phone' | 'email'>,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_current_clinic_crm_contact', {
    p_contact_id: input.contactId,
    p_name: input.name.trim(),
    p_phone: input.phone?.trim() || null,
    p_email: input.email?.trim() || null,
  });
  if (error) throw error;
  return typeof data === 'string' ? data : input.contactId;
}

export async function createCurrentClinicCrmLead(
  input: Pick<CommercialCrmProspectInput, 'leadId' | 'contactId' | 'title' | 'pipelineId'>,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_current_clinic_crm_lead', {
    p_lead_id: input.leadId,
    p_contact_id: input.contactId,
    p_title: input.title.trim(),
    p_pipeline_id: input.pipelineId,
    p_stage_id: null,
    p_owner_id: null,
    p_value_cents: null,
    p_source: null,
  });
  if (error) throw error;
  return typeof data === 'string' ? data : input.leadId;
}

export async function transitionCurrentClinicCrmLeadStage(
  input: CommercialCrmTransitionInput,
): Promise<CommercialCrmTransitionResult | null> {
  const { data, error } = await supabase.rpc('transition_current_clinic_crm_lead_stage', {
    p_lead_id: input.leadId,
    p_to_stage_id: input.toStageId,
    p_lost_reason_code: null,
    p_lost_reason_detail: input.lostReasonDetail?.trim() || null,
  });
  if (error) throw error;

  const row = rows<TransitionRow>(data)[0];
  if (!row) return null;
  return {
    leadId: row.lead_id,
    fromStageId: row.from_stage_id,
    toStageId: row.to_stage_id,
    stageKind: row.stage_kind,
    closedAt: row.closed_at,
  };
}

interface CommercialCrmProspectResolutionDependencies {
  resolve?: typeof resolveCurrentClinicCrmProspectIdentity;
  refresh?: typeof loadCurrentClinicCommercialCrm;
}

export async function executeCommercialCrmProspectResolution(
  input: CommercialCrmProspectResolutionInput,
  dependencies: CommercialCrmProspectResolutionDependencies = {},
): Promise<CommercialCrmProspectResolutionOutcome> {
  const resolve = dependencies.resolve ?? resolveCurrentClinicCrmProspectIdentity;
  const refresh = dependencies.refresh ?? loadCurrentClinicCommercialCrm;

  // The RELEASED resolver is the final identity authority. It rechecks
  // candidates under server-side transaction locks before Contact/Lead outcome.
  const command = await resolve(input);

  try {
    const snapshot = await refresh();
    return {
      command,
      snapshot,
      projection: 'fresh',
      projectionWarning: null,
    };
  } catch {
    // Do not log the RPC payload or Contact PII from this identity path.
    console.error('[MedicsPro] Falha ao atualizar projeção do CRM após resolução de prospect persistida.');
    return {
      command,
      snapshot: null,
      projection: 'stale',
      projectionWarning: 'Prospect resolvido, mas o quadro não pôde ser recarregado. Atualize novamente para ver o estado mais recente.',
    };
  }
}

interface CommercialCrmProspectDependencies {
  createContact?: typeof createCurrentClinicCrmContact;
  createLead?: typeof createCurrentClinicCrmLead;
  refresh?: typeof loadCurrentClinicCommercialCrm;
}

export async function executeCommercialCrmProspectCreation(
  input: CommercialCrmProspectInput,
  dependencies: CommercialCrmProspectDependencies = {},
): Promise<CommercialCrmProspectOutcome> {
  const createContact = dependencies.createContact ?? createCurrentClinicCrmContact;
  const createLead = dependencies.createLead ?? createCurrentClinicCrmLead;
  const refresh = dependencies.refresh ?? loadCurrentClinicCommercialCrm;

  // Reuse the released commands in order. Stable caller-supplied UUIDs make
  // an exact retry idempotent if the second call or its response is uncertain.
  const contactId = await createContact(input);
  const leadId = await createLead(input);
  const command = { contactId, leadId };

  try {
    const snapshot = await refresh();
    return {
      command,
      snapshot,
      projection: 'fresh',
      projectionWarning: null,
    };
  } catch (error) {
    console.error('[MedicsPro] Falha ao atualizar projeção do CRM após prospect persistido:', error);
    return {
      command,
      snapshot: null,
      projection: 'stale',
      projectionWarning: 'Prospect criado, mas o quadro não pôde ser recarregado. Atualize novamente para ver o estado mais recente.',
    };
  }
}

interface CommercialCrmCommandDependencies {
  transition?: typeof transitionCurrentClinicCrmLeadStage;
  refresh?: typeof loadCurrentClinicCommercialCrm;
}

export async function executeCommercialCrmStageTransition(
  input: CommercialCrmTransitionInput,
  dependencies: CommercialCrmCommandDependencies = {},
): Promise<CommercialCrmCommandOutcome> {
  const transition = dependencies.transition ?? transitionCurrentClinicCrmLeadStage;
  const refresh = dependencies.refresh ?? loadCurrentClinicCommercialCrm;

  // COMMAND: only this rejection means the stage transition failed to persist.
  const command = await transition(input);

  // PROJECTION: a failed refetch after COMMIT is stale UI state, not command failure.
  try {
    const snapshot = await refresh();
    return {
      command,
      snapshot,
      projection: 'fresh',
      projectionWarning: null,
    };
  } catch (error) {
    console.error('[MedicsPro] Falha ao atualizar projeção do CRM após transição persistida:', error);
    return {
      command,
      snapshot: null,
      projection: 'stale',
      projectionWarning: 'Etapa atualizada, mas o quadro não pôde ser recarregado. Atualize novamente para ver o estado mais recente.',
    };
  }
}
