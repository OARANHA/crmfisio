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

export type PlatformAuditEntry = {
  id: number;
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

export async function loadPlatformAuditLog(limit = 30): Promise<PlatformAuditEntry[]> {
  const { data, error } = await db.rpc('platform_get_audit_log', { p_limit: limit });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    action: String(row.action),
    entityType: String(row.entity_type),
    entityKey: String(row.entity_key),
    detail: row.detail && typeof row.detail === 'object' ? row.detail : {},
    createdAt: String(row.created_at),
  }));
}
