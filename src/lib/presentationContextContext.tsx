import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useClinicalCapability } from '../hooks/useClinicalCapability';
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

type IdentityEligibilityStatus = 'loading' | 'allowed' | 'denied' | 'error';

type IdentityResolution = {
  key: string;
  status: IdentityEligibilityStatus;
};

type PresentationContextValue = {
  context: PresentationContext;
  availableContexts: readonly PresentationContext[];
  resolving: boolean;
  setContext: (context: PresentationContext) => void;
};

const PresentationContextContext = createContext<PresentationContextValue | null>(null);

function useValidClinicalIdentity(userId: string | null): IdentityEligibilityStatus {
  const key = userId ?? '';
  const [resolution, setResolution] = useState<IdentityResolution>({
    key,
    status: userId ? 'loading' : 'denied',
  });
  const status: IdentityEligibilityStatus = resolution.key === key
    ? resolution.status
    : userId ? 'loading' : 'denied';

  useEffect(() => {
    let active = true;
    const requestKey = key;

    if (!userId) {
      setResolution({ key: requestKey, status: 'denied' });
      return () => { active = false; };
    }

    setResolution({ key: requestKey, status: 'loading' });
    void (supabase as any).rpc('current_user_has_valid_clinical_identity')
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!active) return;
        if (error) {
          console.error('[MedicsPro] identidade clínica para apresentação:', error);
          setResolution({ key: requestKey, status: 'error' });
          return;
        }
        setResolution({ key: requestKey, status: data === true ? 'allowed' : 'denied' });
      })
      .catch((error: unknown) => {
        console.error('[MedicsPro] identidade clínica para apresentação:', error);
        if (active) setResolution({ key: requestKey, status: 'error' });
      });

    return () => { active = false; };
  }, [key, userId]);

  return status;
}

export function PresentationContextProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { user } = useCurrentUserAccess();
  const isClinicalManager = user?.role === 'owner' || user?.role === 'admin';
  const eligibilityUserId = isClinicalManager ? user?.id ?? null : null;
  const identityStatus = useValidClinicalIdentity(eligibilityUserId);
  const attendCapability = useClinicalCapability('clinical.attend', eligibilityUserId);
  const userId = user?.id ?? null;
  const clinicId = profile?.clinic_id ?? null;
  const scopeKey = presentationContextStorageKey(userId, clinicId);
  const storage = typeof window === 'undefined' ? null : window.localStorage;
  const [selection, setSelection] = useState<{
    scopeKey: string | null;
    value: PresentationContext | null;
  }>({ scopeKey: null, value: null });

  const facts = useMemo(() => ({
    role: user?.role,
    hasValidClinicalIdentity: identityStatus === 'allowed',
    canAttendClinically: attendCapability.allowed,
  }), [attendCapability.allowed, identityStatus, user?.role]);

  const availableContexts = useMemo(
    () => resolveAvailablePresentationContexts(facts),
    [facts],
  );

  const storedContext = selection.scopeKey === scopeKey
    ? selection.value
    : readStoredPresentationContext(storage, userId, clinicId);

  const context = resolvePresentationContext(facts, storedContext);
  const resolving = Boolean(isClinicalManager)
    && (identityStatus === 'loading' || attendCapability.loading);

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
