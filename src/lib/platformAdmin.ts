import { platformSupabase } from './platformSupabaseClient';

export type PlatformAutomationKey =
  | 'automation.enabled'
  | 'finance.overdue'
  | 'automation.core_tick'
  | 'waitlist.recovery'
  | 'reactivation.auto'
  | 'evolution.worker'
  | 'nexus.self_assessment_processor';

export type PlatformAutomationSetting = {
  key: PlatformAutomationKey;
  enabled: boolean;
  updatedAt: string;
};

export type PlatformAutomationRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  triggerSource: string;
  queuedConfirmations: number;
  queuedNps: number;
  expiredWaitlistOffers: number;
  workerProcessed: number;
  workerSent: number;
  workerFailed: number;
  clinicsProcessed: number;
  status: string;
  errorMessage: string | null;
};

export type PlatformClinicEntitlementKey =
  | 'nexus.access'
  | 'finance.access'
  | 'crm.access'
  | 'reports.access'
  | 'assessments.custom'
  | 'whatsapp.access';

export type PlatformClinicEntitlementSource = 'manual' | 'plan' | 'trial' | 'migration';
export type PlatformClinicEntitlementEffectiveSource = 'override' | 'plan' | 'rollout' | 'invalid';
export type PlatformClinicLifecycleStatus = 'active' | 'suspended';
export type PlatformClinicPlanStatus = 'active' | 'trialing';
export type PlatformPlanEntitlements = Record<PlatformClinicEntitlementKey, boolean>;

export type PlatformClinicEntitlement = {
  key: PlatformClinicEntitlementKey;
  configured: boolean;
  enabled: boolean;
  source: PlatformClinicEntitlementSource | null;
  startsAt: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  planConfigured: boolean;
  planEnabled: boolean;
  planKey: string | null;
  planVersion: number | null;
  effective: boolean;
  effectiveSource: PlatformClinicEntitlementEffectiveSource;
};

export type PlatformPlanSummary = {
  planId: string;
  planKey: string;
  active: boolean;
  versionId: string;
  version: number;
  name: string;
  description: string;
  publishedAt: string;
  entitlements: PlatformPlanEntitlements;
};

export type PlatformClinicPlanAssignment = {
  assignmentId: string;
  planId: string;
  planKey: string;
  planVersionId: string;
  version: number;
  name: string;
  status: PlatformClinicPlanStatus;
  startsAt: string;
  trialEndsAt: string | null;
  endsAt: string | null;
  assignedAt: string;
  reason: string | null;
};

export type PlatformClinicSummary = {
  id: string;
  name: string;
  cnpj: string | null;
  lifecycleStatus: PlatformClinicLifecycleStatus;
  createdAt: string;
};

export type PlatformAuditEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityKey: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

const db = platformSupabase as any;

export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await db.rpc('is_platform_admin');
  if (error) throw error;
  return data === true;
}

export async function loadPlatformAutomationSettings(): Promise<PlatformAutomationSetting[]> {
  const { data, error } = await db.rpc('platform_get_automation_settings');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    key: row.key as PlatformAutomationKey,
    enabled: Boolean(row.enabled),
    updatedAt: String(row.updated_at),
  }));
}

export async function setPlatformAutomationSetting(
  key: PlatformAutomationKey,
  enabled: boolean,
): Promise<PlatformAutomationSetting> {
  const { data, error } = await db.rpc('platform_set_automation_setting', {
    p_key: key,
    p_enabled: enabled,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Configuração não retornada pelo servidor');

  return {
    key: row.key as PlatformAutomationKey,
    enabled: Boolean(row.enabled),
    updatedAt: String(row.updated_at),
  };
}

export async function loadPlatformAutomationRuns(limit = 20): Promise<PlatformAutomationRun[]> {
  const { data, error } = await db.rpc('platform_get_automation_runs', { p_limit: limit });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    triggerSource: String(row.trigger_source ?? 'unknown'),
    queuedConfirmations: Number(row.queued_confirmations ?? 0),
    queuedNps: Number(row.queued_nps ?? 0),
    expiredWaitlistOffers: Number(row.expired_waitlist_offers ?? 0),
    workerProcessed: Number(row.worker_processed ?? 0),
    workerSent: Number(row.worker_sent ?? 0),
    workerFailed: Number(row.worker_failed ?? 0),
    clinicsProcessed: Number(row.clinics_processed ?? 0),
    status: String(row.status ?? 'unknown'),
    errorMessage: row.error_message ? String(row.error_message) : null,
  }));
}

