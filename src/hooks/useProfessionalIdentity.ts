import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ProfessionalIdentity } from '../lib/professionalIdentity';

export function useProfessionalIdentity(userId: string | null | undefined) {
  const [identity, setIdentity] = useState<ProfessionalIdentity | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setIdentity(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = supabase as any;
    db.from('profiles')
      .select('professional_type, especialidade, council_type')
      .eq('id', userId)
      .eq('ativo', true)
      .maybeSingle()
      .then(({ data, error }: { data: any; error: any }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[MedicsPro] identidade profissional indisponível:', error);
          setIdentity(null);
        } else {
          setIdentity({
            professionalType: data?.professional_type ?? null,
            specialty: data?.especialidade ?? null,
            councilType: data?.council_type ?? null,
          });
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  return { identity, loading };
}
