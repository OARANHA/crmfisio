import type { ModuleKey } from './types';
import {
  MODULE_ENTITLEMENT,
  isCurrentClinicEntitlementAllowed,
  loadCurrentClinicEntitlementState,
} from './clinicEntitlement';

export type ModuleEntitlementVisibility = Partial<Record<ModuleKey, boolean>>;

export async function loadCurrentClinicModuleVisibility(): Promise<ModuleEntitlementVisibility> {
  const entries = Object.entries(MODULE_ENTITLEMENT) as Array<
    [ModuleKey, NonNullable<(typeof MODULE_ENTITLEMENT)[ModuleKey]>]
  >;

  const states = await Promise.all(
    entries.map(async ([module, entitlement]) => {
      const state = await loadCurrentClinicEntitlementState(entitlement);
      return [module, isCurrentClinicEntitlementAllowed(state)] as const;
    }),
  );

  return Object.fromEntries(states) as ModuleEntitlementVisibility;
}

export function isModuleVisibleByEntitlement(
  module: ModuleKey,
  visibility: ModuleEntitlementVisibility,
): boolean {
  // Undefined means we do not yet have a conclusive entitlement state.
  // The route gate remains the authority and will fail safely if access is denied.
  return visibility[module] !== false;
}
