import { addDays, format } from 'date-fns';
import { useMemo } from 'react';
import { MessageActivity } from '../components/messages/MessageActivity';
import { MessageTemplatesEditor } from '../components/messages/MessageTemplatesEditor';
import { Reveal, CountUp } from '../components/Reveal';
import { useMessageCenter } from '../hooks/useMessageCenter';
import { useApp } from '../lib/store';
import { dayOf } from '../lib/types';
import { Btn, Card, CardHead, Chip, IconAlert } from '../lib/ui';
import { IconSend, IconWhats } from '../components/icons';

export function Mensagens() {
  const { user, patients, appointments, surveys, access, toast } = useApp();
  const canSend = access('mensagens') === 'full';
  const { logs, templates, loading, queueConfirmations, saveTemplate } = useMessageCenter(user?.id);

  const counts = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const limit = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    const confirmations = appointments.filter((appointment) =>
      (appointment.status === 'agendado' || appointment.status === 'confirmado')
      && dayOf(appointment) >= today
      && dayOf(appointment) <= limit
      && patients.find((patient) => patient.id === appointment.pacienteId)?.optInWhats
    ).length;

    const recentCut = format(addDays(new Date(), -7), 'yyyy-MM-dd');
    const recentPatients = new Set(
      appointments
        .filter((appointment) => appointment.status === 'finalizado' && appointment.data >= recentCut && appointment.data <= today)
        .map((appointment) => appointment.pacienteId),
    );
    const nps = [...recentPatients].filter((patientId) => {
      const patient = patients.find((item) => item.id === patientId);
      return patient?.optInWhats && !surveys.some((survey) => survey.pacienteId === patientId && survey.nota === null);
    }).length;

    const inactive = patients.filter((patient) => patient.status === 'inativo' && patient.optInWhats && !patient.anonimizado).length;
    return { confirmations, nps, inactive };
  }, [appointments, patients, surveys]);

  const queued = logs.filter((log) => log.status === 'fila').length;
  const sending = logs.filter((log) => log.status === 'enviando').length;
  const delivered = logs.filter((log) => log.status === 'entregue' || log.status === 'lido').length;
  const read = logs.filter((log) => log.status === 'lido').length;
  const deliveryRate = logs.length ? Math.round((delivered / logs.length) * 100) : 0;
  const readRate = logs.length ? Math.round((read / logs.length) * 100) : 0;

  const runConfirmations = async () => {
    try {
      const count = await queueConfirmations();
      toast(count ? `${count} confirmação${count > 1 ? 'ões' : ''} adicionada${count > 1 ? 's' : ''} à fila.` : 'Nenhuma confirmação nova para enfileirar.', count ? 'ok' : 'info');
    } catch (error) {
      console.error('[MedicsPro] enfileirar confirmações:', error);
      toast('Não foi possível enfileirar as confirmações.', 'warn');
    }
  };

  const persistTemplate = async (id: string, body: string) => {
    try {
      await saveTemplate(id, body);
      toast('Modelo salvo para os próximos disparos.');
    } catch (error) {
      console.error('[MedicsPro] salvar modelo:', error);
      toast('Não foi possível salvar o modelo.', 'warn');
    }
  };

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Mensagens</h1>
            <p className="text-fog text-[13px] mt-0.5">fila persistente de comunicação · preparada para Evolution API sem acoplar regra de negócio ao provedor</p>
          </div>
          <Chip className="border-amber/45 text-amber ml-auto">Evolution: aguardando worker</Chip>
        </div>
      </Reveal>

      <Reveal delay={70}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {[
            { value: queued + sending, suffix: '', label: 'na fila agora', className: 'text-amber' },
            { value: deliveryRate, suffix: '%', label: 'taxa de entrega', className: 'text-aqua' },
            { value: readRate, suffix: '%', label: 'taxa de leitura', className: 'text-mint' },
            { value: logs.length, suffix: '', label: 'mensagens registradas', className: 'text-paper' },
          ].map((item) => (
            <div key={item.label} className="bg-panel px-5 py-4 hover:bg-raise/60 transition-colors">
              <CountUp to={item.value} suffix={item.suffix} className={`font-display text-3xl font-bold ${item.className}`} />
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 items-start">
        <div className="space-y-4">
          <Reveal delay={120}>
            <Card>
              <CardHead title="Gatilhos operacionais" sub={canSend ? 'ações criam registros reais na fila' : 'seu perfil é somente leitura'} />
              <div className="divide-y divide-line/70">
                <div className="px-5 py-4 flex items-start gap-3.5">
                  <span className="w-9 h-9 grid place-items-center border border-mint/40 text-mint bg-mint/5 shrink-0"><IconWhats className="w-4.5 h-4.5" /></span>
                  <div className="flex-1"><p className="font-display font-semibold text-[14px]">Confirmação de sessões (48h)</p><p className="text-[12px] text-fog mt-1">Enfileira somente sessões elegíveis, com opt-in e sem confirmação já aberta.</p><p className="font-mono text-[10.5px] text-amber mt-1.5">{counts.confirmations} potencial{counts.confirmations === 1 ? '' : 'is'}</p></div>
                  <Btn disabled={!canSend || loading || counts.confirmations === 0} onClick={runConfirmations}><IconWhats className="w-3.5 h-3.5" /> Enfileirar</Btn>
                </div>
                <div className="px-5 py-4 flex items-start gap-3.5 opacity-70">
                  <span className="w-9 h-9 grid place-items-center border border-line text-fog shrink-0"><IconSend className="w-4.5 h-4.5" /></span>
                  <div className="flex-1"><p className="font-display font-semibold text-[14px]">Pesquisa NPS pós-atendimento</p><p className="text-[12px] text-fog mt-1">Pronta para entrar na mesma outbox após o worker Evolution.</p><p className="font-mono text-[10.5px] text-fog mt-1.5">{counts.nps} pendência{counts.nps === 1 ? '' : 's'}</p></div>
                  <Btn disabled>Em preparação</Btn>
                </div>
                <div className="px-5 py-4 flex items-start gap-3.5 opacity-70">
                  <span className="w-9 h-9 grid place-items-center border border-line text-fog shrink-0"><IconAlert className="w-4.5 h-4.5" /></span>
                  <div className="flex-1"><p className="font-display font-semibold text-[14px]">Reativação de pacientes inativos</p><p className="text-[12px] text-fog mt-1">Entrará como campanha controlada depois que o canal estiver conectado.</p><p className="font-mono text-[10.5px] text-fog mt-1.5">{counts.inactive} elegível{counts.inactive === 1 ? '' : 'is'}</p></div>
                  <Btn disabled>Em preparação</Btn>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={180}>
            <MessageTemplatesEditor templates={templates} busy={loading} onSave={persistTemplate} />
          </Reveal>
        </div>

        <Reveal delay={140}>
          <MessageActivity logs={logs} patients={patients} />
        </Reveal>
      </div>
    </div>
  );
}
