import { describe, expect, it } from 'vitest';
import { createClinicQueryClient, patientQueryKey } from './clinicQuery';

describe('clinic-scoped TanStack Query foundation', () => {
  it('scopes patient cache keys by clinic, user and role', () => {
    const base = patientQueryKey({ clinicId: 'clinic-a', userId: 'user-a', role: 'professional' });
    expect(patientQueryKey({ clinicId: 'clinic-b', userId: 'user-a', role: 'professional' })).not.toEqual(base);
    expect(patientQueryKey({ clinicId: 'clinic-a', userId: 'user-b', role: 'professional' })).not.toEqual(base);
    expect(patientQueryKey({ clinicId: 'clinic-a', userId: 'user-a', role: 'admin' })).not.toEqual(base);
  });

  it('creates isolated query clients for distinct clinic-session lifetimes', () => {
    const key = patientQueryKey({ clinicId: 'clinic-a', userId: 'user-a', role: 'professional' });
    const first = createClinicQueryClient();
    const second = createClinicQueryClient();
    first.setQueryData(key, [{ id: 'patient-a' }]);
    expect(first.getQueryData(key)).toEqual([{ id: 'patient-a' }]);
    expect(second.getQueryData(key)).toBeUndefined();
  });

  it('does not retry clinic queries or mutations implicitly', () => {
    const client = createClinicQueryClient();
    expect(client.getDefaultOptions().queries?.retry).toBe(false);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
