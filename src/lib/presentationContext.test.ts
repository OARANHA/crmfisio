import { describe, expect, it } from 'vitest';
import { accessFor } from './permissions';
import {
  isNavigationPresentationSafe,
  presentationContextStorageKey,
  readStoredPresentationContext,
  resolveAvailablePresentationContexts,
  resolvePresentationContext,
  writeStoredPresentationContext,
  type PresentationAccessFacts,
} from './presentationContext';

const professional: PresentationAccessFacts = {
  role: 'professional',
  hasValidClinicalIdentity: false,
  canAttendClinically: false,
};
const clinicalOwner: PresentationAccessFacts = {
  role: 'owner',
  hasValidClinicalIdentity: true,
  canAttendClinically: true,
};
const clinicalAdmin: PresentationAccessFacts = {
  role: 'admin',
  hasValidClinicalIdentity: true,
  canAttendClinically: true,
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('PresentationContext availability', () => {
  it('starts professionals in clinical and never offers management', () => {
    expect(resolveAvailablePresentationContexts(professional)).toEqual(['clinical']);
    expect(resolvePresentationContext(professional, null)).toBe('clinical');
    expect(resolvePresentationContext(professional, 'management')).toBe('clinical');
  });

  it('allows a clinically eligible owner to alternate clinical and management', () => {
    expect(resolveAvailablePresentationContexts(clinicalOwner)).toEqual(['clinical', 'management']);
    expect(resolvePresentationContext(clinicalOwner, 'clinical')).toBe('clinical');
    expect(resolvePresentationContext(clinicalOwner, 'management')).toBe('management');
  });

  it('allows a clinically eligible admin to alternate clinical and management', () => {
    expect(resolveAvailablePresentationContexts(clinicalAdmin)).toEqual(['clinical', 'management']);
    expect(resolvePresentationContext(clinicalAdmin, 'clinical')).toBe('clinical');
  });

  it('keeps owner/admin management-only unless both identity and clinical.attend are confirmed', () => {
    for (const role of ['owner', 'admin'] as const) {
      expect(resolveAvailablePresentationContexts({ role, hasValidClinicalIdentity: false, canAttendClinically: true })).toEqual(['management']);
      expect(resolveAvailablePresentationContexts({ role, hasValidClinicalIdentity: true, canAttendClinically: false })).toEqual(['management']);
      expect(resolveAvailablePresentationContexts({ role, hasValidClinicalIdentity: false, canAttendClinically: false })).toEqual(['management']);
      expect(resolvePresentationContext({ role, hasValidClinicalIdentity: false, canAttendClinically: false }, 'clinical')).toBe('management');
    }
  });

  it('never offers a clinical context to reception or finance', () => {
    expect(resolveAvailablePresentationContexts({ role: 'recep', hasValidClinicalIdentity: true, canAttendClinically: true })).toEqual(['management']);
    expect(resolveAvailablePresentationContexts({ role: 'financeiro', hasValidClinicalIdentity: true, canAttendClinically: true })).toEqual(['management']);
  });
});

describe('presentation-only navigation privacy', () => {
  it('keeps the assistential navigation available in clinical context', () => {
    for (const path of ['/dashboard', '/agenda', '/pacientes', '/nexus', '/mensagens']) {
      expect(isNavigationPresentationSafe(path, 'clinical')).toBe(true);
    }
  });

  it('hides management surfaces in clinical even when the real role can view them', () => {
    for (const path of ['/financeiro', '/crm', '/relatorios', '/config']) {
      expect(accessFor('owner', path === '/financeiro' ? 'financeiro' : path === '/crm' ? 'crm' : path === '/relatorios' ? 'relatorios' : 'config')).not.toBe('none');
      expect(isNavigationPresentationSafe(path, 'clinical')).toBe(false);
      expect(isNavigationPresentationSafe(`${path}/detalhe`, 'clinical')).toBe(false);
    }
  });

  it('does not use presentation context to manufacture management authorization', () => {
    const role = 'professional' as const;
    const beforeFinance = accessFor(role, 'financeiro');
    const beforeConfig = accessFor(role, 'config');
    expect(isNavigationPresentationSafe('/financeiro', 'management')).toBe(true);
    expect(accessFor(role, 'financeiro')).toBe(beforeFinance);
    expect(accessFor(role, 'config')).toBe(beforeConfig);
    expect(beforeConfig).toBe('none');
  });

  it('leaves Nexus visibility to its existing capability and entitlement gates', () => {
    expect(isNavigationPresentationSafe('/nexus', 'clinical')).toBe(true);
    expect(isNavigationPresentationSafe('/nexus', 'management')).toBe(true);
  });
});

describe('scoped presentation preference', () => {
  it('uses user + clinic in the storage key', () => {
    expect(presentationContextStorageKey('user-a', 'clinic-a')).toBe('medicspro:presentation-context:user-a:clinic-a');
    expect(presentationContextStorageKey(null, 'clinic-a')).toBeNull();
    expect(presentationContextStorageKey('user-a', null)).toBeNull();
  });

  it('isolates preferences between users', () => {
    const storage = memoryStorage();
    writeStoredPresentationContext(storage, 'user-a', 'clinic-a', 'clinical');
    writeStoredPresentationContext(storage, 'user-b', 'clinic-a', 'management');
    expect(readStoredPresentationContext(storage, 'user-a', 'clinic-a')).toBe('clinical');
    expect(readStoredPresentationContext(storage, 'user-b', 'clinic-a')).toBe('management');
  });

  it('isolates preferences between clinics', () => {
    const storage = memoryStorage();
    writeStoredPresentationContext(storage, 'user-a', 'clinic-a', 'clinical');
    writeStoredPresentationContext(storage, 'user-a', 'clinic-b', 'management');
    expect(readStoredPresentationContext(storage, 'user-a', 'clinic-a')).toBe('clinical');
    expect(readStoredPresentationContext(storage, 'user-a', 'clinic-b')).toBe('management');
  });

  it('ignores invalid persisted values and resolves from current facts', () => {
    const storage = memoryStorage();
    storage.setItem('medicspro:presentation-context:user-a:clinic-a', 'owner');
    expect(readStoredPresentationContext(storage, 'user-a', 'clinic-a')).toBeNull();
    expect(resolvePresentationContext(professional, null)).toBe('clinical');
  });
});
