import { describe, expect, it } from 'vitest';
import { isModuleVisibleByEntitlement } from './clinicEntitlementMenu';

describe('clinic entitlement menu visibility', () => {
  it('keeps modules visible before a conclusive entitlement lookup', () => {
    expect(isModuleVisibleByEntitlement('crm', {})).toBe(true);
  });

  it('hides a module only when its entitlement is conclusively blocked', () => {
    expect(isModuleVisibleByEntitlement('crm', { crm: false })).toBe(false);
  });

  it('keeps explicitly allowed modules visible', () => {
    expect(isModuleVisibleByEntitlement('financeiro', { financeiro: true })).toBe(true);
  });
});
