import { describe, expect, it } from 'vitest';
import {
  nexusClinicalToolContextKey,
  resolveNexusClinicalTools,
  type NexusClinicalToolAuthorization,
} from './clinicalToolRegistry';
import type { ProfessionalIdentity } from '../professionalIdentity';

const familyDoctor: ProfessionalIdentity = {
  professionalType: 'medico',
  specialty: 'Medicina de Família e Comunidade',
  councilType: 'CRM',
};

const psychiatrist: ProfessionalIdentity = {
  professionalType: 'medico',
  specialty: 'Psiquiatria',
  councilType: 'CRM',
};

const ready = (overrides: Partial<NexusClinicalToolAuthorization> = {}): NexusClinicalToolAuthorization => ({
  state: 'ready',
  entitlementAllowed: true,
  nexusAccess: true,
  capabilities: {
    'nexus.eem': true,
    'nexus.scales': true,
  },
  ...overrides,
});

const ids = (authorization: NexusClinicalToolAuthorization, identity: ProfessionalIdentity | null) =>
  resolveNexusClinicalTools(authorization, identity).map((tool) => tool.id);

const sortedIds = (authorization: NexusClinicalToolAuthorization, identity: ProfessionalIdentity | null) =>
  [...ids(authorization, identity)].sort();

describe('Nexus capability-first clinical tool registry', () => {
  it('keeps authorized scales available for a non-psychiatrist physician', () => {
    expect(ids(ready({ capabilities: { 'nexus.eem': false, 'nexus.scales': true } }), familyDoctor))
      .toContain('mental-health-screening');
  });

  it('keeps the same authorized tool set for psychiatry and only changes contextual presentation', () => {
    const nonPsych = resolveNexusClinicalTools(ready(), familyDoctor);
    const psych = resolveNexusClinicalTools(ready(), psychiatrist);

    expect(sortedIds(ready(), familyDoctor)).toEqual(sortedIds(ready(), psychiatrist));
    expect(nonPsych.every((tool) => tool.level === 'available')).toBe(true);
    expect(psych.find((tool) => tool.id === 'eem')?.level).toBe('relevant');
    expect(psych.find((tool) => tool.id === 'mental-health-screening')?.level).toBe('relevant');
    expect(psych.every((tool) => tool.recommendation === 'none')).toBe(true);
  });

  it('never lets psychiatry specialty replace nexus.access', () => {
    expect(resolveNexusClinicalTools(ready({ nexusAccess: false }), psychiatrist)).toEqual([]);
  });

  it('never lets psychiatry specialty replace the clinic entitlement', () => {
    expect(resolveNexusClinicalTools(ready({ entitlementAllowed: false }), psychiatrist)).toEqual([]);
  });

  it('hides EEM without nexus.eem', () => {
    expect(ids(ready({ capabilities: { 'nexus.eem': false, 'nexus.scales': true } }), psychiatrist))
      .not.toContain('eem');
  });

  it('hides PHQ-9/GAD-7 without nexus.scales', () => {
    expect(ids(ready({ capabilities: { 'nexus.eem': true, 'nexus.scales': false } }), psychiatrist))
      .not.toContain('mental-health-screening');
  });

  it('fails closed while capability/authorization state is loading', () => {
    expect(resolveNexusClinicalTools(ready({ state: 'loading' }), psychiatrist)).toEqual([]);
  });

  it('fails closed when capability/authorization resolution errors', () => {
    expect(resolveNexusClinicalTools(ready({ state: 'error' }), psychiatrist)).toEqual([]);
  });

  it('specialty never manufactures a missing tool capability', () => {
    expect(ids(ready({ capabilities: { 'nexus.eem': false, 'nexus.scales': false } }), psychiatrist).sort())
      .toEqual(['longitudinal', 'results']);
  });

  it('absence of psychiatry never hides an otherwise authorized tool', () => {
    expect(sortedIds(ready(), familyDoctor)).toEqual([
      'eem',
      'longitudinal',
      'mental-health-screening',
      'results',
    ]);
  });

  it('isolates Nexus presentation state by current user, patient and encounter', () => {
    const base = nexusClinicalToolContextKey({ userId: 'user-a', patientId: 'patient-a', encounterId: 'encounter-a' });
    expect(nexusClinicalToolContextKey({ userId: 'user-b', patientId: 'patient-a', encounterId: 'encounter-a' })).not.toBe(base);
    expect(nexusClinicalToolContextKey({ userId: 'user-a', patientId: 'patient-b', encounterId: 'encounter-a' })).not.toBe(base);
    expect(nexusClinicalToolContextKey({ userId: 'user-a', patientId: 'patient-a', encounterId: 'encounter-b' })).not.toBe(base);
  });
});
