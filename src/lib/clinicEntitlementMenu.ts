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
  // Modules without an entitlement boundary remain normal navigation entries.
  // For entitlement-controlled modules, undefined is unresolved/unknown and must
  // never be presented as if the module were positively available. The route
  // gate remains the server-backed authority and independently fails closed.
  if (!MODULE_ENTITLEMENT[module]) return true;
  return visibility[module] === true;
}
