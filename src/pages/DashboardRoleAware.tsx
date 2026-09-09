import { useEffect, useState } from 'react';
import { ClinicianDashboard } from '../components/dashboards/ClinicianDashboard';
import { PsychiatryNexusDashboard } from '../components/dashboards/PsychiatryNexusDashboard';
import { ReceptionDashboard } from '../components/dashboards/ReceptionDashboard';
import { useClinicalCapability } from '../hooks/useClinicalCapability';
import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import { useAuth } from '../lib/useAuth';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { resolveDashboardPresentation } from '../lib/dashboardPresentation';
import { hasProfessionalCapability } from '../lib/nexusClinical';
import { isPsychiatristIdentity } from '../lib/professionalIdentity';
import { Dashboard } from './Dashboard';

export function DashboardRoleAware() {
  const { loading: authLoading } = useAuth();
  const { user } = useCurrentUserAccess();
  const { identity, loading: identityLoading } = useProfessionalIdentity(user?.id);
  const attendCapability = useClinicalCapability('clinical.attend', user?.id);
  const [nexusAllowed, setNexusAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setNexusAllowed(false);
      return () => { active = false; };
    }

    setNexusAllowed(null);
    void hasProfessionalCapability('nexus.access')
      .then((allowed) => {
        if (active) setNexusAllowed(allowed);
      })
      .catch((error) => {
        console.error('[Nexus] dashboard capability:', error);
        if (active) setNexusAllowed(false);
      });

    return () => { active = false; };
  }, [user?.id]);

  const presentation = resolveDashboardPresentation({
    authLoading,
    userPresent: Boolean(user),
    role: user?.role,
    attendStatus: attendCapability.status,
    identityLoading,
    psychiatryRelevant: isPsychiatristIdentity(identity),
    nexusStatus: nexusAllowed === null ? 'loading' : nexusAllowed ? 'allowed' : 'denied',
  });

  if (presentation === 'loading') return <DashboardResolutionSkeleton />;
  if (presentation === 'reception') return <ReceptionDashboard />;
  if (presentation === 'psychiatry') return <PsychiatryNexusDashboard />;
  if (presentation === 'clinician') return <ClinicianDashboard />;
  return <Dashboard />;
}

function DashboardResolutionSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Preparando sua área de trabalho">
      <section className="overflow-hidden rounded-[26px] border border-line/70 bg-panel p-5 shadow-[0_20px_55px_rgba(0,0,0,0.055)] sm:p-6">
        <div className="h-3 w-32 animate-pulse rounded-full bg-raise" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded-xl bg-raise" />
        <div className="mt-3 h-3 w-96 max-w-full animate-pulse rounded-full bg-raise/80" />
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-[22px] border border-line/65 bg-panel" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="h-64 animate-pulse rounded-[22px] border border-line/65 bg-panel" />
        <div className="h-64 animate-pulse rounded-[22px] border border-line/65 bg-panel" />
      </div>
    </div>
  );
}
