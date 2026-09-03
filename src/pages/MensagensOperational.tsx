import { AutomationControlPanel } from '../components/messages/AutomationControlPanel';
import { useApp } from '../lib/store';
import { Mensagens } from './Mensagens';
import { isClinicManager } from '../lib/permissions';

export function MensagensOperational() {
  const { user, toast } = useApp();
  return <div className="space-y-4">
    <Mensagens />
    {isClinicManager(user?.role) && <AutomationControlPanel onToast={toast} />}
  </div>;
}