export async function loadPlatformClinics(): Promise<PlatformClinicSummary[]> {
  const { data, error } = await db.rpc('platform_list_clinics');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.clinic_id),
    name: String(row.clinic_name),
    cnpj: row.cnpj ? String(row.cnpj) : null,
    lifecycleStatus: row.lifecycle_status === 'suspended' ? 'suspended' : 'active',
    createdAt: String(row.created_at),
  }));
}

export async function suspendPlatformClinic(clinicId: string, reason: string): Promise<boolean> {
  const { data, error } = await db.rpc('platform_suspend_clinic', {
    p_clinic_id: clinicId,
    p_reason: reason,
  });
  if (error) throw error;
  return data === true;
}

export async function reactivatePlatformClinic(clinicId: string, reason: string): Promise<boolean> {
  const { data, error } = await db.rpc('platform_reactivate_clinic', {
    p_clinic_id: clinicId,
    p_reason: reason,
  });
  if (error) throw error;
  return data === true;
}

export async function loadPlatformPlans(): Promise<PlatformPlanSummary[]> {
  const { data, error } = await db.rpc('platform_list_plans');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    planId: String(row.plan_id),
    planKey: String(row.plan_key),
    active: Boolean(row.active),
    versionId: String(row.version_id),
    version: Number(row.version),
    name: String(row.name),
    description: String(row.description ?? ''),
    publishedAt: String(row.published_at),
    entitlements: row.entitlements as PlatformPlanEntitlements,
  }));
}

export async function createPlatformPlan(input: {
  planKey: string; name: string; description?: string;
  entitlements: PlatformPlanEntitlements; active?: boolean;
}): Promise<string> {
  const { data, error } = await db.rpc('platform_create_plan', {
    p_plan_key: input.planKey,
    p_name: input.name,
    p_description: input.description ?? '',
    p_entitlements: input.entitlements,
    p_active: input.active ?? true,
  });
  if (error) throw error;
  if (!data) throw new Error('Plano não retornado pelo servidor');
  return String(data);
}

export async function publishPlatformPlanVersion(input: {
  planId: string; name: string; description?: string;
  entitlements: PlatformPlanEntitlements;
}): Promise<string> {
  const { data, error } = await db.rpc('platform_publish_plan_version', {
    p_plan_id: input.planId,
    p_name: input.name,
    p_description: input.description ?? '',
    p_entitlements: input.entitlements,
  });
  if (error) throw error;
  if (!data) throw new Error('Versão do plano não retornada pelo servidor');
  return String(data);
}

export async function setPlatformPlanActive(planId: string, active: boolean): Promise<boolean> {
  const { data, error } = await db.rpc('platform_set_plan_active', { p_plan_id: planId, p_active: active });
  if (error) throw error;
  return data === true;
}

