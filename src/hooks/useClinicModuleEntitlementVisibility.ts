import { useEffect, useState } from 'react';
import {
  loadCurrentClinicModuleVisibility,
  type ModuleEntitlementVisibility,
} from '../lib/clinicEntitlementMenu';

const REVALIDATION_INTERVAL_MS = 60_000;

export function useClinicModuleEntitlementVisibility() {
  const [visibility, setVisibility] = useState<ModuleEntitlementVisibility>({});
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let active = true;

    const refresh = async (failClosedWhileChecking = false) => {
      if (failClosedWhileChecking && active) {
        setVisibility({});
        setResolved(false);
      }

      try {
        const next = await loadCurrentClinicModuleVisibility();
        if (active) {
          setVisibility(next);
          setResolved(true);
        }
      } catch (cause) {
        console.error('[Entitlements] dashboard visibility:', cause);
        if (active) {
          setVisibility({});
          setResolved(false);
        }
      }
    };

    void refresh(true);

    const handleFocus = () => { void refresh(true); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh(true);
    };
    const intervalId = window.setInterval(() => { void refresh(false); }, REVALIDATION_INTERVAL_MS);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return { visibility, resolved };
}
