import { ClinicianDashboard } from '../components/dashboards/ClinicianDashboard';
import { PsychiatryNexusDashboard } from '../components/dashboards/PsychiatryNexusDashboard';
import { ReceptionDashboard } from '../components/dashboards/ReceptionDashboard';
import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import { isPsychiatristIdentity } from '../lib/professionalIdentity';
import { useApp } from '../lib/store';
import { Dashboard } from './Dashboard';

export function DashboardRoleAware() {
  const { user } = useApp();
  const { identity, loading } = useProfessionalIdentity(user?.id);

  if (user?.role === 'recep') return <ReceptionDashboard />;

  if (user?.role === 'fisio') {
    if (!loading && isPsychiatristIdentity(identity)) return <PsychiatryNexusDashboard />;
    return <ClinicianDashboard />;
  }

  return <Dashboard />;
}