export async function loadPlatformClinicPlanAssignment(clinicId: string): Promise<PlatformClinicPlanAssignment | null> {
  const { data, error } = await db.rpc('platform_get_clinic_plan_assignment', { p_clinic_id: clinicId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    assignmentId: String(row.assignment_id),
    planId: String(row.plan_id),
    planKey: String(row.plan_key),
    planVersionId: String(row.plan_version_id),
    version: Number(row.version),
    name: String(row.name),
    status: row.status === 'trialing' ? 'trialing' : 'active',
    startsAt: String(row.starts_at),
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    endsAt: row.ends_at ? String(row.ends_at) : null,
    assignedAt: String(row.assigned_at),
    reason: row.reason ? String(row.reason) : null,
  };
}

export async function assignPlatformClinicPlan(input: {
  clinicId: string; planVersionId: string; status: PlatformClinicPlanStatus;
  trialEndsAt?: string | null; reason?: string | null;
}): Promise<string> {
  const { data, error } = await db.rpc('platform_assign_clinic_plan', {
    p_clinic_id: input.clinicId,
    p_plan_version_id: input.planVersionId,
    p_status: input.status,
    p_starts_at: new Date().toISOString(),
    p_trial_ends_at: input.trialEndsAt ?? null,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
  if (!data) throw new Error('Assignment não retornado pelo servidor');
  return String(data);
}

export async function cancelPlatformClinicPlan(clinicId: string, reason?: string | null): Promise<boolean> {
  const { data, error } = await db.rpc('platform_cancel_clinic_plan', {
    p_clinic_id: clinicId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data === true;
}

function mapClinicEntitlement(row: any): PlatformClinicEntitlement {
  return {
    key: row.entitlement_key as PlatformClinicEntitlementKey,
    configured: Boolean(row.configured),
    enabled: Boolean(row.enabled),
    source: row.source ? row.source as PlatformClinicEntitlementSource : null,
    startsAt: row.starts_at ? String(row.starts_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    planConfigured: Boolean(row.plan_configured),
    planEnabled: Boolean(row.plan_enabled),
    planKey: row.plan_key ? String(row.plan_key) : null,
    planVersion: row.plan_version == null ? null : Number(row.plan_version),
    effective: Boolean(row.effective),
    effectiveSource: (row.effective_source ?? 'invalid') as PlatformClinicEntitlementEffectiveSource,
  };
}

export async function loadPlatformClinicEntitlements(clinicId: string): Promise<PlatformClinicEntitlement[]> {
  const { data, error } = await db.rpc('platform_get_clinic_entitlements_v3', {
    p_clinic_id: clinicId,
  });
  if (error) throw error;
  return (data ?? []).map(mapClinicEntitlement);
}

export async function setPlatformClinicEntitlement(input: {
  clinicId: string;
  key: PlatformClinicEntitlementKey;
  enabled: boolean;
  source?: PlatformClinicEntitlementSource;
  startsAt?: string | null;
  expiresAt?: string | null;
}): Promise<PlatformClinicEntitlement> {
  const { data, error } = await db.rpc('platform_set_clinic_entitlement', {
    p_clinic_id: input.clinicId,
    p_entitlement_key: input.key,
    p_enabled: input.enabled,
    p_source: input.source ?? 'manual',
    p_starts_at: input.startsAt ?? null,
    p_expires_at: input.expiresAt ?? null,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Entitlement não retornado pelo servidor');
  const resolved = await loadPlatformClinicEntitlements(input.clinicId);
  const entitlement = resolved.find((item) => item.key === input.key);
  if (!entitlement) throw new Error('Entitlement efetivo não retornado pelo servidor');
  return entitlement;
}

export async function resetPlatformClinicEntitlement(input: {
  clinicId: string;
  key: PlatformClinicEntitlementKey;
}): Promise<boolean> {
  const { data, error } = await db.rpc('platform_reset_clinic_entitlement', {
    p_clinic_id: input.clinicId,
    p_entitlement_key: input.key,
  });
  if (error) throw error;
  return data === true;
}

export async function loadPlatformAuditLog(limit = 30): Promise<PlatformAuditEntry[]> {
  const { data, error } = await db.rpc('platform_get_audit_log', { p_limit: limit });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    action: String(row.action),
    entityType: String(row.entity_type),
    entityKey: String(row.entity_key),
    detail: row.detail && typeof row.detail === 'object' ? row.detail : {},
    createdAt: String(row.created_at),
  }));
}
