import { useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, format, getDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { loadInfrastructure } from '../lib/infrastructure';
import { resolveClinicId } from '../lib/repository';
import { cancelAppointmentWithReason, rescheduleAppointment } from '../lib/appointmentOperations';
import { loadAppointmentWhatsappStates, type AppointmentWhatsappState } from '../lib/appointmentWhatsapp';
import { useApp, patientName } from '../lib/store';
import { STATUS_META, fmtBRL, type Appointment, type AppointmentStatus, type Room, type Unidade } from '../lib/types';
import { Btn, Card, Input, Select } from '../lib/ui';
import { Reveal } from '../components/Reveal';
import { AppointmentCreateModal, type CreateAt } from '../components/AppointmentCreateModal';
import { AppointmentActionModal } from '../components/AppointmentActionModal';
import { AppointmentCancelModal } from '../components/AppointmentCancelModal';
import { AppointmentRescheduleModal, type ReschedulePreset } from '../components/AppointmentRescheduleModal';
import { AppointmentFinderPanel } from '../components/AppointmentFinderPanel';
import { WaitlistPanel } from '../components/WaitlistPanel';

const DAY_START = 7 * 60;
const DAY_END = 19 * 60;
const SLOT_MINUTES = 30;
const PPM = 1.08;
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
type View = 'dia' | 'semana' | 'mes';

const compactWhatsapp = (state?: AppointmentWhatsappState) => {
  if (!state) return '';
  if (state.replyText) return 'WA respondido';
  if (state.status === 'lido' || state.readAt) return 'WA ✓✓';
  if (state.status === 'entregue' || state.deliveredAt) return 'WA entregue';
  if (state.status === 'enviado') return 'WA enviado';
  if (state.status === 'falhou') return 'WA falhou';
  return 'WA fila';
};

export function AgendaReal() {
  const { user, users, patients, appointments, addAppointment, setAppointmentStatus, refreshClinicData, toast } = useApp();
  const nav = useNavigate();
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<View>('semana');
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [unitFilter, setUnitFilter] = useState('all');
  const [fisioFilter, setFisioFilter] = useState(user?.role === 'fisio' ? user.id : 'all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [finderOpen, setFinderOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [creating, setCreating] = useState<CreateAt>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [reschedulePreset, setReschedulePreset] = useState<ReschedulePreset | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [dragging, setDragging] = useState<Appointment | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [operationBusy, setOperationBusy] = useState(false);
  const [loadingInfra, setLoadingInfra] = useState(true);
  const [whatsappByAppointment, setWhatsappByAppointment] = useState<Map<string, AppointmentWhatsappState>>(new Map());
  const [prefillPatientId] = useState(() => {
    const query = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    return new URLSearchParams(query).get('patient') ?? '';
  });
  const [prefillConsumed, setPrefillConsumed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    resolveClinicId(user.id).then(loadInfrastructure).then((data) => {
      if (!active) return;
      setUnidades(data.unidades);
      setRooms(data.rooms);
    }).catch((error) => {
      console.error('[MedicsPro] agenda/infraestrutura:', error);
      toast('Não foi possível carregar unidades e salas.', 'warn');
    }).finally(() => active && setLoadingInfra(false));
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    loadAppointmentWhatsappStates(appointments.map((item) => item.id))
      .then((states) => active && setWhatsappByAppointment(states))
      .catch((error) => console.error('[MedicsPro] agenda/status WhatsApp:', error));
    return () => { active = false; };
  }, [appointments]);

  useEffect(() => {
    if (prefillConsumed || loadingInfra || !prefillPatientId || rooms.length === 0) return;
    setCreating({ dia: format(new Date(), 'yyyy-MM-dd'), hora: '08:00' });
    setPrefillConsumed(true);
  }, [prefillConsumed, loadingInfra, prefillPatientId, rooms.length]);

  const fisios = users.filter((u) => u.role === 'fisio');
  const week = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 6 }, (_, i) => addDays(start, i));
  }, [anchor]);
  const gridSlots = useMemo(() => Array.from({ length: ((DAY_END - DAY_START) / SLOT_MINUTES) + 1 }, (_, i) => DAY_START + i * SLOT_MINUTES), []);
  const labelSlots = useMemo(() => gridSlots.filter((minute) => minute % 60 === 0), [gridSlots]);
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const roomsForFilter = useMemo(() => rooms.filter((room) => unitFilter === 'all' || room.unidadeId === unitFilter), [rooms, unitFilter]);
  const canDrag = (appointment: Appointment) => (user?.role === 'admin' || user?.role === 'recep') && ['agendado', 'confirmado'].includes(appointment.status);

  useEffect(() => {
    if (roomFilter !== 'all' && !roomsForFilter.some((room) => room.id === roomFilter)) setRoomFilter('all');
  }, [roomFilter, roomsForFilter]);

  const visibleAppointments = useMemo(() => appointments.filter((appointment) => {
    if (fisioFilter !== 'all' && appointment.fisioId !== fisioFilter) return false;
    if (roomFilter !== 'all' && appointment.roomId !== roomFilter) return false;
    if (unitFilter !== 'all') {
      const room = rooms.find((item) => item.id === appointment.roomId);
      if (room?.unidadeId !== unitFilter) return false;
    }
    const q = search.trim().toLocaleLowerCase('pt-BR');
    if (q) {
      const patient = patients.find((item) => item.id === appointment.pacienteId);
      const professional = users.find((item) => item.id === appointment.fisioId);
      const room = rooms.find((item) => item.id === appointment.roomId);
      const haystack = `${patient?.nome ?? ''} ${patient?.telefone ?? ''} ${professional?.nome ?? ''} ${room?.nome ?? ''}`.toLocaleLowerCase('pt-BR');
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [appointments, patients, users, rooms, fisioFilter, roomFilter, unitFilter, search]);

  const todayAppointments = useMemo(() => visibleAppointments.filter((appointment) => appointment.data === todayIso), [visibleAppointments, todayIso]);
  const todaySummary = useMemo(() => ({
    total: todayAppointments.filter((a) => a.status !== 'cancelado').length,
    confirmed: todayAppointments.filter((a) => a.status === 'confirmado').length,
    inService: todayAppointments.filter((a) => a.status === 'em_atendimento').length,
    finished: todayAppointments.filter((a) => a.status === 'finalizado').length,
    pending: todayAppointments.filter((a) => a.status === 'agendado').length,
    missed: todayAppointments.filter((a) => a.status === 'faltou').length,
    revenue: todayAppointments.filter((a) => a.status !== 'cancelado' && a.status !== 'faltou').reduce((sum, a) => sum + a.valor, 0),
  }), [todayAppointments]);

  const monthCells = useMemo(() => {
    const y = anchor.getFullYear();
    const month = anchor.getMonth();
    const first = new Date(y, month, 1);
    const startPad = (getDay(first) + 6) % 7;
    const daysInMonth = new Date(y, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: startPad }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(y, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [anchor]);

  const roomLabel = (roomId: string) => rooms.find((room) => room.id === roomId)?.nome ?? 'Sala não identificada';
  const unitLabel = (roomId: string) => {
    const room = rooms.find((item) => item.id === roomId);
    return unidades.find((unit) => unit.id === room?.unidadeId)?.nome ?? '';
  };

  const manageStatus = (status: AppointmentStatus) => {
    if (!selected) return;
    setAppointmentStatus(selected.id, status);
    setSelected({ ...selected, status });
  };

  const refreshAgenda = () => { void refreshClinicData().catch((error) => console.error('[MedicsPro] atualizar agenda:', error)); };
  const moveAnchor = (direction: -1 | 1) => {
    if (view === 'mes') setAnchor((date) => addMonths(date, direction));
    else if (view === 'semana') setAnchor((date) => addDays(date, direction * 7));
    else setAnchor((date) => addDays(date, direction));
  };

  const confirmCancellation = async (reason: string) => {
    if (!cancelling) return;
    setOperationBusy(true);
    try {
      await cancelAppointmentWithReason(cancelling.id, reason);
      toast('Sessão cancelada e motivo registrado.');
      setCancelling(null);
      await refreshClinicData();
    } catch (error) {
      console.error('[MedicsPro] cancelamento operacional:', error);
      toast('Não foi possível cancelar a sessão.', 'warn');
    } finally { setOperationBusy(false); }
  };

  const confirmReschedule = async (payload: { data: string; inicio: string; fim: string; fisioId: string; roomId: string; reason: string; isFitIn: boolean }) => {
    if (!rescheduling) return;
    setOperationBusy(true);
    try {
      await rescheduleAppointment({ appointmentId: rescheduling.id, ...payload });
      toast('Sessão remarcada com histórico preservado.');
      setRescheduling(null);
      setReschedulePreset(null);
      await refreshClinicData();
    } catch (error) {
      console.error('[MedicsPro] remarcação operacional:', error);
      toast('Não foi possível remarcar a sessão.', 'warn');
    } finally { setOperationBusy(false); }
  };

  const startDrag = (appointment: Appointment) => {
    if (!canDrag(appointment)) return;
    setDragging(appointment);
  };

  const dropAppointment = (dia: string, minuto: number) => {
    if (!dragging) return;
    const inicio = toHHMM(minuto);
    setDragTarget(null);
    if (dragging.data === dia && dragging.inicio === inicio) {
      setDragging(null);
      return;
    }
    setReschedulePreset({ data: dia, inicio, reason: 'Remarcação pela agenda' });
    setRescheduling(dragging);
    setDragging(null);
  };

  const renderDayColumn = (date: Date) => {
    const iso = format(date, 'yyyy-MM-dd');
    const dayAppointments = visibleAppointments.filter((appointment) => appointment.data === iso);
    const isToday = iso === todayIso;
    const nowMinute = now.getHours() * 60 + now.getMinutes();
    const showNow = isToday && nowMinute >= DAY_START && nowMinute <= DAY_END;
    return (
      <div key={iso} className="flex-1 min-w-[145px] border-l border-line/60">
        <div className={`h-[52px] border-b border-line px-2 py-2 text-center ${isToday ? 'bg-mint/[0.07]' : 'bg-deep'}`}>
          <p className={`font-mono text-[10px] uppercase ${isToday ? 'text-mint' : 'text-fog'}`}>{format(date, 'EEE', { locale: ptBR }).replace('.', '')}</p>
          <p className={`font-display font-bold ${isToday ? 'text-mint' : ''}`}>{format(date, 'dd')}</p>
        </div>
        <div className="relative" style={{ height: (DAY_END - DAY_START) * PPM }}>
          {gridSlots.slice(0, -1).map((minute) => {
            const targetKey = `${iso}-${minute}`;
            return (
              <button key={minute} aria-label={`Agendar ${toHHMM(minute)}`}
                onClick={() => !dragging && rooms.length && setCreating({ dia: iso, hora: toHHMM(minute) })}
                onDragOver={(event) => { if (dragging) { event.preventDefault(); setDragTarget(targetKey); } }}
                onDragLeave={() => dragTarget === targetKey && setDragTarget(null)}
                onDrop={(event) => { event.preventDefault(); dropAppointment(iso, minute); }}
                className={`absolute inset-x-0 border-t transition-colors ${minute % 60 === 0 ? 'border-line/35' : 'border-line/15'} ${dragTarget === targetKey ? 'bg-mint/15' : 'hover:bg-mint/[0.04]'}`}
                style={{ top: (minute - DAY_START) * PPM, height: SLOT_MINUTES * PPM }} />
            );
          })}
          {showNow && <div className="absolute z-20 inset-x-0 border-t border-pulse pointer-events-none" style={{ top: (nowMinute - DAY_START) * PPM }}><span className="absolute -top-1.5 -left-1 w-2.5 h-2.5 rounded-full bg-pulse" /></div>}
          {dayAppointments.map((appointment) => {
            const meta = STATUS_META[appointment.status];
            const whatsapp = whatsappByAppointment.get(appointment.id);
            const top = (toMin(appointment.inicio) - DAY_START) * PPM;
            const height = Math.max((toMin(appointment.fim) - toMin(appointment.inicio)) * PPM, 28);
            const draggable = canDrag(appointment);
            return (
              <button key={appointment.id} draggable={draggable}
                onDragStart={(event) => { if (!draggable) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = 'move'; startDrag(appointment); }}
                onDragEnd={() => { setDragging(null); setDragTarget(null); }}
                onClick={() => !dragging && setSelected(appointment)}
                title={draggable ? 'Arraste para outro horário. A remarcação só ocorre após sua confirmação.' : undefined}
                className={`absolute z-10 left-1 right-1 bg-panel/95 hover:bg-raise border-l-[3px] text-left px-2 py-1 overflow-hidden transition-all ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging?.id === appointment.id ? 'opacity-50' : ''}`}
                style={{ top, height, borderColor: meta.dot }}>
                <p className="font-mono text-[9px] text-fog">{appointment.inicio}–{appointment.fim}{appointment.isFitIn ? ' · ENCAIXE' : ''}</p>
                <p className="text-[11px] font-semibold truncate" style={{ color: meta.dot }}>{patientName(patients, appointment.pacienteId)}</p>
                <p className="font-mono text-[9px] text-fog truncate">{roomLabel(appointment.roomId)}{compactWhatsapp(whatsapp) ? ` · ${compactWhatsapp(whatsapp)}` : ''}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-end gap-3">
          <div><h1 className="font-display text-3xl font-bold tracking-tight">Agenda</h1><p className="text-fog text-[13px] mt-0.5">operação clínica · conflitos, remarcações e recuperação de vagas protegidos</p></div>
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="flex border border-line">{(['dia', 'semana', 'mes'] as View[]).map((item) => <button key={item} onClick={() => setView(item)} className={`px-3 py-2 font-mono text-[10px] uppercase ${view === item ? 'bg-mint text-ink font-semibold' : 'text-fog hover:text-paper'}`}>{item === 'mes' ? 'mês' : item}</button>)}</div>
            <Btn variant="ghost" onClick={() => moveAnchor(-1)}>←</Btn><Btn variant="ghost" onClick={() => setAnchor(new Date())}>Hoje</Btn><Btn variant="ghost" onClick={() => moveAnchor(1)}>→</Btn>
            <Btn variant="ghost" onClick={() => setFinderOpen((value) => !value)}>Encontrar horário</Btn>
            <Btn onClick={() => setCreating({ dia: format(anchor, 'yyyy-MM-dd'), hora: '08:00' })}>+ Nova sessão</Btn>
          </div>
        </div>
      </Reveal>

      {(user?.role === 'admin' || user?.role === 'recep') && view !== 'mes' && <p className="font-mono text-[10px] text-fog">Dica: arraste atendimentos agendados ou confirmados para outro horário. Nada é salvo antes da confirmação da remarcação.</p>}

      <AppointmentFinderPanel open={finderOpen} appointments={appointments} rooms={rooms} unidades={unidades} fisios={fisios} defaultFisioId={fisioFilter} defaultUnitId={unitFilter} onClose={() => setFinderOpen(false)} onChoose={(slot) => { setAnchor(new Date(`${slot.dia}T12:00:00`)); setView('dia'); setFinderOpen(false); setCreating({ dia: slot.dia, hora: slot.hora, fisioId: slot.fisioId, roomId: slot.roomId }); }} />

      <Reveal delay={40}><div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">{[
        ['Sessões hoje', todaySummary.total], ['Confirmadas', todaySummary.confirmed], ['Pendentes', todaySummary.pending], ['Em atendimento', todaySummary.inService], ['Finalizadas', todaySummary.finished], ['Faltas', todaySummary.missed], ['Previsto', fmtBRL(todaySummary.revenue)],
      ].map(([label, value]) => <Card key={String(label)} className="!p-3"><p className="font-mono text-[9px] uppercase text-fog">{label}</p><p className="font-display text-xl font-bold mt-1">{value}</p></Card>)}</div></Reveal>

      <Reveal delay={60}><Card className="!p-3"><div className="flex flex-wrap gap-2 items-center">
        <div className="min-w-[220px] flex-1"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar paciente, telefone, profissional ou sala" /></div>
        <Select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} className="!w-auto"><option value="all">Todas as unidades</option>{unidades.map((unit) => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}</Select>
        <Select value={fisioFilter} onChange={(event) => setFisioFilter(event.target.value)} className="!w-auto">{user?.role !== 'fisio' && <option value="all">Todos os profissionais</option>}{fisios.map((professional) => <option key={professional.id} value={professional.id}>{professional.nome}</option>)}</Select>
        <Select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} className="!w-auto"><option value="all">Todas as salas/recursos</option>{roomsForFilter.map((room) => <option key={room.id} value={room.id}>{room.nome}</option>)}</Select>
      </div></Card></Reveal>

      {!loadingInfra && rooms.length === 0 && <div className="border border-amber/40 bg-amber/[0.05] p-4 text-[12.5px] text-amber">A agenda ainda não possui sala/recurso real. Um administrador deve cadastrar a estrutura em Configurações → Estrutura da clínica.</div>}
      <Reveal delay={80}><div className="flex flex-wrap gap-3">{Object.entries(STATUS_META).map(([key, meta]) => <span key={key} className="font-mono text-[10.5px] text-fog flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />{meta.label}</span>)}</div></Reveal>
      {!loadingInfra && <WaitlistPanel unidades={unidades} rooms={rooms} onRecovered={refreshAgenda} />}

      <Reveal delay={120}>{view === 'mes' ? (
        <Card className="overflow-hidden"><div className="grid grid-cols-7 border-b border-line">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label) => <div key={label} className="px-2 py-2 text-center font-mono text-[10px] uppercase text-fog border-l border-line/60 first:border-l-0">{label}</div>)}</div><div className="grid grid-cols-7">{monthCells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="min-h-[96px] border-l border-t border-line/40 bg-deep/30" />;
          const iso = format(date, 'yyyy-MM-dd'); const dayAppointments = visibleAppointments.filter((appointment) => appointment.data === iso); const active = dayAppointments.filter((appointment) => appointment.status !== 'cancelado'); const isToday = iso === todayIso;
          return <button key={iso} onClick={() => { setAnchor(date); setView('dia'); }} className={`min-h-[96px] border-l border-t border-line/40 p-2 text-left hover:bg-raise/50 ${isToday ? 'bg-mint/[0.06]' : ''}`}><span className={`font-display font-bold ${isToday ? 'text-mint' : ''}`}>{format(date, 'dd')}</span>{active.length > 0 && <div className="mt-2 space-y-1"><span className="inline-block font-mono text-[9px] text-mint border border-mint/30 px-1.5 py-0.5">{active.length} sessão{active.length > 1 ? 'ões' : ''}</span><p className="font-mono text-[9px] text-fog">{active.filter((a) => a.status === 'confirmado').length} confirmadas</p></div>}</button>;
        })}</div></Card>
      ) : (
        <Card className="overflow-x-auto"><div className={`flex ${view === 'semana' ? 'min-w-[950px]' : 'min-w-[420px]'}`}><div className="w-14 shrink-0"><div className="h-[52px] border-b border-line" /><div className="relative" style={{ height: (DAY_END - DAY_START) * PPM }}>{labelSlots.map((minute) => <span key={minute} className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-fog" style={{ top: (minute - DAY_START) * PPM }}>{toHHMM(minute)}</span>)}</div></div>{(view === 'semana' ? week : [anchor]).map(renderDayColumn)}</div></Card>
      )}</Reveal>

      <AppointmentCreateModal creating={creating} onClose={() => setCreating(null)} rooms={rooms} unidades={unidades} prefillPatientId={prefillPatientId} onSave={(appointment) => { addAppointment(appointment); setCreating(null); nav('/agenda', { replace: true }); }} />
      <AppointmentActionModal appointment={selected} role={user?.role ?? 'recep'} patient={selected ? patients.find((item) => item.id === selected.pacienteId) : undefined} appointments={appointments} whatsapp={selected ? whatsappByAppointment.get(selected.id) : undefined} patientLabel={selected ? patientName(patients, selected.pacienteId) : '—'} unitLabel={selected ? unitLabel(selected.roomId) : ''} roomLabel={selected ? roomLabel(selected.roomId) : ''} onClose={() => setSelected(null)} onStatus={manageStatus} onReschedule={() => { if (selected) { setReschedulePreset(null); setRescheduling(selected); } setSelected(null); }} onCancel={() => { if (selected) setCancelling(selected); setSelected(null); }} onOpenPatient={() => selected && nav(`/pacientes/${selected.pacienteId}`)} />
      <AppointmentCancelModal appointment={cancelling} onClose={() => setCancelling(null)} onConfirm={confirmCancellation} busy={operationBusy} />
      <AppointmentRescheduleModal appointment={rescheduling} preset={reschedulePreset} rooms={rooms} unidades={unidades} onClose={() => { setRescheduling(null); setReschedulePreset(null); }} onConfirm={confirmReschedule} busy={operationBusy} />
    </div>
  );
}
