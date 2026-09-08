import { useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, format, getDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cancelAppointmentWithReason, rescheduleAppointment } from '../lib/appointmentOperations';
import { loadAppointmentWhatsappStates, type AppointmentWhatsappState } from '../lib/appointmentWhatsapp';
import { useAgenda } from '../lib/agendaContext';
import { useClinicDirectory } from '../lib/clinicDirectoryContext';
import { useInfrastructure } from '../lib/infrastructureContext';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { patientName } from '../lib/displayNames';
import { useToast } from '../lib/toastContext';
import { usePatients } from '../lib/patientContext';
import { hasClinicalDirectoryIdentity } from '../lib/professionalIdentity';
import { professionalIdOf } from '../lib/professionalReference';
import { STATUS_META, type Appointment, type AppointmentStatus } from '../lib/types';
import { Btn, Card, Input, Select } from '../lib/ui';
import { Reveal } from '../components/Reveal';
import { AppointmentCreateModal, type CreateAt } from '../components/AppointmentCreateModal';
import { AppointmentActionModal } from '../components/AppointmentActionModal';
import { AppointmentCancelModal } from '../components/AppointmentCancelModal';
import { AppointmentRescheduleModal, type ReschedulePreset } from '../components/AppointmentRescheduleModal';
import { AppointmentFinderPanel } from '../components/AppointmentFinderPanel';
import { WaitlistPanel } from '../components/WaitlistPanel';
import { AgendaV3Summary } from '../components/agenda/AgendaV3Summary';
import { isOperationalRole } from '../lib/permissions';

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
  const { toast } = useToast();
  const { user } = useCurrentUserAccess();
  const { patients } = usePatients();
  const { users } = useClinicDirectory();
  const { appointments, addAppointment, setAppointmentStatus, refreshAgenda } = useAgenda();
  const { unidades, rooms, loading: loadingInfra } = useInfrastructure();
  const nav = useNavigate();
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<View>('semana');
  const [unitFilter, setUnitFilter] = useState('all');
  const [professionalFilter, setProfessionalFilter] = useState(user?.role === 'professional' ? user.id : 'all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [finderOpen, setFinderOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [creating, setCreating] = useState<CreateAt>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [reschedulePreset, setReschedulePreset] = useState<ReschedulePreset | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [dragging, setDragging] = useState<Appointment | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [operationBusy, setOperationBusy] = useState(false);
  const [whatsappByAppointment, setWhatsappByAppointment] = useState<Map<string, AppointmentWhatsappState>>(new Map());
  const [prefillPatientId] = useState(() => {
    const query = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    return new URLSearchParams(query).get('patient') ?? '';
  });
  const [prefillConsumed, setPrefillConsumed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.role === 'professional' && user.id) setProfessionalFilter(user.id);
  }, [user?.id, user?.role]);

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

  const professionals = users.filter((item) => item.ativo && hasClinicalDirectoryIdentity(item.professionalType));
  const week = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 6 }, (_, i) => addDays(start, i));
  }, [anchor]);
  const gridSlots = useMemo(() => Array.from({ length: ((DAY_END - DAY_START) / SLOT_MINUTES) + 1 }, (_, i) => DAY_START + i * SLOT_MINUTES), []);
  const labelSlots = useMemo(() => gridSlots.filter((minute) => minute % 60 === 0), [gridSlots]);
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const roomsForFilter = useMemo(() => rooms.filter((room) => unitFilter === 'all' || room.unidadeId === unitFilter), [rooms, unitFilter]);
  const activeFilterCount = [unitFilter, roomFilter].filter((value) => value !== 'all').length
    + (user?.role !== 'professional' && professionalFilter !== 'all' ? 1 : 0)
    + (search.trim() ? 1 : 0);
  const periodLabel = view === 'mes'
    ? format(anchor, "MMMM 'de' yyyy", { locale: ptBR })
    : view === 'dia'
      ? format(anchor, "EEEE, dd 'de' MMMM", { locale: ptBR })
      : `${format(week[0], 'dd MMM', { locale: ptBR })} — ${format(week[5], 'dd MMM yyyy', { locale: ptBR })}`;
  const canDrag = (appointment: Appointment) => isOperationalRole(user?.role) && ['agendado', 'confirmado'].includes(appointment.status);

  useEffect(() => {
    if (roomFilter !== 'all' && !roomsForFilter.some((room) => room.id === roomFilter)) setRoomFilter('all');
  }, [roomFilter, roomsForFilter]);

  const visibleAppointments = useMemo(() => appointments.filter((appointment) => {
    if (professionalFilter !== 'all' && professionalIdOf(appointment) !== professionalFilter) return false;
    if (roomFilter !== 'all' && appointment.roomId !== roomFilter) return false;
    if (unitFilter !== 'all') {
      const room = rooms.find((item) => item.id === appointment.roomId);
      if (room?.unidadeId !== unitFilter) return false;
    }
    const q = search.trim().toLocaleLowerCase('pt-BR');
    if (q) {
      const patient = patients.find((item) => item.id === appointment.pacienteId);
      const professional = users.find((item) => item.id === professionalIdOf(appointment));
      const room = rooms.find((item) => item.id === appointment.roomId);
      const haystack = `${patient?.nome ?? ''} ${patient?.telefone ?? ''} ${professional?.nome ?? ''} ${room?.nome ?? ''}`.toLocaleLowerCase('pt-BR');
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [appointments, patients, users, rooms, professionalFilter, roomFilter, unitFilter, search]);

  const periodAppointments = useMemo(() => {
    if (view === 'dia') {
      const dayIso = format(anchor, 'yyyy-MM-dd');
      return visibleAppointments.filter((appointment) => appointment.data === dayIso);
    }
    if (view === 'semana') {
      const startIso = format(week[0], 'yyyy-MM-dd');
      const endIso = format(week[5], 'yyyy-MM-dd');
      return visibleAppointments.filter((appointment) => appointment.data >= startIso && appointment.data <= endIso);
    }
    const monthPrefix = format(anchor, 'yyyy-MM');
    return visibleAppointments.filter((appointment) => appointment.data.startsWith(monthPrefix));
  }, [visibleAppointments, view, anchor, week]);
  const periodSummary = useMemo(() => ({
    total: periodAppointments.filter((a) => a.status !== 'cancelado').length,
    confirmed: periodAppointments.filter((a) => a.status === 'confirmado').length,
    inService: periodAppointments.filter((a) => a.status === 'em_atendimento').length,
    finished: periodAppointments.filter((a) => a.status === 'finalizado').length,
    pending: periodAppointments.filter((a) => a.status === 'agendado').length,
    missed: periodAppointments.filter((a) => a.status === 'faltou').length,
    nominalValue: periodAppointments.filter((a) => a.status !== 'cancelado' && a.status !== 'faltou').reduce((sum, a) => sum + a.valor, 0),
  }), [periodAppointments]);
  const periodSummaryLabel = view === 'dia' ? 'Atendimentos no dia' : view === 'semana' ? 'Atendimentos na semana' : 'Atendimentos no mês';

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

  const manageStatus = async (status: AppointmentStatus) => {
    if (!selected) return;
    try {
      await setAppointmentStatus(selected.id, status);
      setSelected({ ...selected, status });
    } catch (error) {
      console.error('[MedicsPro] Falha ao atualizar o atendimento:', error);
      toast('Falha ao atualizar o atendimento. Tente novamente.', 'warn');
    }
  };

  const saveAppointment = (appointment: Omit<Appointment, 'id'>) => {
    void addAppointment(appointment)
      .then(() => toast('Agendamento salvo.'))
      .catch((error) => {
        console.error('[MedicsPro] Falha ao salvar agendamento:', error);
        toast('Falha ao salvar agendamento. Tente novamente.', 'warn');
      });
    setCreating(null);
    nav('/agenda', { replace: true });
  };

  const reloadAgenda = () => { void refreshAgenda().catch((error) => console.error('[MedicsPro] atualizar agenda:', error)); };
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
      toast('Atendimento cancelado e motivo registrado.');
      setCancelling(null);
      await refreshAgenda();
    } catch (error) {
      console.error('[MedicsPro] cancelamento operacional:', error);
      toast('Não foi possível cancelar o atendimento.', 'warn');
    } finally { setOperationBusy(false); }
  };

  const confirmReschedule = async (payload: { data: string; inicio: string; fim: string; fisioId: string; roomId: string; reason: string; isFitIn: boolean }) => {
    if (!rescheduling) return;
    setOperationBusy(true);
    try {
      await rescheduleAppointment({ appointmentId: rescheduling.id, ...payload });
      toast('Atendimento remarcado com histórico preservado.');
      setRescheduling(null);
      setReschedulePreset(null);
      await refreshAgenda();
    } catch (error) {
      console.error('[MedicsPro] remarcação operacional:', error);
      toast('Não foi possível remarcar o atendimento.', 'warn');
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
      <div key={iso} className="flex-1 min-w-[152px] border-l border-line/55 first:border-l-0">
        <div className={`sticky top-0 z-20 h-[62px] border-b border-line/65 px-3 py-2.5 text-center backdrop-blur-md ${isToday ? 'bg-mint/[0.09]' : 'bg-panel/95'}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${isToday ? 'text-mint' : 'text-fog'}`}>{format(date, 'EEE', { locale: ptBR }).replace('.', '')}</p>
          <div className="mt-0.5 flex items-center justify-center gap-2"><p className={`font-display text-lg font-bold ${isToday ? 'text-mint' : ''}`}>{format(date, 'dd')}</p>{isToday && <span className="h-1.5 w-1.5 rounded-full bg-mint" />}</div>
        </div>
        <div className="relative bg-deep/15" style={{ height: (DAY_END - DAY_START) * PPM }}>
          {gridSlots.slice(0, -1).map((minute) => {
            const targetKey = `${iso}-${minute}`;
            return (
              <button key={minute} aria-label={`Agendar ${toHHMM(minute)}`}
                onClick={() => !dragging && rooms.length && setCreating({ dia: iso, hora: toHHMM(minute) })}
                onDragOver={(event) => { if (dragging) { event.preventDefault(); setDragTarget(targetKey); } }}
                onDragLeave={() => dragTarget === targetKey && setDragTarget(null)}
                onDrop={(event) => { event.preventDefault(); dropAppointment(iso, minute); }}
                className={`absolute inset-x-0 border-t transition-colors ${minute % 60 === 0 ? 'border-line/40' : 'border-line/15'} ${dragTarget === targetKey ? 'bg-mint/15' : 'hover:bg-mint/[0.045]'}`}
                style={{ top: (minute - DAY_START) * PPM, height: SLOT_MINUTES * PPM }} />
            );
          })}
          {showNow && <div className="absolute z-20 inset-x-0 border-t border-pulse pointer-events-none" style={{ top: (nowMinute - DAY_START) * PPM }}><span className="absolute -top-1.5 -left-1 w-2.5 h-2.5 rounded-full bg-pulse shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-pulse)_16%,transparent)]" /></div>}
          {dayAppointments.map((appointment) => {
            const meta = STATUS_META[appointment.status];
            const whatsapp = whatsappByAppointment.get(appointment.id);
            const top = (toMin(appointment.inicio) - DAY_START) * PPM;
            const height = Math.max((toMin(appointment.fim) - toMin(appointment.inicio)) * PPM, 30);
            const draggable = canDrag(appointment);
            return (
              <button key={appointment.id} draggable={draggable}
                onDragStart={(event) => { if (!draggable) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = 'move'; startDrag(appointment); }}
                onDragEnd={() => { setDragging(null); setDragTarget(null); }}
                onClick={() => !dragging && setSelected(appointment)}
                title={draggable ? 'Arraste para outro horário. A remarcação só ocorre após sua confirmação.' : undefined}
                className={`absolute z-10 left-1.5 right-1.5 rounded-[12px] border border-line/60 border-l-[3px] bg-panel/95 px-2.5 py-1.5 text-left shadow-[0_8px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-all hover:-translate-y-px hover:border-line2 hover:bg-raise hover:shadow-lg ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging?.id === appointment.id ? 'opacity-50' : ''}`}
                style={{ top, height, borderLeftColor: meta.dot }}>
                <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.dot }} /><p className="text-[11px] font-semibold text-fog">{appointment.inicio}–{appointment.fim}{appointment.isFitIn ? ' · encaixe' : ''}</p></div>
                <p className="mt-0.5 truncate text-[13px] font-semibold text-paper">{patientName(patients, appointment.pacienteId)}</p>
                {height >= 48 && <p className="mt-0.5 truncate text-[11px] text-fog">{roomLabel(appointment.roomId)}{compactWhatsapp(whatsapp) ? ` · ${compactWhatsapp(whatsapp)}` : ''}</p>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <section className="overflow-hidden rounded-[26px] border border-line/70 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-mint)_8%,var(--color-panel)),var(--color-panel)_52%,color-mix(in_srgb,var(--color-aqua)_5%,var(--color-panel)))] shadow-[0_20px_55px_rgba(0,0,0,0.07)]">
          <div className="flex flex-wrap items-start gap-5 p-5 sm:p-6">
            <div className="min-w-[260px] flex-1">
              <div className="flex items-center gap-2"><span className="rounded-full border border-mint/25 bg-mint/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-mint">Agenda operacional</span>{activeFilterCount > 0 && <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fog">{activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}</span>}</div>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-[34px]">Agenda</h1>
              <p className="mt-1 capitalize text-[14px] text-fog">{periodLabel}</p>
              <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-fog">Organize o fluxo do dia, encontre disponibilidade e resolva pendências sem perder o contexto da agenda.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden rounded-xl border border-line/75 bg-deep/35">{(['dia', 'semana', 'mes'] as View[]).map((item) => <button key={item} onClick={() => setView(item)} className={`min-w-[66px] px-3 py-2 text-[12px] font-semibold transition ${view === item ? 'bg-mint text-on-accent shadow-sm' : 'text-fog hover:bg-raise hover:text-paper'}`}>{item === 'mes' ? 'mês' : item}</button>)}</div>
                <div className="flex overflow-hidden rounded-xl border border-line/75 bg-deep/35"><button className="px-3 py-2 text-fog hover:bg-raise hover:text-paper" onClick={() => moveAnchor(-1)} aria-label="Período anterior">←</button><button className="border-x border-line px-3.5 py-2 text-[12px] font-semibold text-fog hover:bg-raise hover:text-paper" onClick={() => setAnchor(new Date())}>Hoje</button><button className="px-3 py-2 text-fog hover:bg-raise hover:text-paper" onClick={() => moveAnchor(1)} aria-label="Próximo período">→</button></div>
              </div>
              <div className="flex flex-wrap gap-2"><Btn variant="ghost" onClick={() => setFinderOpen((value) => !value)}>Encontrar horário</Btn><Btn onClick={() => setCreating({ dia: format(anchor, 'yyyy-MM-dd'), hora: '08:00' })}>+ Novo atendimento</Btn></div>
            </div>
          </div>
          {isOperationalRole(user?.role) && view !== 'mes' && <div className="border-t border-line/55 bg-deep/20 px-5 py-3 text-[12px] text-fog sm:px-6"><span className="font-semibold text-paper/85">Remarcação rápida:</span> arraste atendimentos agendados ou confirmados. A mudança só é salva após confirmação.</div>}
        </section>
      </Reveal>

      <AppointmentFinderPanel open={finderOpen} appointments={appointments} rooms={rooms} unidades={unidades} fisios={professionals} defaultFisioId={professionalFilter} defaultUnitId={unitFilter} onClose={() => setFinderOpen(false)} onChoose={(slot) => { setAnchor(new Date(`${slot.dia}T12:00:00`)); setView('dia'); setFinderOpen(false); setCreating({ dia: slot.dia, hora: slot.hora, fisioId: slot.fisioId, roomId: slot.roomId }); }} />

      <Reveal delay={40}><AgendaV3Summary label={periodSummaryLabel} summary={periodSummary} /></Reveal>

      <Reveal delay={60}>
        <Card className="!rounded-[22px] !border-line/70 !p-3.5 sm:!p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="min-w-[240px] flex-1"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar paciente, telefone, profissional ou sala" className="!bg-deep/55" /></div>
            <Btn variant="ghost" onClick={() => setFiltersOpen((value) => !value)}>Filtros{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''} <span aria-hidden>{filtersOpen ? '↑' : '↓'}</span></Btn>
            {activeFilterCount > 0 && <button className="rounded-lg px-2.5 py-2 text-[12px] font-semibold text-fog hover:bg-raise/60 hover:text-paper" onClick={() => { setSearch(''); setUnitFilter('all'); setProfessionalFilter(user?.role === 'professional' ? user.id : 'all'); setRoomFilter('all'); }}>Limpar</button>}
          </div>
          {filtersOpen && <div className="mt-3 grid gap-2.5 border-t border-line/60 pt-3.5 sm:grid-cols-3">
            <Select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}><option value="all">Todas as unidades</option>{unidades.map((unit) => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}</Select>
            <Select value={professionalFilter} onChange={(event) => setProfessionalFilter(event.target.value)}>{user?.role !== 'professional' && <option value="all">Todos os profissionais</option>}{professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.nome}</option>)}</Select>
            <Select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}><option value="all">Todas as salas/recursos</option>{roomsForFilter.map((room) => <option key={room.id} value={room.id}>{room.nome}</option>)}</Select>
          </div>}
        </Card>
      </Reveal>

      {!loadingInfra && rooms.length === 0 && <div className="rounded-2xl border border-amber/40 bg-amber/[0.05] p-4 text-[13px] text-amber">A agenda ainda não possui sala/recurso real. Um administrador deve cadastrar a estrutura em Configurações → Estrutura da clínica.</div>}
      <Reveal delay={80}><div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line/60 bg-panel/55 px-4 py-3">{Object.entries(STATUS_META).map(([key, meta]) => <span key={key} className="flex items-center gap-1.5 text-[12px] text-fog"><span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />{meta.label}</span>)}</div></Reveal>
      {!loadingInfra && <WaitlistPanel unidades={unidades} rooms={rooms} onRecovered={reloadAgenda} />}

      <Reveal delay={120}>{view === 'mes' ? (
        <Card className="overflow-hidden !rounded-[22px]"><div className="grid grid-cols-7 border-b border-line bg-deep/35">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label) => <div key={label} className="border-l border-line/55 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-fog first:border-l-0">{label}</div>)}</div><div className="grid grid-cols-7">{monthCells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="min-h-[112px] border-l border-t border-line/35 bg-deep/20" />;
          const iso = format(date, 'yyyy-MM-dd'); const dayAppointments = visibleAppointments.filter((appointment) => appointment.data === iso); const active = dayAppointments.filter((appointment) => appointment.status !== 'cancelado'); const isToday = iso === todayIso;
          return <button key={iso} onClick={() => { setAnchor(date); setView('dia'); }} className={`min-h-[112px] border-l border-t border-line/35 p-3 text-left transition hover:bg-raise/45 ${isToday ? 'bg-mint/[0.065]' : ''}`}><div className="flex items-center justify-between"><span className={`font-display text-lg font-bold ${isToday ? 'text-mint' : ''}`}>{format(date, 'dd')}</span>{isToday && <span className="h-2 w-2 rounded-full bg-mint" />}</div>{active.length > 0 && <div className="mt-3 space-y-1.5"><span className="inline-flex rounded-full border border-mint/25 bg-mint/[0.06] px-2 py-0.5 text-[11px] font-semibold text-mint">{active.length} atendimento{active.length > 1 ? 's' : ''}</span><p className="text-[11px] text-fog">{active.filter((a) => a.status === 'confirmado').length} confirmados</p></div>}</button>;
        })}</div></Card>
      ) : (
        <Card className="overflow-x-auto !rounded-[22px]"><div className={`flex ${view === 'semana' ? 'min-w-[980px]' : 'min-w-[430px]'}`}><div className="w-16 shrink-0 bg-deep/25"><div className="sticky top-0 z-20 h-[62px] border-b border-line/65 bg-panel/95" /><div className="relative" style={{ height: (DAY_END - DAY_START) * PPM }}>{labelSlots.map((minute) => <span key={minute} className="absolute right-2.5 -translate-y-1/2 text-[11px] font-medium text-fog" style={{ top: (minute - DAY_START) * PPM }}>{toHHMM(minute)}</span>)}</div></div>{(view === 'semana' ? week : [anchor]).map(renderDayColumn)}</div></Card>
      )}</Reveal>

      <AppointmentCreateModal creating={creating} onClose={() => setCreating(null)} rooms={rooms} unidades={unidades} prefillPatientId={prefillPatientId} onSave={saveAppointment} />
      <AppointmentActionModal appointment={selected} role={user?.role ?? 'recep'} patient={selected ? patients.find((item) => item.id === selected.pacienteId) : undefined} appointments={appointments} whatsapp={selected ? whatsappByAppointment.get(selected.id) : undefined} patientLabel={selected ? patientName(patients, selected.pacienteId) : '—'} unitLabel={selected ? unitLabel(selected.roomId) : ''} roomLabel={selected ? roomLabel(selected.roomId) : ''} onClose={() => setSelected(null)} onStatus={(status) => void manageStatus(status)} onReschedule={() => { if (selected) { setReschedulePreset(null); setRescheduling(selected); } setSelected(null); }} onCancel={() => { if (selected) setCancelling(selected); setSelected(null); }} onOpenPatient={() => selected && nav(`/pacientes/${selected.pacienteId}`)} />
      <AppointmentCancelModal appointment={cancelling} onClose={() => setCancelling(null)} onConfirm={confirmCancellation} busy={operationBusy} />
      <AppointmentRescheduleModal appointment={rescheduling} preset={reschedulePreset} rooms={rooms} unidades={unidades} onClose={() => { setRescheduling(null); setReschedulePreset(null); }} onConfirm={confirmReschedule} busy={operationBusy} />
    </div>
  );
}
