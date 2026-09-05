import { describe, expect, it } from 'vitest';
import { isCurrentClinicEntitlementAllowed, type CurrentClinicEntitlementState } from './clinicEntitlement';

const state = (overrides: Partial<CurrentClinicEntitlementState>): CurrentClinicEntitlementState => ({
  clinicId: 'clinic-1',
  key: 'finance.access',
  configured: true,
  enabled: true,
  effective: true,
  source: 'manual',
  startsAt: null,
  expiresAt: null,
  updatedAt: null,
  ...overrides,
});

describe('isCurrentClinicEntitlementAllowed', () => {
  it('preserves access for legacy clinics without an explicit configuration', () => {
    expect(isCurrentClinicEntitlementAllowed(state({ configured: false, enabled: false, effective: false, source: null }))).toBe(true);
  });

  it('allows explicitly configured effective entitlements', () => {
    expect(isCurrentClinicEntitlementAllowed(state({ configured: true, enabled: true, effective: true }))).toBe(true);
  });

  it('blocks explicitly configured disabled entitlements', () => {
    expect(isCurrentClinicEntitlementAllowed(state({ configured: true, enabled: false, effective: false }))).toBe(false);
  });

  it('blocks configured entitlements that are enabled but not currently effective', () => {
    expect(isCurrentClinicEntitlementAllowed(state({ configured: true, enabled: true, effective: false }))).toBe(false);
  });
});
