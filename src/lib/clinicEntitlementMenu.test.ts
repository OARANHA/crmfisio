import { describe, expect, it } from 'vitest';
import { isModuleVisibleByEntitlement } from './clinicEntitlementMenu';

describe('clinic entitlement menu visibility', () => {
  it('keeps entitlement-controlled modules hidden until the lookup is conclusive', () => {
    expect(isModuleVisibleByEntitlement('crm', {})).toBe(false);
  });

  it('keeps modules without an entitlement boundary visible while entitlement state resolves', () => {
    expect(isModuleVisibleByEntitlement('agenda', {})).toBe(true);
    expect(isModuleVisibleByEntitlement('pacientes', {})).toBe(true);
  });

  it('hides a module when its entitlement is conclusively blocked', () => {
    expect(isModuleVisibleByEntitlement('crm', { crm: false })).toBe(false);
  });

  it('keeps explicitly allowed modules visible', () => {
    expect(isModuleVisibleByEntitlement('financeiro', { financeiro: true })).toBe(true);
  });
});
