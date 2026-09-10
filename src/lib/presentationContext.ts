import type { Role } from './types';

export type PresentationContext = 'clinical' | 'management';

export type PresentationAccessFacts = {
  role: Role | null | undefined;
  hasValidClinicalIdentity: boolean;
  canAttendClinically: boolean;
};

const MANAGEMENT_ONLY_ROLES: ReadonlySet<Role> = new Set(['recep', 'financeiro']);
const CLINICAL_PRIVACY_PATHS = ['/financeiro', '/crm', '/relatorios', '/config'] as const;

export function resolveAvailablePresentationContexts(
  facts: PresentationAccessFacts,
): readonly PresentationContext[] {
  if (facts.role === 'professional') return ['clinical'];

  if (
    (facts.role === 'owner' || facts.role === 'admin')
    && facts.hasValidClinicalIdentity
    && facts.canAttendClinically
  ) {
    return ['clinical', 'management'];
  }

  if (facts.role && MANAGEMENT_ONLY_ROLES.has(facts.role)) return ['management'];
  return ['management'];
}

export function resolveDefaultPresentationContext(
  facts: PresentationAccessFacts,
): PresentationContext {
  return facts.role === 'professional' ? 'clinical' : 'management';
}

export function resolvePresentationContext(
  facts: PresentationAccessFacts,
  stored: string | null | undefined,
): PresentationContext {
  const available = resolveAvailablePresentationContexts(facts);
  if (stored === 'clinical' || stored === 'management') {
    if (available.includes(stored)) return stored;
  }
  return resolveDefaultPresentationContext(facts);
}

export function presentationContextStorageKey(
  userId: string | null | undefined,
  clinicId: string | null | undefined,
): string | null {
  if (!userId || !clinicId) return null;
  return `medicspro:presentation-context:${encodeURIComponent(userId)}:${encodeURIComponent(clinicId)}`;
}

type PresentationStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readStoredPresentationContext(
  storage: PresentationStorage | null | undefined,
  userId: string | null | undefined,
  clinicId: string | null | undefined,
): PresentationContext | null {
  const key = presentationContextStorageKey(userId, clinicId);
  if (!storage || !key) return null;
  try {
    const value = storage.getItem(key);
    return value === 'clinical' || value === 'management' ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPresentationContext(
  storage: PresentationStorage | null | undefined,
  userId: string | null | undefined,
  clinicId: string | null | undefined,
  value: PresentationContext,
): void {
  const key = presentationContextStorageKey(userId, clinicId);
  if (!storage || !key) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Presentation preference is best-effort and never an authorization input.
  }
}

export function isClinicalPrivacyPath(pathname: string): boolean {
  return CLINICAL_PRIVACY_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function isNavigationPresentationSafe(
  pathname: string,
  context: PresentationContext,
): boolean {
  return context === 'management' || !isClinicalPrivacyPath(pathname);
}
