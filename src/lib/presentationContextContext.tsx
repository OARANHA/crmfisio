import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import { useCurrentUserAccess } from './currentUserAccess';
import {
  presentationContextStorageKey,
  readStoredPresentationContext,
  resolveAvailablePresentationContexts,
  resolvePresentationContext,
  writeStoredPresentationContext,
  type PresentationContext,
} from './presentationContext';

type ClinicalEligibilityStatus = 'loading' | 'allowed' | 'denied' | 'error';

type ClinicalEligibilityResolution = {
  key: string;
  status: ClinicalEligibilityStatus;
};

type PresentationContextValue = {
  context: PresentationContext;
  availableContexts: readonly PresentationContext[];
  resolving: boolean;
  setContext: (context: PresentationContext) => void;
};

const PresentationContextContext = createContext<PresentationContextValue | null>(null);

function useScopedClinicalManagerEligibility(
  userId: string | null,
  clinicId: string | null,
): ClinicalEligibilityStatus {
  const key = userId && clinicId ? `${userId}:${clinicId}` : '';
  const [resolution, setResolution] = useState<ClinicalEligibilityResolution>({
    key,
    status: key ? 'loading' : 'denied',
  });
  const status: ClinicalEligibilityStatus = resolution.key === key
    ? resolution.status
    : key ? 'loading' : 'denied';

  useEffect(() => {
    let active = true;
    const requestKey = key;

    if (!userId || !clinicId) {
      setResolution({ key: requestKey, status: 'denied' });
      return () => { active = false; };
    }

    setResolution({ key: requestKey, status: 'loading' });
    const db = supabase as any;
    void Promise.all([
      db.rpc('current_user_has_valid_clinical_identity'),
      db.rpc('current_user_has_clinical_capability', { p_capability: 'clinical.attend' }),
    ])
      .then(([
        identityResult,
        capabilityResult,
      ]: Array<{ data: unknown; error: unknown }>) => {
        if (!active) return;
        if (identityResult.error || capabilityResult.error) {
          console.error('[MedicsPro] elegibilidade clínica para apresentação:', identityResult.error || capabilityResult.error);
          setResolution({ key: requestKey, status: 'error' });
          return;
        }
        const allowed = identityResult.data === true && capabilityResult.data === true;
        setResolution({ key: requestKey, status: allowed ? 'allowed' : 'denied' });
      })
      .catch((error: unknown) => {
        console.error('[MedicsPro] elegibilidade clínica para apresentação:', error);
        if (active) setResolution({ key: requestKey, status: 'error' });
      });

    return () => { active = false; };
  }, [clinicId, key, userId]);

  return status;
}

export function PresentationContextProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { user } = useCurrentUserAccess();
  const userId = user?.id ?? null;
  const clinicId = profile?.clinic_id ?? null;
  const isClinicalManager = user?.role === 'owner' || user?.role === 'admin';
  const eligibilityStatus = useScopedClinicalManagerEligibility(
    isClinicalManager ? userId : null,
    isClinicalManager ? clinicId : null,
  );
  const scopeKey = presentationContextStorageKey(userId, clinicId);
  const storage = typeof window === 'undefined' ? null : window.localStorage;
  const [selection, setSelection] = useState<{
    scopeKey: string | null;
    value: PresentationContext | null;
  }>({ scopeKey: null, value: null });

  const facts = useMemo(() => ({
    role: user?.role,
    hasValidClinicalIdentity: eligibilityStatus === 'allowed',
    canAttendClinically: eligibilityStatus === 'allowed',
  }), [eligibilityStatus, user?.role]);

  const availableContexts = useMemo(
    () => resolveAvailablePresentationContexts(facts),
    [facts],
  );

  const storedContext = selection.scopeKey === scopeKey
    ? selection.value
    : readStoredPresentationContext(storage, userId, clinicId);

  const context = resolvePresentationContext(facts, storedContext);
  const resolving = Boolean(isClinicalManager) && eligibilityStatus === 'loading';

  const setContext = useCallback((next: PresentationContext) => {
    if (!availableContexts.includes(next)) return;
    writeStoredPresentationContext(storage, userId, clinicId, next);
    setSelection({ scopeKey, value: next });
  }, [availableContexts, clinicId, scopeKey, storage, userId]);

  const value = useMemo<PresentationContextValue>(() => ({
    context,
    availableContexts,
    resolving,
    setContext,
  }), [availableContexts, context, resolving, setContext]);

  return (
    <PresentationContextContext.Provider value={value}>
      {children}
    </PresentationContextContext.Provider>
  );
}

export function usePresentationContext(): PresentationContextValue {
  const value = useContext(PresentationContextContext);
  if (!value) throw new Error('usePresentationContext must be used within PresentationContextProvider');
  return value;
}
