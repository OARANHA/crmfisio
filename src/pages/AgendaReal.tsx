import { useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { loadInfrastructure } from '../lib/infrastructure';
import { resolveClinicId } from '../lib/repository';
import { useApp, patientName } from '../lib/store';
import { STATUS_META, fmtBRL, type Appointment, type AppointmentStatus, type Room, type Unidade } from '../lib/types';
import { Btn, Card, Chip, Field, Input, Modal, Select } from '../lib/ui';
import { Reveal } from '../components/Reveal';

const DAY_START = 7 * 60;
const DAY_END = 19 * 60;
const PPM = 0.92;
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

type CreateAt = { dia: string; hora: string } | null;

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
  const [loadingInfra, setLoadingInfra] = useState(true);

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

  const fisios = users.filter((u) => u.role === 'fisio');
  const week = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 6 }, (_, i) => addDays(start, i));
  }, [anchor]);
  const slots = useMemo(() => Array.from({ length: 13 }, (_, i) => DAY_START + i * 60), []);

  const visibleAppointments = useMemo(() => appointments.filter((a) => {
    if (fisioFilter !== 'all' && a.fisioId !== fisioFilter) return false;
    if (unitFilter === 'all') return true;
    const room = rooms.find((r) => r.id === a.roomId);
    return room?.unidadeId === unitFilter;
  }), [appointments, rooms, fisioFilter, unitFilter]);

  const roomLabel = (roomId: string) => rooms.find((r) => r.id === roomId)?.nome ?? 'Sala não identificada';
  const unitLabel = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    return unidades.find((u) => u.id === room?.unidadeId)?.nome ?? '';
  };

  const manageStatus = (status: AppointmentStatus) => {
    if (!selected) return;
    setAppointmentStatus(selected.id, status);
    setSelected({ ...selected, status });
  };

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Agenda</h1>
            <p className="text-fog text-[13px] mt-0.5">agenda clínica real · profissional + unidade + sala</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn variant="ghost" onClick={() => setAnchor((d) => addDays(d, -7))}>← semana</Btn>
            <Btn variant="ghost" onClick={() => setAnchor(new Date())}>Hoje</Btn>
            <Btn variant="ghost" onClick={() => setAnchor((d) => addDays(d, 7))}>semana →</Btn>
            <Select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="!w-auto !py-2">
              <option value="all">Todas as unidades</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Select>
            <Select value={fisioFilter} onChange={(e) => setFisioFilter(e.target.value)} className="!w-auto !py-2">
              {user?.role !== 'fisio' && <option value="all">Todos os profissionais</option>}
              {fisios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
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
                {slots.map((m) => <span key={m} className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-fog" style={{ top: (m - DAY_START) * PPM }}>{toHHMM(m)}</span>)}
              </div>
            </div>
            {week.map((date) => {
              const iso = format(date, 'yyyy-MM-dd');
              const dayAppointments = visibleAppointments.filter((a) => a.data === iso);
              return (
                <div key={iso} className="flex-1 min-w-[135px] border-l border-line/60">
                  <div className="h-[52px] border-b border-line px-2 py-2 text-center bg-deep">
                    <p className="font-mono text-[10px] uppercase text-fog">{format(date, 'EEE', { locale: ptBR }).replace('.', '')}</p>
                    <p className="font-display font-bold">{format(date, 'dd')}</p>
                  </div>
                  <div className="relative" style={{ height: (DAY_END - DAY_START) * PPM }}>
                    {slots.slice(0, -1).map((m) => (
                      <button key={m} onClick={() => rooms.length && setCreating({ dia: iso, hora: toHHMM(m) })} className="absolute inset-x-0 border-t border-line/30 hover:bg-mint/[0.04]" style={{ top: (m - DAY_START) * PPM, height: 60 * PPM }} />
                    ))}
                    {dayAppointments.map((a) => {
                      const meta = STATUS_META[a.status];
                      const top = (toMin(a.inicio) - DAY_START) * PPM;
                      const height = Math.max((toMin(a.fim) - toMin(a.inicio)) * PPM, 28);
                      return (
                        <button key={a.id} onClick={() => setSelected(a)} className="absolute z-10 left-1 right-1 bg-panel border-l-[3px] text-left px-2 py-1 overflow-hidden" style={{ top, height, borderColor: meta.dot }}>
                          <p className="font-mono text-[9px] text-fog">{a.inicio}–{a.fim}</p>
                          <p className="text-[11px] font-semibold truncate" style={{ color: meta.dot }}>{patientName(patients, a.pacienteId)}</p>
                          <p className="font-mono text-[9px] text-fog truncate">{roomLabel(a.roomId)}</p>
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

      <AppointmentModal creating={creating} onClose={() => setCreating(null)} rooms={rooms} unidades={unidades} onSave={(a) => { addAppointment(a); setCreating(null); }} />

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Atendimento">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="font-display font-bold text-lg">{patientName(patients, selected.pacienteId)}</p>
              <p className="font-mono text-[11px] text-fog">{selected.data} · {selected.inicio}–{selected.fim} · {selected.tipo}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="border border-line bg-deep p-3"><span className="block font-mono text-[9px] text-fog uppercase">Unidade</span>{unitLabel(selected.roomId) || '—'}</div>
              <div className="border border-line bg-deep p-3"><span className="block font-mono text-[9px] text-fog uppercase">Sala/Recurso</span>{roomLabel(selected.roomId)}</div>
              <div className="border border-line bg-deep p-3"><span className="block font-mono text-[9px] text-fog uppercase">Valor</span>{fmtBRL(selected.valor)}</div>
              <div className="border border-line bg-deep p-3"><span className="block font-mono text-[9px] text-fog uppercase">Status</span><Chip className={STATUS_META[selected.status].chip}>{STATUS_META[selected.status].label}</Chip></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['agendado','confirmado','em_atendimento','finalizado'] as AppointmentStatus[]).map((s) => <Btn key={s} variant="ghost" onClick={() => manageStatus(s)}>{STATUS_META[s].label}</Btn>)}
              <Btn variant="ghost" onClick={() => manageStatus('faltou')}>Faltou</Btn>
              <Btn variant="ghost" onClick={() => manageStatus('cancelado')}>Cancelar</Btn>
            </div>
            <Btn className="w-full" onClick={() => nav(`/pacientes/${selected.pacienteId}`)}>Abrir prontuário do paciente</Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AppointmentModal({ creating, onClose, rooms, unidades, onSave }: { creating: CreateAt; onClose: () => void; rooms: Room[]; unidades: Unidade[]; onSave: (a: Omit<Appointment,'id'>) => void }) {
  const { user, users, patients } = useApp();
  const fisios = users.filter((u) => u.role === 'fisio');
  const [pacienteId, setPacienteId] = useState('');
  const [fisioId, setFisioId] = useState(user?.role === 'fisio' ? user.id : '');
  const [unitId, setUnitId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [tipo, setTipo] = useState('Cinesioterapia');
  const [dia, setDia] = useState('');
  const [hora, setHora] = useState('08:00');
  const [duracao, setDuracao] = useState(50);
  const [valor, setValor] = useState(120);
  const [key, setKey] = useState('');

  const createKey = creating ? `${creating.dia}-${creating.hora}` : '';
  if (creating && createKey !== key) {
    setKey(createKey);
    setDia(creating.dia);
    setHora(creating.hora);
    const firstUnit = unidades[0]?.id ?? '';
    setUnitId(firstUnit);
    setRoomId(rooms.find((r) => r.unidadeId === firstUnit)?.id ?? '');
    if (user?.role === 'fisio') setFisioId(user.id);
  }

  const availableRooms = rooms.filter((r) => !unitId || r.unidadeId === unitId);
  const save = () => {
    if (!pacienteId || !fisioId || !roomId || !dia) return;
    const fim = toHHMM(toMin(hora) + duracao);
    onSave({ pacienteId, fisioId, roomId, data: dia, inicio: hora, fim, status: 'agendado', tipo, valor: Math.round(valor * 100), pacoteId: null, serieId: null, notas: '' });
  };

  return (
    <Modal open={!!creating} onClose={onClose} title="Nova sessão" wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Paciente"><Select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}><option value="">Selecionar…</option>{patients.filter((p) => p.status !== 'alta' && !p.anonimizado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
        <Field label="Profissional"><Select value={fisioId} disabled={user?.role === 'fisio'} onChange={(e) => setFisioId(e.target.value)}><option value="">Selecionar…</option>{fisios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</Select></Field>
        <Field label="Unidade"><Select value={unitId} onChange={(e) => { const id = e.target.value; setUnitId(id); setRoomId(rooms.find((r) => r.unidadeId === id)?.id ?? ''); }}><option value="">Selecionar…</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</Select></Field>
        <Field label="Sala / equipamento"><Select value={roomId} onChange={(e) => setRoomId(e.target.value)}><option value="">Selecionar…</option>{availableRooms.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</Select></Field>
        <Field label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value)}>{['Avaliação','Cinesioterapia','Eletroterapia','RPG','Neurofuncional','Pilates','Tração'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Data"><Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Field>
        <Field label="Início"><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
        <Field label="Duração"><Select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))}>{[30,40,50,60,90].map((d) => <option key={d} value={d}>{d} min</option>)}</Select></Field>
        <Field label="Valor (R$)"><Input type="number" min={0} value={valor} onChange={(e) => setValor(Number(e.target.value))} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} disabled={!pacienteId || !fisioId || !roomId}>Agendar sessão</Btn></div>
    </Modal>
  );
}
