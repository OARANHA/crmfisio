import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useCommunication } from '../../lib/communicationContext';
import { useUnitFilter } from '../../lib/infrastructureContext';
import { loadAutomationRuns, type AutomationRun } from '../../lib/automation';
import { Card, CardHead, Chip, IconChevronR } from '../../lib/ui';

export function OperationalHealthCard() {
  const { appointments } = useApp();
  const { waLogs } = useCommunication();
  const inUnit = useUnitFilter();
  const [lastRun, setLastRun] = useState<AutomationRun | null>(null);
  const [automationUnavailable, setAutomationUnavailable] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    let cancelled = false;
    loadAutomationRuns(1)
      .then((runs) => {
        if (!cancelled) setLastRun(runs[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setAutomationUnavailable(true);
      });
    return () => { cancelled = true; };
  }, []);

  const metrics = useMemo(() => {
    const todayAppointments = appointments.filter((a) => a.data === today && inUnit(a));
    const pendingConfirmations = todayAppointments.filter((a) => a.status === 'agendado').length;
    const noShows = todayAppointments.filter((a) => a.status === 'faltou').length;
    const inService = todayAppointments.filter((a) => a.status === 'em_atendimento').length;
    const failedMessages = waLogs.filter((log) => log.status === 'falhou').length;
    return { pendingConfirmations, noShows, inService, failedMessages };
  }, [appointments, waLogs, today, inUnit]);

  const healthy = lastRun?.status === 'completed' && (lastRun.workerFailed ?? 0) === 0;

  return (
    <Card>
      <CardHead
        title="Saúde operacional"
        sub="agenda, comunicação e automações que merecem atenção"
        right={automationUnavailable
          ? <Chip className="border-line text-fog">automação indisponível</Chip>
          : <Chip className={healthy ? 'border-mint/40 text-mint' : lastRun?.status === 'failed' ? 'border-pulse/40 text-pulse' : 'border-amber/40 text-amber'}>
              {!lastRun ? 'sem execução' : healthy ? 'automação saudável' : lastRun.status === 'failed' ? 'automação com falha' : 'verificar automação'}
            </Chip>}
      />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-px bg-line border-y border-line">
        {[
          { label: 'A confirmar hoje', value: metrics.pendingConfirmations, tone: metrics.pendingConfirmations ? 'text-amber' : 'text-mint' },
          { label: 'Faltas hoje', value: metrics.noShows, tone: metrics.noShows ? 'text-pulse' : 'text-mint' },
          { label: 'Em atendimento', value: metrics.inService, tone: metrics.inService ? 'text-aqua' : 'text-fog' },
          { label: 'Mensagens com falha', value: metrics.failedMessages, tone: metrics.failedMessages ? 'text-pulse' : 'text-mint' },
        ].map((item) => (
          <div key={item.label} className="bg-panel px-4 py-3">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-fog">{item.label}</p>
            <p className={`font-display text-2xl font-bold mt-1 ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>
      <div className="p-4 flex flex-wrap items-center gap-2 text-[11px]">
        {lastRun && <span className="font-mono text-fog mr-auto">
          Última automação: {new Date(lastRun.startedAt).toLocaleString('pt-BR')} · {lastRun.workerSent}/{lastRun.workerProcessed} enviados
        </span>}
        <Link to="/hoje" className="inline-flex items-center gap-1 text-aqua hover:text-paper">Recepção hoje <IconChevronR className="w-3 h-3" /></Link>
        <Link to="/mensagens" className="inline-flex items-center gap-1 text-mint hover:text-paper">Mensagens <IconChevronR className="w-3 h-3" /></Link>
      </div>
    </Card>
  );
}
