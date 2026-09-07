import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function usePhysiotherapyAuthorship(userId: string | null | undefined) {
  const [allowed, setAllowed] = useState<boolean | null>(userId ? null : false);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setAllowed(false);
      return () => { active = false; };
    }

    setAllowed(null);
    void (supabase as any).rpc('current_user_can_author_physiotherapy')
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!active) return;
        if (error) {
          console.error('[MedicsPro] autoria fisioterapêutica:', error);
          setAllowed(false);
          return;
        }
        setAllowed(data === true);
      })
      .catch((error: unknown) => {
        console.error('[MedicsPro] autoria fisioterapêutica:', error);
        if (active) setAllowed(false);
      });

    return () => { active = false; };
  }, [userId]);

  return { canAuthorPhysiotherapy: allowed === true, loading: allowed === null };
}
