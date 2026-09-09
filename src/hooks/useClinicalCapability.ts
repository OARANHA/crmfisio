import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ClinicalCapabilityKey } from '../lib/professionalIdentity';

export type ClinicalCapabilityStatus = 'loading' | 'allowed' | 'denied' | 'error';

export type ClinicalCapabilityState = {
  status: ClinicalCapabilityStatus;
  allowed: boolean;
  loading: boolean;
  denied: boolean;
  error: boolean;
};

type ClinicalCapabilityResolution = {
  key: string;
  status: ClinicalCapabilityStatus;
};

const stateFromStatus = (status: ClinicalCapabilityStatus): ClinicalCapabilityState => ({
  status,
  allowed: status === 'allowed',
  loading: status === 'loading',
  denied: status === 'denied',
  error: status === 'error',
});

export function useClinicalCapability(capability: ClinicalCapabilityKey, userId: string | null | undefined): ClinicalCapabilityState {
  const resolutionKey = `${userId ?? ''}:${capability}`;
  const [resolution, setResolution] = useState<ClinicalCapabilityResolution>({
    key: resolutionKey,
    status: userId ? 'loading' : 'denied',
  });
  const status: ClinicalCapabilityStatus = resolution.key === resolutionKey
    ? resolution.status
    : userId ? 'loading' : 'denied';

  useEffect(() => {
    let active = true;
    const requestKey = resolutionKey;

    if (!userId) {
      setResolution({ key: requestKey, status: 'denied' });
      return () => { active = false; };
    }

    setResolution({ key: requestKey, status: 'loading' });
    void (supabase as any).rpc('current_user_has_clinical_capability', { p_capability: capability })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!active) return;
        if (error) {
          console.error('[MedicsPro] capability clínica:', error);
          setResolution({ key: requestKey, status: 'error' });
          return;
        }
        setResolution({ key: requestKey, status: data === true ? 'allowed' : 'denied' });
      })
      .catch((error: unknown) => {
        console.error('[MedicsPro] capability clínica:', error);
        if (active) setResolution({ key: requestKey, status: 'error' });
      });

    return () => { active = false; };
  }, [capability, resolutionKey, userId]);

  return stateFromStatus(status);
}
