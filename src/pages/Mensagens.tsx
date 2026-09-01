import { addDays, format } from 'date-fns';
import { useMemo } from 'react';
import { MessageActivity } from '../components/messages/MessageActivity';
import { MessageReviewQueue } from '../components/messages/MessageReviewQueue';
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
  const { logs, templates, loading, queueConfirmations, queueNps, resolveReview, flush, saveTemplate } = useMessageCenter(user?.id);

  const counts = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const limit = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    const confirmations = appointments.filter((appointment) =>
      (appointment.status === 'agendado' || appointment.status === 'confirmado') && dayOf(appointment) >= today && dayOf(appointment) <= limit && patients.find((patient) => patient.id === appointment.pacienteId)?.optInWhats
    ).length;
    const recentCut = format(addDays(new Date(), -7), 'yyyy-MM-dd');
    const recentPatients = new Set(appointments.filter((appointment) => appointment.status === 'finalizado' && appointment.data >= recentCut && appointment.data <= today).map((appointment) => appointment.pacienteId));
    const nps = [...recentPatients].filter((patientId) => {
      const patient = patients.find((item) => item.id === patientId);
      return patient?.optInWhats && !surveys.some((survey) => survey.pacienteId === patientId && survey.nota === null);
    }).length;
    const inactive = patients.filter((patient) => patient.status === 'inativo' && patient.optInWhats && !patient.anonimizado).length;
    return { confirmations, nps, inactive };
  }, [appointments, patients, surveys]);

  const queued = logs.filter((log) => log.status === 'fila').length;
  const sending = logs.filter((log) => log.status === 'enviando').length;
  const sentBase = logs.filter((log) => ['enviado', 'entregue', 'lido'].includes(log.status));
  const delivered = sentBase.filter((log) => log.status === 'entregue' || log.status === 'lido').length;
  const read = sentBase.filter((log) => log.status === 'lido').length;
  const humanReview = logs.filter((log) => log.needsHuman).length;
  const replied = logs.filter((log) => Boolean(log.replyText)).length;
  const npsSent = logs.filter((log) => log.template === 'nps' && !['fila', 'enviando', 'falhou', 'cancelado'].includes(log.status)).length;
  const npsAnswered = logs.filter((log) => log.template === 'nps' && log.replyText !== null).length;
  const deliveryRate = sentBase.length ? Math.round((delivered / sentBase.length) * 100) : 0;
  const readRate = delivered ? Math.round((read / delivered) * 100) : 0;

  const runConfirmations = async () => { try { const { queued: count, dispatch } = await queueConfirmations(); if (!count) return toast('Nenhuma confirmação nova para enviar.', 'info'); if (dispatch.failed) toast(`${dispatch.sent} enviada(s) e ${dispatch.failed} falhou(aram). Veja a atividade recente.`, 'warn'); else toast(`${dispatch.sent} confirmação${dispatch.sent === 1 ? '' : 'ões'} enviada${dispatch.sent === 1 ? '' : 's'} pelo WhatsApp.`); } catch (error) { console.error('[MedicsPro] enviar confirmações:', error); toast('Não foi possível enviar as confirmações.', 'warn'); } };
  const runNps = async () => { try { const { queued: count, dispatch } = await queueNps(); if (!count) return toast('Nenhuma pesquisa NPS nova para enviar.', 'info'); if (dispatch.failed) toast(`${dispatch.sent} NPS enviado(s) e ${dispatch.failed} falhou(aram).`, 'warn'); else toast(`${dispatch.sent} pesquisa${dispatch.sent === 1 ? '' : 's'} NPS enviada${dispatch.sent === 1 ? '' : 's'} pelo WhatsApp.`); } catch (error) { console.error('[MedicsPro] enviar NPS:', error); toast('Não foi possível enviar as pesquisas NPS.', 'warn'); } };
  const runPendingQueue = async () => { try { const dispatch = await flush(50); if (!dispatch.processed) toast('Não há mensagens pendentes para enviar.', 'info'); else if (dispatch.failed) toast(`${dispatch.sent} enviada(s) e ${dispatch.failed} falhou(aram).`, 'warn'); else toast(`${dispatch.sent} mensagem${dispatch.sent === 1 ? '' : 'ens'} enviada${dispatch.sent === 1 ? '' : 's'} pela Evolution.`); } catch (error) { console.error('[MedicsPro] processar fila:', error); toast('Não foi possível processar a fila de mensagens.', 'warn'); } };
  const handleReview = async (logId: string, resolution: string) => { try { await resolveReview(logId, resolution); toast('Revisão concluída e registrada.'); } catch (error) { console.error('[MedicsPro] concluir revisão WhatsApp:', error); toast('Não foi possível concluir a revisão.', 'warn'); } };
  const persistTemplate = async (id: string, body: string) => { try { await saveTemplate(id, body); toast('Modelo salvo para os próximos disparos.'); } catch (error) { console.error('[MedicsPro] salvar modelo:', error); toast('Não foi possível salvar o modelo.', 'warn'); } };

  return <div className="space-y-4">
    <Reveal><div className="flex flex-wrap items-center gap-3"><div><h1 className="font-display text-3xl font-bold tracking-tight">Mensagens</h1><p className="text-fog text-[13px] mt-0.5">fila persistente · respostas auditáveis · automação com revisão humana</p></div><Chip className="border-mint/45 text-mint ml-auto">Evolution integrada</Chip>{humanReview > 0 && <Chip className="border-amber/45 text-amber">{humanReview} para revisar</Chip>}{canSend && queued > 0 && <Btn variant="subtle" disabled={loading} onClick={runPendingQueue}>Processar fila ({queued})</Btn>}</div></Reveal>
    <Reveal delay={70}><div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-line border border-line">{[
      { value: queued + sending, suffix: '', label: 'na fila agora', className: 'text-amber' },
      { value: deliveryRate, suffix: '%', label: 'taxa de entrega', className: 'text-aqua' },
      { value: readRate, suffix: '%', label: 'taxa de leitura', className: 'text-mint' },
      { value: replied, suffix: '', label: 'respostas recebidas', className: 'text-aqua' },
      { value: humanReview, suffix: '', label: 'revisões humanas', className: humanReview ? 'text-amber' : 'text-paper' },
    ].map((item) => <div key={item.label} className="bg-panel px-5 py-4 hover:bg-raise/60 transition-colors"><CountUp to={item.value} suffix={item.suffix} className={`font-display text-3xl font-bold ${item.className}`} /><p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog mt-1">{item.label}</p></div>)}</div></Reveal>
    {humanReview > 0 && <Reveal delay={90}><MessageReviewQueue logs={logs} patients={patients} busy={loading || !canSend} onResolve={handleReview} /></Reveal>}
    <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 items-start"><div className="space-y-4"><Reveal delay={120}><Card><CardHead title="Gatilhos operacionais" sub={canSend ? 'ações enfileiram e despacham pelo worker seguro' : 'seu perfil é somente leitura'} /><div className="divide-y divide-line/70">
      <div className="px-5 py-4 flex items-start gap-3.5"><span className="w-9 h-9 grid place-items-center border border-mint/40 text-mint bg-mint/5 shrink-0"><IconWhats className="w-4.5 h-4.5" /></span><div className="flex-1"><p className="font-display font-semibold text-[14px]">Confirmação de sessões (48h)</p><p className="text-[12px] text-fog mt-1">SIM confirma automaticamente; recusas e respostas ambíguas entram em revisão humana.</p><p className="font-mono text-[10.5px] text-amber mt-1.5">{counts.confirmations} potencial{counts.confirmations === 1 ? '' : 'is'}</p></div><Btn disabled={!canSend || loading || counts.confirmations === 0} onClick={runConfirmations}><IconWhats className="w-3.5 h-3.5" /> Enviar</Btn></div>
      <div className="px-5 py-4 flex items-start gap-3.5"><span className="w-9 h-9 grid place-items-center border border-aqua/40 text-aqua bg-aqua/5 shrink-0"><IconSend className="w-4.5 h-4.5" /></span><div className="flex-1"><p className="font-display font-semibold text-[14px]">Pesquisa NPS pós-atendimento</p><p className="text-[12px] text-fog mt-1">Envia para atendimentos finalizados recentes e persiste automaticamente notas de 0 a 10.</p><p className="font-mono text-[10.5px] text-aqua mt-1.5">{counts.nps} potencial{counts.nps === 1 ? '' : 'is'} · {npsSent} enviado{npsSent === 1 ? '' : 's'} · {npsAnswered} respondido{npsAnswered === 1 ? '' : 's'}</p></div><Btn disabled={!canSend || loading || counts.nps === 0} onClick={runNps}><IconSend className="w-3.5 h-3.5" /> Enviar</Btn></div>
      <div className="px-5 py-4 flex items-start gap-3.5 opacity-70"><span className="w-9 h-9 grid place-items-center border border-line text-fog shrink-0"><IconAlert className="w-4.5 h-4.5" /></span><div className="flex-1"><p className="font-display font-semibold text-[14px]">Reativação de pacientes inativos</p><p className="text-[12px] text-fog mt-1">Entrará como campanha controlada após fecharmos opt-out e frequência de contato.</p><p className="font-mono text-[10.5px] text-fog mt-1.5">{counts.inactive} elegível{counts.inactive === 1 ? '' : 'is'}</p></div><Btn disabled>Em preparação</Btn></div>
    </div></Card></Reveal><Reveal delay={180}><MessageTemplatesEditor templates={templates} busy={loading} onSave={persistTemplate} /></Reveal></div><Reveal delay={140}><MessageActivity logs={logs} patients={patients} /></Reveal></div>
  </div>;
}
