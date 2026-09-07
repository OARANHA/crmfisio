import { describe, expect, it } from 'vitest';
import { normalizeClinicRole } from './roleCompatibility';

describe('role compatibility boundary', () => {
  it('normalizes the persisted legacy clinical role during staged rollout', () => {
    expect(normalizeClinicRole('fisio')).toBe('professional');
  });

  it('preserves every canonical clinic role', () => {
    for (const role of ['owner', 'admin', 'professional', 'recep', 'financeiro'] as const) {
      expect(normalizeClinicRole(role)).toBe(role);
    }
  });

  it('fails closed for platform or unknown roles', () => {
    expect(normalizeClinicRole('platform_admin')).toBeNull();
    expect(normalizeClinicRole('doctor')).toBeNull();
    expect(normalizeClinicRole(null)).toBeNull();
    expect(normalizeClinicRole(undefined)).toBeNull();
  });
});
