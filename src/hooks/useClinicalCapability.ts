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

const stateFromStatus = (status: ClinicalCapabilityStatus): ClinicalCapabilityState => ({
  status,
  allowed: status === 'allowed',
  loading: status === 'loading',
  denied: status === 'denied',
  error: status === 'error',
});

export function useClinicalCapability(capability: ClinicalCapabilityKey, userId: string | null | undefined): ClinicalCapabilityState {
  const [status, setStatus] = useState<ClinicalCapabilityStatus>(userId ? 'loading' : 'denied');

  useEffect(() => {
    let active = true;
    if (!userId) {
      setStatus('denied');
      return () => { active = false; };
    }

    setStatus('loading');
    void (supabase as any).rpc('current_user_has_clinical_capability', { p_capability: capability })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!active) return;
        if (error) {
          console.error('[MedicsPro] capability clínica:', error);
          setStatus('error');
          return;
        }
        setStatus(data === true ? 'allowed' : 'denied');
      })
      .catch((error: unknown) => {
        console.error('[MedicsPro] capability clínica:', error);
        if (active) setStatus('error');
      });

    return () => { active = false; };
  }, [capability, userId]);

  return stateFromStatus(status);
}
