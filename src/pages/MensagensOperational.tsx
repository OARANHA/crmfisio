import { AutomationControlPanel } from '../components/messages/AutomationControlPanel';
import { useApp } from '../lib/store';
import { Mensagens } from './Mensagens';

export function MensagensOperational() {
  const { user, toast } = useApp();
  return <div className="space-y-4">
    <Mensagens />
    {user?.role === 'admin' && <AutomationControlPanel onToast={toast} />}
  </div>;
}
