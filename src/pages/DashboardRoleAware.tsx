import { ReceptionDashboard } from '../components/dashboards/ReceptionDashboard';
import { useApp } from '../lib/store';
import { Dashboard } from './Dashboard';

export function DashboardRoleAware() {
  const { user } = useApp();
  return user?.role === 'recep' ? <ReceptionDashboard /> : <Dashboard />;
}
