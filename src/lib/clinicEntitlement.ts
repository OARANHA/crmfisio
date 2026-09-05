import { supabase } from './supabaseClient';
import type { ModuleKey } from './types';
import type { PlatformClinicEntitlementKey, PlatformClinicEntitlementSource } from './platformAdmin';

export type CurrentClinicEntitlementState = {
  clinicId: string;
  key: PlatformClinicEntitlementKey;
  configured: boolean;
  enabled: boolean;
  effective: boolean;
  source: PlatformClinicEntitlementSource | null;
  startsAt: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
};

export const MODULE_ENTITLEMENT: Partial<Record<ModuleKey, PlatformClinicEntitlementKey>> = {
  financeiro: 'finance.access',
  crm: 'crm.access',
  mensagens: 'whatsapp.access',
  relatorios: 'reports.access',
};

const db = supabase as any;

export function isCurrentClinicEntitlementAllowed(state: CurrentClinicEntitlementState): boolean {
  // Existing clinics may still be unseeded. Only an explicitly configured entitlement
  // becomes an application-level rollout boundary; this keeps rollout backward-compatible.
  return !state.configured || state.effective;
}

export async function loadCurrentClinicEntitlementState(
  key: PlatformClinicEntitlementKey,
): Promise<CurrentClinicEntitlementState> {
  const { data, error } = await db.rpc('current_clinic_entitlement_state', {
    p_entitlement_key: key,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Estado do entitlement não retornado pelo servidor');

  return {
    clinicId: String(row.clinic_id),
    key: row.entitlement_key as PlatformClinicEntitlementKey,
    configured: Boolean(row.configured),
    enabled: Boolean(row.enabled),
    effective: Boolean(row.effective),
    source: row.source ? row.source as PlatformClinicEntitlementSource : null,
    startsAt: row.starts_at ? String(row.starts_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}
