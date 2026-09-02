import { ClinicianDashboard } from '../components/dashboards/ClinicianDashboard';
import { ReceptionDashboard } from '../components/dashboards/ReceptionDashboard';
import { useApp } from '../lib/store';
import { Dashboard } from './Dashboard';

export function DashboardRoleAware() {
  const { user } = useApp();
  if (user?.role === 'recep') return <ReceptionDashboard />;
  if (user?.role === 'fisio') return <ClinicianDashboard />;
  return <Dashboard />;
}
