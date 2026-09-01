import { useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { loadInfrastructure } from '../lib/infrastructure';
import { resolveClinicId } from '../lib/repository';
import { cancelAppointmentWithReason, rescheduleAppointment } from '../lib/appointmentOperations';
import { useApp, patientName } from '../lib/store';
import { STATUS_META, type Appointment, type AppointmentStatus, type Room, type Unidade } from '../lib/types';
import { Btn, Card, Select } from '../lib/ui';
import { Reveal } from '../components/Reveal';
import { AppointmentCreateModal, type CreateAt } from '../components/AppointmentCreateModal';
import { AppointmentActionModal } from '../components/AppointmentActionModal';
import { AppointmentCancelModal } from '../components/AppointmentCancelModal';
import { AppointmentRescheduleModal } from '../components/AppointmentRescheduleModal';

const DAY_START = 7 * 60;
const DAY_END = 19 * 60;
const PPM = 0.92;
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function AgendaReal() {
  const { user, users, patients, appointments, addAppointment, setAppointmentStatus, toast } = useApp();
  const nav = useNavigate();
  const [anchor, setAnchor] = useState(() => new Date());
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [unitFilter, setUnitFilter] = useState('all');
  const [fisioFilter, setFisioFilter] = useState(user?.role === 'fisio' ? user.id : 'all');
  const [creating, setCreating] = useState<CreateAt>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [operationBusy, setOperationBusy] = useState(false);
  const [loadingInfra, setLoadingInfra] = useState(true);
  const [prefillPatientId] = useState(() => {
    const query = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    return new URLSearchParams(query).get('patient') ?? '';
  });
  const [prefillConsumed, setPrefillConsumed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    resolveClinicId(user.id)
      .then(loadInfrastructure)
      .then((data) => {
        if (!active) return;
        setUnidades(data.unidades);
        setRooms(data.rooms);
      })
      .catch((error) => {
        console.error('[MedicsPro] agenda/infraestrutura:', error);
        toast('Não foi possível carregar unidades e salas.', 'warn');
      })
      .finally(() => active && setLoadingInfra(false));
    return () => { active = false; };
  }, [user?.id]);

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
  const slots = useMemo(() => Array.from({ length: 13 }, (_, i) => DAY_START + i * 60), []);

  const visibleAppointments = useMemo(() => appointments.filter((appointment) => {
    if (fisioFilter !== 'all' && appointment.fisioId !== fisioFilter) return false;
    if (unitFilter === 'all') return true;
    const room = rooms.find((item) => item.id === appointment.roomId);
    return room?.unidadeId === unitFilter;
  }), [appointments, rooms, fisioFilter, unitFilter]);

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

  const reloadAgenda = () => window.setTimeout(() => window.location.reload(), 450);

  const confirmCancellation = async (reason: string) => {
    if (!cancelling) return;
    setOperationBusy(true);
    try {
      await cancelAppointmentWithReason(cancelling.id, reason);
      toast('Sessão cancelada e motivo registrado.');
      setCancelling(null);
      reloadAgenda();
    } catch (error) {
      console.error('[MedicsPro] cancelamento operacional:', error);
      toast('Não foi possível cancelar a sessão.', 'warn');
    } finally {
      setOperationBusy(false);
    }
  };

  const confirmReschedule = async (payload: { data: string; inicio: string; fim: string; fisioId: string; roomId: string; reason: string; isFitIn: boolean }) => {
    if (!rescheduling) return;
    setOperationBusy(true);
    try {
      await rescheduleAppointment({ appointmentId: rescheduling.id, ...payload });
      toast('Sessão remarcada com histórico preservado.');
      setRescheduling(null);
      reloadAgenda();
    } catch (error) {
      console.error('[MedicsPro] remarcação operacional:', error);
      toast('Não foi possível remarcar a sessão.', 'warn');
    } finally {
      setOperationBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Agenda</h1>
            <p className="text-fog text-[13px] mt-0.5">agenda clínica real · conflitos, remarcações e histórico operacional protegidos</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn variant="ghost" onClick={() => setAnchor((date) => addDays(date, -7))}>← semana</Btn>
            <Btn variant="ghost" onClick={() => setAnchor(new Date())}>Hoje</Btn>
            <Btn variant="ghost" onClick={() => setAnchor((date) => addDays(date, 7))}>semana →</Btn>
            <Select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} className="!w-auto !py-2">
              <option value="all">Todas as unidades</option>
              {unidades.map((unit) => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}
            </Select>
            <Select value={fisioFilter} onChange={(event) => setFisioFilter(event.target.value)} className="!w-auto !py-2">
              {user?.role !== 'fisio' && <option value="all">Todos os profissionais</option>}
              {fisios.map((professional) => <option key={professional.id} value={professional.id}>{professional.nome}</option>)}
            </Select>
            <Btn onClick={() => setCreating({ dia: format(anchor, 'yyyy-MM-dd'), hora: '08:00' })}>+ Nova sessão</Btn>
          </div>
        </div>
      </Reveal>

      {!loadingInfra && rooms.length === 0 && (
        <div className="border border-amber/40 bg-amber/[0.05] p-4 text-[12.5px] text-amber">
          A agenda ainda não possui sala/recurso real. Um administrador deve cadastrar a estrutura em Configurações → Estrutura da clínica.
        </div>
      )}

      <Reveal delay={80}>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key} className="font-mono text-[10.5px] text-fog flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />{meta.label}
            </span>
          ))}
        </div>
      </Reveal>

      <Reveal delay={120}>
        <Card className="overflow-x-auto">
          <div className="flex min-w-[900px]">
            <div className="w-14 shrink-0">
              <div className="h-[52px] border-b border-line" />
              <div className="relative" style={{ height: (DAY_END - DAY_START) * PPM }}>
                {slots.map((minute) => <span key={minute} className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-fog" style={{ top: (minute - DAY_START) * PPM }}>{toHHMM(minute)}</span>)}
              </div>
            </div>
            {week.map((date) => {
              const iso = format(date, 'yyyy-MM-dd');
              const dayAppointments = visibleAppointments.filter((appointment) => appointment.data === iso);
              return (
                <div key={iso} className="flex-1 min-w-[135px] border-l border-line/60">
                  <div className="h-[52px] border-b border-line px-2 py-2 text-center bg-deep">
                    <p className="font-mono text-[10px] uppercase text-fog">{format(date, 'EEE', { locale: ptBR }).replace('.', '')}</p>
                    <p className="font-display font-bold">{format(date, 'dd')}</p>
                  </div>
                  <div className="relative" style={{ height: (DAY_END - DAY_START) * PPM }}>
                    {slots.slice(0, -1).map((minute) => (
                      <button key={minute} onClick={() => rooms.length && setCreating({ dia: iso, hora: toHHMM(minute) })} className="absolute inset-x-0 border-t border-line/30 hover:bg-mint/[0.04]" style={{ top: (minute - DAY_START) * PPM, height: 60 * PPM }} />
                    ))}
                    {dayAppointments.map((appointment) => {
                      const meta = STATUS_META[appointment.status];
                      const top = (toMin(appointment.inicio) - DAY_START) * PPM;
                      const height = Math.max((toMin(appointment.fim) - toMin(appointment.inicio)) * PPM, 28);
                      return (
                        <button key={appointment.id} onClick={() => setSelected(appointment)} className="absolute z-10 left-1 right-1 bg-panel border-l-[3px] text-left px-2 py-1 overflow-hidden" style={{ top, height, borderColor: meta.dot }}>
                          <p className="font-mono text-[9px] text-fog">{appointment.inicio}–{appointment.fim}</p>
                          <p className="text-[11px] font-semibold truncate" style={{ color: meta.dot }}>{patientName(patients, appointment.pacienteId)}</p>
                          <p className="font-mono text-[9px] text-fog truncate">{roomLabel(appointment.roomId)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </Reveal>

      <AppointmentCreateModal
        creating={creating}
        onClose={() => setCreating(null)}
        rooms={rooms}
        unidades={unidades}
        prefillPatientId={prefillPatientId}
        onSave={(appointment) => {
          addAppointment(appointment);
          setCreating(null);
          nav('/agenda', { replace: true });
        }}
      />

      <AppointmentActionModal
        appointment={selected}
        role={user?.role ?? 'recep'}
        patientLabel={selected ? patientName(patients, selected.pacienteId) : '—'}
        unitLabel={selected ? unitLabel(selected.roomId) : ''}
        roomLabel={selected ? roomLabel(selected.roomId) : ''}
        onClose={() => setSelected(null)}
        onStatus={manageStatus}
        onReschedule={() => { if (selected) setRescheduling(selected); setSelected(null); }}
        onCancel={() => { if (selected) setCancelling(selected); setSelected(null); }}
        onOpenPatient={() => selected && nav(`/pacientes/${selected.pacienteId}`)}
      />

      <AppointmentCancelModal
        appointment={cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancellation}
        busy={operationBusy}
      />

      <AppointmentRescheduleModal
        appointment={rescheduling}
        rooms={rooms}
        unidades={unidades}
        onClose={() => setRescheduling(null)}
        onConfirm={confirmReschedule}
        busy={operationBusy}
      />
    </div>
  );
}
