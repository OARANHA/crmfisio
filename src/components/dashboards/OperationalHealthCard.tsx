import { useMemo } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAgenda } from '../../lib/agendaContext';
import { useCommunication } from '../../lib/communicationContext';
import { useUnitFilter } from '../../lib/infrastructureContext';
import { Card, CardHead, IconChevronR } from '../../lib/ui';
import { useClinicModuleEntitlementVisibility } from '../../hooks/useClinicModuleEntitlementVisibility';

export function OperationalHealthCard() {
  const { appointments } = useAgenda();
  const { waLogs } = useCommunication();
  const inUnit = useUnitFilter();
  const { visibility, resolved } = useClinicModuleEntitlementVisibility();
  const messagesAllowed = resolved && visibility.mensagens === true;
  const today = format(new Date(), 'yyyy-MM-dd');
  const metrics = useMemo(() => {
    const todayAppointments = appointments.filter((a) => a.data === today && inUnit(a));
    const pendingConfirmations = todayAppointments.filter((a) => a.status === 'agendado').length;
    const noShows = todayAppointments.filter((a) => a.status === 'faltou').length;
    const inService = todayAppointments.filter((a) => a.status === 'em_atendimento').length;
    const failedMessages = messagesAllowed ? waLogs.filter((log) => log.status === 'falhou').length : 0;
    return { pendingConfirmations, noShows, inService, failedMessages };
  }, [appointments, waLogs, today, inUnit, messagesAllowed]);

  const healthMetrics = [
    { label: 'A confirmar hoje', value: metrics.pendingConfirmations, tone: metrics.pendingConfirmations ? 'text-amber' : 'text-mint' },
    { label: 'Faltas hoje', value: metrics.noShows, tone: metrics.noShows ? 'text-pulse' : 'text-mint' },
    { label: 'Em atendimento', value: metrics.inService, tone: metrics.inService ? 'text-aqua' : 'text-fog' },
    ...(messagesAllowed ? [{ label: 'Mensagens com falha', value: metrics.failedMessages, tone: metrics.failedMessages ? 'text-pulse' : 'text-mint' }] : []),
  ];

  return (
    <Card>
      <CardHead
        title="Saúde operacional"
        sub={messagesAllowed ? 'agenda e comunicação que merecem atenção' : 'agenda que merece atenção'}
      />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-px bg-line border-y border-line">
        {healthMetrics.map((item) => (
          <div key={item.label} className="bg-panel px-4 py-3">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-fog">{item.label}</p>
            <p className={`font-display text-2xl font-bold mt-1 ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>
      <div className="p-4 flex flex-wrap items-center gap-2 text-[11px]">
        <Link to="/hoje" className="inline-flex items-center gap-1 text-aqua hover:text-paper">Recepção hoje <IconChevronR className="w-3 h-3" /></Link>
        {messagesAllowed && <Link to="/mensagens" className="inline-flex items-center gap-1 text-mint hover:text-paper">Mensagens <IconChevronR className="w-3 h-3" /></Link>}
      </div>
    </Card>
  );
}
