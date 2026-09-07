import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ClinicalCapabilityKey } from '../lib/professionalIdentity';

export function useClinicalCapability(capability: ClinicalCapabilityKey, userId: string | null | undefined) {
  const [allowed, setAllowed] = useState<boolean | null>(userId ? null : false);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setAllowed(false);
      return () => { active = false; };
    }

    setAllowed(null);
    void (supabase as any).rpc('current_user_has_clinical_capability', { p_capability_key: capability })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!active) return;
        if (error) {
          console.error('[MedicsPro] capability clínica:', error);
          setAllowed(false);
          return;
        }
        setAllowed(data === true);
      })
      .catch((error: unknown) => {
        console.error('[MedicsPro] capability clínica:', error);
        if (active) setAllowed(false);
      });

    return () => { active = false; };
  }, [capability, userId]);

  return { allowed: allowed === true, loading: allowed === null };
}
