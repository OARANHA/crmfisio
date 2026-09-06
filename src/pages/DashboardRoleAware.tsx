import { useEffect, useState } from 'react';
import { ClinicianDashboard } from '../components/dashboards/ClinicianDashboard';
import { PsychiatryNexusDashboard } from '../components/dashboards/PsychiatryNexusDashboard';
import { ReceptionDashboard } from '../components/dashboards/ReceptionDashboard';
import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import { hasProfessionalCapability } from '../lib/nexusClinical';
import { isPsychiatristIdentity } from '../lib/professionalIdentity';
import { useApp } from '../lib/store';
import { Dashboard } from './Dashboard';

export function DashboardRoleAware() {
  const { user } = useApp();
  const { identity, loading } = useProfessionalIdentity(user?.id);
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

  return <Dashboard />;
}
