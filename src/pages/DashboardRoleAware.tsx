import { useEffect, useState } from 'react';
import { ClinicianDashboard } from '../components/dashboards/ClinicianDashboard';
import { PsychiatryNexusDashboard } from '../components/dashboards/PsychiatryNexusDashboard';
import { ReceptionDashboard } from '../components/dashboards/ReceptionDashboard';
import { usePhysiotherapyAuthorship } from '../hooks/usePhysiotherapyAuthorship';
import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { hasProfessionalCapability } from '../lib/nexusClinical';
import { isPsychiatristIdentity } from '../lib/professionalIdentity';
import { Dashboard } from './Dashboard';

export function DashboardRoleAware() {
  const { user } = useCurrentUserAccess();
  const { identity, loading } = useProfessionalIdentity(user?.id);
  const { canAuthorPhysiotherapy, loading: authorshipLoading } = usePhysiotherapyAuthorship(user?.id);
  const [nexusAllowed, setNexusAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (user?.role !== 'fisio') {
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
  }, [user?.id, user?.role]);

  if (user?.role === 'recep') return <ReceptionDashboard />;

  if (user?.role === 'fisio') {
    if (!loading && nexusAllowed === true && isPsychiatristIdentity(identity)) return <PsychiatryNexusDashboard />;
    return <ClinicianDashboard />;
  }

  if (!authorshipLoading && canAuthorPhysiotherapy) return <ClinicianDashboard />;

  return <Dashboard />;
}
