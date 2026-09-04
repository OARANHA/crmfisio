import { supabase } from './supabaseClient';

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

export type PlatformAuditEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityKey: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

const db = supabase as any;

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
