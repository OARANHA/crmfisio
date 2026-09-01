import { addHours, format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';
import { MessageActivity } from '../components/messages/MessageActivity';
import { MessageRecipientSelector, type MessageRecipientCandidate } from '../components/messages/MessageRecipientSelector';
import { MessageReviewQueue } from '../components/messages/MessageReviewQueue';
import { MessageTemplatesEditor } from '../components/messages/MessageTemplatesEditor';
import { Reveal, CountUp } from '../components/Reveal';
import { useMessageCenter } from '../hooks/useMessageCenter';
import { useApp } from '../lib/store';
import { Btn, Chip } from '../lib/ui';

const OPEN_MESSAGE_STATUS = new Set(['fila', 'enviando', 'enviado', 'entregue', 'lido']);

function appointmentDateTime(data: string, inicio: string) {
  const time = inicio.length === 5 ? `${inicio}:00` : inicio;
  return new Date(`${data}T${time}`);
}

export function Mensagens() {
  const { user, patients, appointments, access, toast } = useApp();
  const canSend = access('mensagens') === 'full';
  const {
    logs, templates, loading, queueSelectedConfirmations, queueSelectedNps,
    resolveReview, flush, saveTemplate,
  } = useMessageCenter(user?.id);

  const confirmationSelection = useMemo(() => {
    const now = new Date();
    const limit = addHours(now, 48);
    const stats = { noOptin: 0, noPhone: 0, alreadySent: 0 };
    const candidates: MessageRecipientCandidate[] = [];

    appointments
      .filter((appointment) => ['agendado', 'confirmado'].includes(appointment.status))
      .filter((appointment) => {
        const at = appointmentDateTime(appointment.data, appointment.inicio);
        return at >= now && at <= limit;
      })
      .sort((a, b) => appointmentDateTime(a.data, a.inicio).getTime() - appointmentDateTime(b.data, b.inicio).getTime())
      .forEach((appointment) => {
        const patient = patients.find((item) => item.id === appointment.pacienteId);
        if (!patient || patient.anonimizado) return;
        if (!patient.optInWhats) { stats.noOptin += 1; return; }
        if (!patient.telefone?.trim()) { stats.noPhone += 1; return; }
        const duplicate = logs.some((log) => log.appointmentId === appointment.id && log.template === 'confirmacao' && OPEN_MESSAGE_STATUS.has(log.status));
        if (duplicate) { stats.alreadySent += 1; return; }
        const at = appointmentDateTime(appointment.data, appointment.inicio);
        candidates.push({
          id: appointment.id,
          patientId: patient.id,
          patientName: patient.nome,
          primary: `${format(at, "dd/MM 'às' HH:mm", { locale: ptBR })} · ${appointment.tipo}`,
          secondary: patient.telefone,
        });
      });

    return { candidates, stats };
  }, [appointments, patients, logs]);

  const npsSelection = useMemo(() => {
    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    const cutoffKey = format(subDays(today, 7), 'yyyy-MM-dd');
    const stats = { noOptin: 0, noPhone: 0, alreadySent: 0 };
    const candidates: MessageRecipientCandidate[] = [];

    appointments
      .filter((appointment) => appointment.status === 'finalizado')
      .filter((appointment) => appointment.data >= cutoffKey && appointment.data <= todayKey)
      .sort((a, b) => appointmentDateTime(b.data, b.inicio).getTime() - appointmentDateTime(a.data, a.inicio).getTime())
      .forEach((appointment) => {
        const patient = patients.find((item) => item.id === appointment.pacienteId);
        if (!patient || patient.anonimizado) return;
        if (!patient.optInWhats) { stats.noOptin += 1; return; }
        if (!patient.telefone?.trim()) { stats.noPhone += 1; return; }
        const duplicate = logs.some((log) => log.appointmentId === appointment.id && log.template === 'nps' && OPEN_MESSAGE_STATUS.has(log.status));
        if (duplicate) { stats.alreadySent += 1; return; }
        candidates.push({
          id: appointment.id,
          patientId: patient.id,
          patientName: patient.nome,
          primary: `Atendimento ${format(parseISO(appointment.data), 'dd/MM/yyyy', { locale: ptBR })} às ${appointment.inicio.slice(0, 5)} · ${appointment.tipo}`,
          secondary: patient.telefone,
        });
      });

    return { candidates, stats };
  }, [appointments, patients, logs]);

  const inactive = patients.filter((patient) => patient.status === 'inativo' && patient.optInWhats && !patient.anonimizado).length;
  const queued = logs.filter((log) => log.status === 'fila').length;
  const sending = logs.filter((log) => log.status === 'enviando').length;
  const sentBase = logs.filter((log) => ['enviado', 'entregue', 'lido'].includes(log.status));
  const delivered = sentBase.filter((log) => log.status === 'entregue' || log.status === 'lido').length;
  const read = sentBase.filter((log) => log.status === 'lido').length;
  const humanReview = logs.filter((log) => log.needsHuman).length;
  const replied = logs.filter((log) => Boolean(log.replyText)).length;
  const deliveryRate = sentBase.length ? Math.round((delivered / sentBase.length) * 100) : 0;
  const readRate = delivered ? Math.round((read / delivered) * 100) : 0;

  const blockedText = (stats: { noOptin: number; noPhone: number; alreadySent: number }) => {
    const parts = [
      stats.noOptin ? `${stats.noOptin} sem opt-in` : '',
      stats.noPhone ? `${stats.noPhone} sem telefone` : '',
      stats.alreadySent ? `${stats.alreadySent} atendimento(s) já pesquisado(s)` : '',
    ].filter(Boolean);
    return parts.length ? `Fora da seleção: ${parts.join(' · ')}` : '';
  };

  const sendConfirmations = async (ids: string[]) => {
    try {
      const { queued: count, dispatch } = await queueSelectedConfirmations(ids);
      if (!count) return toast('Nenhuma das sessões selecionadas continua elegível para confirmação.', 'info');
      if (dispatch.failed) toast(`${dispatch.sent} enviada(s) e ${dispatch.failed} falhou(aram).`, 'warn');
      else toast(`${dispatch.sent} confirmação${dispatch.sent === 1 ? '' : 'ões'} enviada${dispatch.sent === 1 ? '' : 's'} pelo WhatsApp.`);
    } catch (error) {
      console.error('[MedicsPro] confirmações selecionadas:', error);
      toast('Não foi possível enviar as confirmações selecionadas.', 'warn');
    }
  };

  const sendNps = async (ids: string[]) => {
    try {
      const { queued: count, dispatch } = await queueSelectedNps(ids);
      if (!count) return toast('Nenhum dos atendimentos selecionados continua elegível para NPS.', 'info');
      if (dispatch.failed) toast(`${dispatch.sent} NPS enviado(s) e ${dispatch.failed} falhou(aram).`, 'warn');
      else toast(`${dispatch.sent} pesquisa${dispatch.sent === 1 ? '' : 's'} NPS enviada${dispatch.sent === 1 ? '' : 's'} pelo WhatsApp.`);
    } catch (error) {
      console.error('[MedicsPro] NPS selecionado:', error);
      toast('Não foi possível enviar o NPS dos atendimentos selecionados.', 'warn');
    }
  };

  const runPendingQueue = async () => {
    try {
      const dispatch = await flush(50);
      if (!dispatch.processed) toast('Não há mensagens pendentes para enviar.', 'info');
      else if (dispatch.failed) toast(`${dispatch.sent} enviada(s) e ${dispatch.failed} falhou(aram).`, 'warn');
      else toast(`${dispatch.sent} mensagem${dispatch.sent === 1 ? '' : 'ens'} enviada${dispatch.sent === 1 ? '' : 's'} pela Evolution.`);
    } catch (error) {
      console.error('[MedicsPro] processar fila:', error);
      toast('Não foi possível processar a fila de mensagens.', 'warn');
    }
  };

  const handleReview = async (logId: string, resolution: string) => {
    try { await resolveReview(logId, resolution); toast('Revisão concluída e registrada.'); }
    catch (error) { console.error('[MedicsPro] concluir revisão WhatsApp:', error); toast('Não foi possível concluir a revisão.', 'warn'); }
  };

  const persistTemplate = async (id: string, body: string) => {
    try { await saveTemplate(id, body); toast('Modelo salvo para os próximos disparos.'); }
    catch (error) { console.error('[MedicsPro] salvar modelo:', error); toast('Não foi possível salvar o modelo.', 'warn'); }
  };

  return <div className="space-y-4">
    <Reveal><div className="flex flex-wrap items-center gap-3"><div><h1 className="font-display text-3xl font-bold tracking-tight">Mensagens</h1><p className="text-fog text-[13px] mt-0.5">fila persistente · destinatários selecionáveis · respostas auditáveis</p></div><Chip className="border-mint/45 text-mint ml-auto">Evolution integrada</Chip>{humanReview > 0 && <Chip className="border-amber/45 text-amber">{humanReview} para revisar</Chip>}{canSend && queued > 0 && <Btn variant="subtle" disabled={loading} onClick={runPendingQueue}>Processar fila ({queued})</Btn>}</div></Reveal>

    <Reveal delay={60}><div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-line border border-line">{[
      { value: queued + sending, suffix: '', label: 'na fila agora', className: 'text-amber' },
      { value: deliveryRate, suffix: '%', label: 'taxa de entrega', className: 'text-aqua' },
      { value: readRate, suffix: '%', label: 'taxa de leitura', className: 'text-mint' },
      { value: replied, suffix: '', label: 'respostas recebidas', className: 'text-aqua' },
      { value: humanReview, suffix: '', label: 'revisões humanas', className: humanReview ? 'text-amber' : 'text-paper' },
    ].map((item) => <div key={item.label} className="bg-panel px-5 py-4"><CountUp to={item.value} suffix={item.suffix} className={`font-display text-3xl font-bold ${item.className}`} /><p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog mt-1">{item.label}</p></div>)}</div></Reveal>

    <Reveal delay={90}><MessageReviewQueue logs={logs} patients={patients} busy={loading || !canSend} onResolve={handleReview} /></Reveal>

    <div className="grid xl:grid-cols-2 gap-4 items-start">
      <Reveal delay={110}><MessageRecipientSelector title="Confirmação de sessões — próximas 48h" sub="Escolha uma, várias ou todas as sessões elegíveis. O backend revalida as regras antes do envio." candidates={confirmationSelection.candidates} blockedSummary={blockedText(confirmationSelection.stats)} busy={loading} canSend={canSend} accent="mint" onSend={sendConfirmations} /></Reveal>
      <Reveal delay={130}><MessageRecipientSelector title="Pesquisa NPS — atendimentos dos últimos 7 dias" sub="Cada atendimento finalizado pode gerar sua própria pesquisa. Um NPS anterior do mesmo paciente não bloqueia uma nova sessão." candidates={npsSelection.candidates} blockedSummary={blockedText(npsSelection.stats)} busy={loading} canSend={canSend} accent="aqua" onSend={sendNps} /></Reveal>
    </div>

    <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 items-start">
      <div className="space-y-4">
        <Reveal delay={160}><div className="border border-line bg-panel px-5 py-4"><p className="font-display font-semibold text-[14px]">Reativação de pacientes inativos</p><p className="text-[12px] text-fog mt-1">Entrará como campanha controlada após fecharmos opt-out e frequência de contato.</p><p className="font-mono text-[10.5px] text-fog mt-2">{inactive} elegível{inactive === 1 ? '' : 'is'} · em preparação</p></div></Reveal>
        <Reveal delay={180}><MessageTemplatesEditor templates={templates} busy={loading} onSave={persistTemplate} /></Reveal>
      </div>
      <Reveal delay={150}><MessageActivity logs={logs} patients={patients} /></Reveal>
    </div>
  </div>;
}
