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

export type PlatformClinicEntitlementKey =
  | 'nexus.access'
  | 'finance.access'
  | 'crm.access'
  | 'reports.access'
  | 'assessments.custom'
  | 'whatsapp.access';

export type PlatformClinicEntitlementSource = 'manual' | 'plan' | 'trial' | 'migration';

export type PlatformClinicEntitlement = {
  key: PlatformClinicEntitlementKey;
  enabled: boolean;
  source: PlatformClinicEntitlementSource;
  startsAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
};

export type PlatformClinicSummary = {
  id: string;
  name: string;
  cnpj: string | null;
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

export async function loadPlatformClinics(): Promise<PlatformClinicSummary[]> {
  const { data, error } = await db.rpc('platform_list_clinics');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.clinic_id),
    name: String(row.clinic_name),
    cnpj: row.cnpj ? String(row.cnpj) : null,
    createdAt: String(row.created_at),
  }));
}

function mapClinicEntitlement(row: any): PlatformClinicEntitlement {
  return {
    key: row.entitlement_key as PlatformClinicEntitlementKey,
    enabled: Boolean(row.enabled),
    source: row.source as PlatformClinicEntitlementSource,
    startsAt: row.starts_at ? String(row.starts_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    updatedAt: String(row.updated_at),
  };
}

export async function loadPlatformClinicEntitlements(clinicId: string): Promise<PlatformClinicEntitlement[]> {
  const { data, error } = await db.rpc('platform_get_clinic_entitlements', {
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
  return mapClinicEntitlement(row);
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
