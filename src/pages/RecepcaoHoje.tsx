import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { loadReceptionToday, setAppointmentArrival, type ReceptionQueueItem } from '../lib/reception';
import { STATUS_META, type AppointmentStatus } from '../lib/types';
import { Btn, Card } from '../lib/ui';
import { Reveal } from '../components/Reveal';

const activeStatuses = new Set(['agendado', 'confirmado', 'em_atendimento']);

export function RecepcaoHoje() {
  const { user, setAppointmentStatus, toast } = useApp();
  const nav = useNavigate();
  const [items, setItems] = useState<ReceptionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const reload = useCallback(async () => {
    try {
      setItems(await loadReceptionToday());
    } catch (error) {
      console.error('[MedicsPro] recepção hoje:', error);
      toast('Não foi possível carregar a fila de hoje.', 'warn');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 30_000);
    const refresh = window.setInterval(() => void reload(), 60_000);
    return () => { window.clearInterval(clock); window.clearInterval(refresh); };
  }, [reload]);

  const summary = useMemo(() => ({
    total: items.filter((i) => i.status !== 'cancelado').length,
    waiting: items.filter((i) => i.arrived_at && i.status !== 'em_atendimento' && i.status !== 'finalizado').length,
    inService: items.filter((i) => i.status === 'em_atendimento').length,
    finished: items.filter((i) => i.status === 'finalizado').length,
    pending: items.filter((i) => i.status === 'agendado').length,
  }), [items]);

  const arrival = async (item: ReceptionQueueItem, arrived: boolean) => {
    setBusyId(item.appointment_id);
    try {
      await setAppointmentArrival(item.appointment_id, arrived);
      toast(arrived ? `${item.patient_name} chegou.` : 'Check-in desfeito.');
      await reload();
    } catch (error) {
      console.error('[MedicsPro] check-in:', error);
      toast('Não foi possível registrar a chegada.', 'warn');
    } finally { setBusyId(null); }
  };

  const status = (item: ReceptionQueueItem, next: AppointmentStatus) => {
    setAppointmentStatus(item.appointment_id, next);
    setItems((prev) => prev.map((row) => row.appointment_id === item.appointment_id ? { ...row, status: next } : row));
  };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minuteOf = (value: string) => { const [h, m] = value.slice(0, 5).split(':').map(Number); return h * 60 + m; };

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mint">operação ao vivo</p>
            <h1 className="font-display text-3xl font-bold tracking-tight">Hoje · Recepção</h1>
            <p className="text-fog text-[13px] mt-1">Chegadas, espera e andamento dos atendimentos sem precisar navegar pela grade.</p>
          </div>
          <div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={() => void reload()}>Atualizar</Btn><Btn onClick={() => nav('/agenda')}>Abrir agenda</Btn></div>
        </div>
      </Reveal>

      <Reveal delay={40}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[['Sessões', summary.total], ['Aguardando', summary.waiting], ['Em atendimento', summary.inService], ['Finalizadas', summary.finished], ['Sem confirmação', summary.pending]].map(([label, value]) => (
            <Card key={String(label)} className="!p-3"><p className="font-mono text-[9px] uppercase text-fog">{label}</p><p className="font-display text-2xl font-bold mt-1">{value}</p></Card>
          ))}
        </div>
      </Reveal>

      <Reveal delay={80}>
        <Card className="!p-0 overflow-hidden">
          {loading ? <p className="p-5 text-fog">Carregando fila de hoje…</p> : items.length === 0 ? <p className="p-5 text-fog">Nenhum atendimento previsto para hoje.</p> : (
            <div className="divide-y divide-line">
              {items.map((item) => {
                const meta = STATUS_META[item.status];
                const arrived = Boolean(item.arrived_at);
                const minutes = minuteOf(item.inicio);
                const isNear = activeStatuses.has(item.status) && Math.abs(minutes - currentMinutes) <= 45;
                return (
                  <div key={item.appointment_id} className={`p-4 flex flex-col xl:flex-row xl:items-center gap-4 ${isNear ? 'bg-mint/[0.035]' : ''}`}>
                    <div className="w-20 shrink-0"><p className="font-display text-xl font-bold">{item.inicio.slice(0, 5)}</p><p className="font-mono text-[9px] text-fog">até {item.fim.slice(0, 5)}</p></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => nav(`/pacientes/${item.patient_id}`)} className="font-display font-semibold text-[15px] hover:text-mint truncate">{item.patient_name}</button>
                        {arrived && item.status !== 'em_atendimento' && item.status !== 'finalizado' && <span className="font-mono text-[9px] uppercase border border-mint/40 text-mint px-2 py-0.5">● chegou</span>}
                        <span className={`font-mono text-[9px] uppercase border px-2 py-0.5 ${meta.chip}`}>{meta.label}</span>
                      </div>
                      <p className="text-[12px] text-fog mt-1">{item.tipo} · {item.professional_name}{item.room_name ? ` · ${item.room_name}` : ''}{item.unit_name ? ` · ${item.unit_name}` : ''}</p>
                      <div className="flex flex-wrap gap-3 mt-1 font-mono text-[9px] text-fog">
                        {item.patient_phone && <span>{item.patient_phone}</span>}
                        <span>WhatsApp: {item.whatsapp_status ?? 'sem envio'}</span>
                        {item.arrived_at && <span>chegada {new Date(item.arrived_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      {!arrived && !['finalizado','faltou','cancelado'].includes(item.status) && <Btn disabled={busyId === item.appointment_id} onClick={() => void arrival(item, true)}>Paciente chegou</Btn>}
                      {arrived && item.status !== 'em_atendimento' && item.status !== 'finalizado' && <Btn variant="ghost" disabled={busyId === item.appointment_id} onClick={() => void arrival(item, false)}>Desfazer chegada</Btn>}
                      {(user?.role === 'fisio' || user?.role === 'admin') && arrived && ['agendado','confirmado'].includes(item.status) && <Btn onClick={() => status(item, 'em_atendimento')}>Iniciar atendimento</Btn>}
                      {(user?.role === 'fisio' || user?.role === 'admin') && item.status === 'em_atendimento' && <Btn onClick={() => status(item, 'finalizado')}>Finalizar</Btn>}
                      {(user?.role === 'recep' || user?.role === 'admin') && ['agendado','confirmado'].includes(item.status) && <Btn variant="ghost" onClick={() => status(item, 'faltou')}>Marcar falta</Btn>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
