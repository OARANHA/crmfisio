import { useMemo, useState } from 'react';
import { addDays, addWeeks, format, getDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp, patientName, expandSerie, useUnitFilter, type SeriePatch } from '../lib/store';
import {
  STATUS_META, fmtBRL, dayOf, DATA_KEY,
  type Appointment, type AppointmentStatus, type RecurrenceRule,
} from '../lib/types';
import {
  Card, Btn, Modal, Field, Input, Select, Chip,
  IconChevronL, IconChevronR, IconPlus, IconClock, IconCalendar,
} from '../lib/ui';
import { IconWhats } from '../components/icons';
import { Reveal } from '../components/Reveal';

const DAY_START = 7 * 60;
const DAY_END = 19 * 60;
const PPM = 0.92; // px por minuto

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

type View = 'dia' | 'semana' | 'mes';

export function Agenda() {
  const { appointments, patients, users, rooms, unidadeSel, setAppointmentStatus, addAppointment, recurrence, upsertRegra, toast } = useApp();
  const inUnit = useUnitFilter();
  const fisios = users.filter((u) => u.role === 'fisio');
  const roomsFiltradas = rooms.filter((r) => unidadeSel === 'all' || r.unidadeId === unidadeSel);

  const [view, setView] = useState<View>('semana');
  const [anchor, setAnchor] = useState(() => new Date());
  const [fFisio, setFFisio] = useState('all');
  const [fRoom, setFRoom] = useState('all');
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState<{ dia: string; hora: string } | null>(null);
  const [serieEdit, setSerieEdit] = useState<Appointment | null>(null);

  const hoje = format(new Date(), 'yyyy-MM-dd');

  const weekDays = useMemo(() => {
    const ws = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 6 }, (_, i) => addDays(ws, i));
  }, [anchor]);

  const matches = (a: Appointment) =>
    (fFisio === 'all' || a.fisioId === fFisio) && (fRoom === 'all' || a.roomId === fRoom) && inUnit(a);

  const statusFlow: AppointmentStatus[] = ['agendado', 'confirmado', 'em_atendimento', 'finalizado'];

  const sendWhats = (a: Appointment) => {
    const p = patients.find((x) => x.id === a.pacienteId);
    toast(`Lembrete enviado via WhatsApp para ${p?.nome} — sessão de ${format(new Date(dayOf(a) + 'T12:00'), "dd/MM 'às' HH:mm", { locale: ptBR })}`);
  };

  const Block = ({ a }: { a: Appointment }) => {
    const sm = STATUS_META[a.status];
    const top = (toMin(a.inicio) - DAY_START) * PPM;
    const h = (toMin(a.fim) - toMin(a.inicio)) * PPM;
    const fisio = users.find((u) => u.id === a.fisioId);
    const room = rooms.find((r) => r.id === a.roomId);
    return (
      <button
        onClick={() => setSelected(a)}
        className="absolute z-[5] left-1 right-1 text-left border-l-[3px] bg-panel/95 hover:bg-raise transition-all hover:shadow-lg hover:shadow-ink/60 overflow-hidden group"
        style={{ top, height: Math.max(h, 26), borderColor: sm.dot }}
      >
        <div className="px-2 py-1">
          <p className="font-mono text-[9.5px] text-fog leading-none">{a.inicio}–{a.fim}</p>
          <p className="text-[11.5px] font-semibold leading-tight truncate" style={{ color: sm.dot }}>
            {patientName(patients, a.pacienteId)}
          </p>
          <p className="text-[10px] text-fog truncate leading-tight">
            {fisio?.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ')[0]} · {room?.nome.split('—')[0].trim()}
          </p>
        </div>
      </button>
    );
  };

  const slots = useMemo(() => {
    const arr: number[] = [];
    for (let m = DAY_START; m <= DAY_END; m += 60) arr.push(m);
    return arr;
  }, []);

  const ColumnDay = ({ date }: { date: Date }) => {
    const iso = format(date, 'yyyy-MM-dd');
    const dayAppts = appointments.filter((a) => dayOf(a) === iso && matches(a));
    const isToday = iso === hoje;
    return (
      <div className="flex-1 min-w-[130px] border-l border-line/60 relative">
        <div className="sticky top-0 z-10 bg-deep/95 backdrop-blur border-b border-line px-2 py-2 text-center">
          <p className={`font-mono text-[10px] uppercase ${isToday ? 'text-mint' : 'text-fog'}`}>{format(date, 'EEE', { locale: ptBR }).replace('.', '')}</p>
          <p className={`font-display font-bold text-[15px] ${isToday ? 'text-mint' : 'text-paper'}`}>{format(date, 'dd')}</p>
        </div>
        <div className="relative" style={{ height: (DAY_END - DAY_START) * PPM }}>
          {slots.slice(0, -1).map((m) => (
            <button
              key={m}
              aria-label={`Agendar ${toHHMM(m)}`}
              onClick={() => setCreating({ dia: iso, hora: toHHMM(m) })}
              className="absolute left-0 right-0 border-t border-line/30 hover:bg-mint/[0.05] group/add"
              style={{ top: (m - DAY_START) * PPM, height: 60 * PPM }}
            >
              <span className="hidden group-hover/add:flex items-center justify-center font-mono text-[9px] text-mint/70">
                <IconPlus className="w-3 h-3" /> {toHHMM(m)}
              </span>
            </button>
          ))}
          {dayAppts.map((a) => <Block key={a.id} a={a} />)}
        </div>
      </div>
    );
  };

  const monthCells = useMemo(() => {
    const y = anchor.getFullYear(); const mo = anchor.getMonth();
    const first = new Date(y, mo, 1);
    const startPad = (getDay(first) + 6) % 7;
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (const d2 of Array.from({ length: daysInMonth }, (_, i) => i + 1)) cells.push(new Date(y, mo, d2));
    return cells;
  }, [anchor]);

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Agenda</h1>
            <p className="text-fog text-[13px] mt-0.5">
              {view === 'semana' && `Semana de ${format(weekDays[0], 'dd MMM', { locale: ptBR })} a ${format(weekDays[5], 'dd MMM', { locale: ptBR })}`}
              {view === 'dia' && format(anchor, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              {view === 'mes' && format(anchor, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex border border-line">
              {(['dia', 'semana', 'mes'] as View[]).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors ${view === v ? 'bg-mint text-ink font-semibold' : 'text-fog hover:text-paper'}`}>
                  {v === 'mes' ? 'mês' : v}
                </button>
              ))}
            </div>
            <div className="flex border border-line">
              <button onClick={() => setAnchor((a) => (view === 'mes' ? new Date(a.getFullYear(), a.getMonth() - 1, 1) : addDays(a, view === 'semana' ? -7 : -1)))} className="px-2.5 text-fog hover:text-paper"><IconChevronL className="w-4 h-4" /></button>
              <button onClick={() => setAnchor(new Date())} className="px-3 font-mono text-[11px] text-fog hover:text-mint border-x border-line">hoje</button>
              <button onClick={() => setAnchor((a) => (view === 'mes' ? new Date(a.getFullYear(), a.getMonth() + 1, 1) : addDays(a, view === 'semana' ? 7 : 1)))} className="px-2.5 text-fog hover:text-paper"><IconChevronR className="w-4 h-4" /></button>
            </div>
            <Select value={fFisio} onChange={(e) => setFFisio(e.target.value)} className="!w-auto !py-1.5">
              <option value="all">Todos os fisios</option>
              {fisios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Select>
            <Select value={fRoom} onChange={(e) => setFRoom(e.target.value)} className="!w-auto !py-1.5">
              <option value="all">Todas as salas</option>
              {roomsFiltradas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </Select>
            <Btn onClick={() => setCreating({ dia: format(anchor, 'yyyy-MM-dd'), hora: '08:00' })}><IconPlus className="w-4 h-4" /> Nova sessão</Btn>
          </div>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {Object.entries(STATUS_META).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 font-mono text-[10.5px] text-fog">
              <span className="w-2 h-2 rounded-full" style={{ background: v.dot }} /> {v.label}
            </span>
          ))}
          <span className="ml-auto font-mono text-[10.5px] text-fog/70">clique num horário vazio para agendar · clique num bloco para gerenciar</span>
        </div>
      </Reveal>

      <Reveal delay={120}>
        {view !== 'mes' ? (
          <Card className="overflow-x-auto">
            <div className="flex min-w-[760px]">
              <div className="w-14 shrink-0">
                <div className="h-[52px] border-b border-line" />
                <div className="relative" style={{ height: (DAY_END - DAY_START) * PPM }}>
                  {slots.map((m) => (
                    <span key={m} className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-fog" style={{ top: (m - DAY_START) * PPM }}>
                      {toHHMM(m)}
                    </span>
                  ))}
                </div>
              </div>
              {(view === 'semana' ? weekDays : [anchor]).map((d2) => <ColumnDay key={d2.toISOString()} date={d2} />)}
            </div>
          </Card>
        ) : (
          <Card>
            <div className="grid grid-cols-7 border-b border-line">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((w) => (
                <div key={w} className="px-2 py-2 text-center font-mono text-[10px] uppercase text-fog border-l border-line/60 first:border-l-0">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((c, i) => {
                if (!c) return <div key={`x${i}`} className="min-h-[84px] border-l border-t border-line/40 first:border-l-0 bg-deep/40" />;
                const iso = format(c, 'yyyy-MM-dd');
                const doDia = appointments.filter((a) => dayOf(a) === iso && inUnit(a));
                const n = doDia.length;
                const rec = doDia.filter((a) => a.status !== 'cancelado').reduce((s, a) => s + a.valor, 0);
                const today = iso === hoje;
                return (
                  <button key={iso} onClick={() => { setAnchor(c); setView('dia'); }}
                    className={`min-h-[84px] border-l border-t border-line/40 p-2 text-left hover:bg-raise/50 transition-colors ${today ? 'bg-mint/[0.06]' : ''}`}>
                    <span className={`font-display font-bold text-[14px] ${today ? 'text-mint' : 'text-paper/80'}`}>{format(c, 'dd')}</span>
                    {n > 0 && (
                      <span className="mt-1.5 block">
                        <span className="inline-block font-mono text-[9.5px] text-mint border border-mint/30 px-1.5 py-px">{n} sessão{n > 1 ? 'ões' : ''}</span>
                        <span className="block font-mono text-[9px] text-fog mt-1">{fmtBRL(rec)}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        )}
      </Reveal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Gerenciar sessão">
        {selected && (() => {
          const a = selected;
          const sm = STATUS_META[a.status];
          const p = patients.find((x) => x.id === a.pacienteId);
          const f = users.find((u) => u.id === a.fisioId);
          const r = rooms.find((x) => x.id === a.roomId);
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-lg">{p?.nome}</p>
                  <p className="font-mono text-[11px] text-fog mt-0.5">{a.tipo}</p>
                </div>
                <Chip className={sm.chip}><span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.dot }} />{sm.label}</Chip>
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono text-[12px]">
                <div className="border border-line bg-deep px-3 py-2.5"><span className="block text-fog text-[10px] uppercase">Data</span>{format(new Date(dayOf(a) + 'T12:00'), 'dd MMM yyyy', { locale: ptBR })}</div>
                <div className="border border-line bg-deep px-3 py-2.5 flex items-center gap-2"><IconClock className="w-3.5 h-3.5 text-fog" /><span className="text-fog text-[10px] uppercase mr-auto">Horário</span>{a.inicio}–{a.fim}</div>
                <div className="border border-line bg-deep px-3 py-2.5"><span className="block text-fog text-[10px] uppercase">Profissional</span>{f?.nome}</div>
                <div className="border border-line bg-deep px-3 py-2.5"><span className="block text-fog text-[10px] uppercase">Sala / Equip.</span>{r?.nome}</div>
              </div>
              <div className="flex items-center justify-between border border-line bg-deep px-3 py-2.5 font-mono text-[12px]">
                <span className="text-fog uppercase text-[10px]">Valor da sessão</span>
                <span className="text-mint font-semibold">{fmtBRL(a.valor)}</span>
              </div>

              {a.serieId && (
                <div className="border border-amber/35 bg-amber/[0.05] px-3 py-2.5 flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-wide text-amber flex items-center gap-1.5">
                    <IconCalendar className="w-3.5 h-3.5" />
                    Série recorrente · {appointments.filter((x) => x.serieId === a.serieId && dayOf(x) >= hoje).length} sessões futuras
                  </span>
                  <span className="ml-auto"><Btn variant="subtle" className="!px-2.5 !py-1 !text-[11px]" onClick={() => setSerieEdit(a)}>Editar série</Btn></span>
                </div>
              )}

              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-wide text-fog mb-2">Alterar status</p>
                <div className="flex flex-wrap gap-2">
                  {statusFlow.map((s) => (
                    <button key={s} onClick={() => { setAppointmentStatus(a.id, s); setSelected({ ...a, status: s }); }}
                      className={`px-3 py-1.5 border font-mono text-[11px] transition-all active:translate-y-px ${a.status === s ? STATUS_META[s].chip : 'border-line text-fog hover:text-paper hover:border-line2'}`}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                  <button onClick={() => { setAppointmentStatus(a.id, 'faltou'); setSelected({ ...a, status: 'faltou' }); }}
                    className={`px-3 py-1.5 border font-mono text-[11px] ${a.status === 'faltou' ? STATUS_META.faltou.chip : 'border-pulse/40 text-pulse hover:bg-pulse/10'}`}>Faltou</button>
                  <button onClick={() => { setAppointmentStatus(a.id, 'cancelado'); setSelected({ ...a, status: 'cancelado' }); }}
                    className={`px-3 py-1.5 border font-mono text-[11px] ${a.status === 'cancelado' ? STATUS_META.cancelado.chip : 'border-line text-fog hover:text-paper'}`}>Cancelar</button>
                </div>
              </div>

              <Btn variant="subtle" className="w-full" onClick={() => sendWhats(a)}><IconWhats className="w-4 h-4" /> Enviar lembrete (WhatsApp)</Btn>
            </div>
          );
        })()}
      </Modal>

      <NewAppointmentModal
        creating={creating}
        onClose={() => setCreating(null)}
        onSave={(list, serie) => {
          list.forEach((a) => addAppointment(a));
          if (serie) { upsertRegra(serie); toast(`Série criada: ${list.length} sessões recorrentes na agenda`); }
          else if (list.length) toast('Sessão agendada');
          setCreating(null);
        }}
      />

      {serieEdit && <SerieModal appt={serieEdit} onClose={() => setSerieEdit(null)} />}
      <span className="hidden">{String(recurrence.length)}</span>
    </div>
  );
}

/* ------------------------------ nova sessão ------------------------------ */
function NewAppointmentModal({ creating, onClose, onSave }: {
  creating: { dia: string; hora: string } | null;
  onClose: () => void;
  onSave: (list: Omit<Appointment, 'id'>[], serie?: RecurrenceRule) => void;
}) {
  const { patients, users, rooms } = useApp();
  const fisios = users.filter((u) => u.role === 'fisio');

  const [pacienteId, setPacienteId] = useState('');
  const [fisioId, setFisioId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [tipo, setTipo] = useState('Cinesioterapia');
  const [dia, setDia] = useState('');
  const [hora, setHora] = useState('08:00');
  const [dur, setDur] = useState(50);
  const [valor, setValor] = useState(120);
  const [recorrente, setRecorrente] = useState(false);
  const [semanas, setSemanas] = useState(8);
  const [diasSel, setDiasSel] = useState<number[]>([]);
  const [lastKey, setLastKey] = useState('');

  const key = creating ? `${creating.dia}${creating.hora}` : '';
  if (creating && key !== lastKey) {
    setLastKey(key);
    setDia(creating.dia);
    setHora(creating.hora);
    setDiasSel([getDay(new Date(creating.dia + 'T12:00'))].filter((d2) => d2 >= 1 && d2 <= 6));
  }

  const toggleDia = (d2: number) =>
    setDiasSel((s) => (s.includes(d2) ? s.filter((x) => x !== d2) : [...s, d2].sort()));

  const save = () => {
    if (!pacienteId || !fisioId || !roomId || !dia) return;
    const fim = toHHMM(toMin(hora) + dur);
    const base = { pacienteId, fisioId, roomId, tipo, inicio: hora, fim, valor: valor * 100, pacoteId: null, notas: '', status: 'agendado' as const };
    if (!recorrente) {
      onSave([{ ...base, [DATA_KEY]: dia } as Omit<Appointment, 'id'>]);
      return;
    }
    const serieId = `s${Date.now()}`;
    const rule: RecurrenceRule = {
      id: serieId, pacienteId, fisioId, roomId, tipo,
      diasSemana: diasSel, hora, duracaoMin: dur,
      inicio: dia, fim: format(addWeeks(new Date(dia + 'T12:00'), semanas), 'yyyy-MM-dd'),
      valor: valor * 100,
    };
    onSave(expandSerie(rule, dia, semanas), rule);
  };

  return (
    <Modal open={!!creating} onClose={onClose} title="Nova sessão de fisioterapia" wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Paciente">
          <Select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
            <option value="">Selecionar…</option>
            {patients.filter((p) => p.status !== 'alta' && !p.anonimizado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
        <Field label="Fisioterapeuta">
          <Select value={fisioId} onChange={(e) => setFisioId(e.target.value)}>
            <option value="">Selecionar…</option>
            {fisios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Select>
        </Field>
        <Field label="Sala / equipamento">
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Selecionar…</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </Select>
        </Field>
        <Field label="Tipo de sessão">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {['Cinesioterapia', 'Eletroterapia', 'RPG', 'Neurofuncional', 'Avaliação', 'Tração'].map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Data"><Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Field>
        <Field label="Início"><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
        <Field label="Duração (min)">
          <Select value={dur} onChange={(e) => setDur(Number(e.target.value))}>
            {[30, 40, 50, 60].map((d2) => <option key={d2} value={d2}>{d2} min</option>)}
          </Select>
        </Field>
        <Field label="Valor (R$)"><Input type="number" min={0} value={valor} onChange={(e) => setValor(Number(e.target.value))} /></Field>
      </div>

      <div className="mt-5 border border-line bg-deep p-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} className="accent-[#4fd1a5] w-4 h-4" />
          <span className="font-display font-semibold text-[13.5px]">Sessão recorrente</span>
          <span className="font-mono text-[10.5px] text-fog">ex.: 2x por semana durante 2 meses</span>
        </label>
        {recorrente && (
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <Field label="Dias da semana" hint="a série respeita os dias marcados">
              <div className="flex gap-1.5 flex-wrap">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((w, i) => (
                  <button key={w} type="button" onClick={() => toggleDia(i + 1)}
                    className={`px-2.5 py-1.5 border font-mono text-[11px] transition-colors ${diasSel.includes(i + 1) ? 'bg-mint text-ink border-mint font-semibold' : 'border-line text-fog hover:text-paper'}`}>
                    {w}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Repetir por">
              <Select value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
                {[2, 4, 6, 8, 10, 12].map((s) => <option key={s} value={s}>{s} semanas</option>)}
              </Select>
            </Field>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save} disabled={!pacienteId || !fisioId || !roomId || (recorrente && diasSel.length === 0)}>
          <IconPlus className="w-4 h-4" /> {recorrente ? 'Criar série' : 'Agendar'}
        </Btn>
      </div>
    </Modal>
  );
}

/* --------------------------- edição de série (F2) --------------------------- */
function SerieModal({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const { recurrence, editarSerie, cancelarSerie, users, rooms, toast } = useApp();
  const rule = recurrence.find((r) => r.id === appt.serieId);
  const fisios = users.filter((u) => u.role === 'fisio');

  const [diasSel, setDiasSel] = useState<number[]>(rule ? [...rule.diasSemana] : [getDay(new Date(dayOf(appt) + 'T12:00'))].filter((d2) => d2 >= 1 && d2 <= 6));
  const [hora, setHora] = useState(rule?.hora ?? appt.inicio);
  const [dur, setDur] = useState(rule?.duracaoMin ?? 50);
  const [semanas, setSemanas] = useState(4);
  const [fisioId, setFisioId] = useState(appt.fisioId);
  const [roomId, setRoomId] = useState(appt.roomId);
  const [armed, setArmed] = useState(false);

  const toggleDia = (d2: number) =>
    setDiasSel((s) => (s.includes(d2) ? s.filter((x) => x !== d2) : [...s, d2].sort()));

  const preview: string[] = diasSel.length
    ? expandSerie(
        { id: 'preview', pacienteId: appt.pacienteId, fisioId, roomId, tipo: appt.tipo, diasSemana: diasSel, hora, duracaoMin: dur, inicio: '', fim: '', valor: appt.valor },
        format(new Date(), 'yyyy-MM-dd'),
        semanas
      ).slice(0, 8).map((s) => format(new Date(dayOf(s) + 'T12:00'), 'dd/MM EEE', { locale: ptBR }).replace('.', ''))
    : [];

  const aplicar = () => {
    if (!diasSel.length) return;
    const patch: SeriePatch = { diasSemana: diasSel, hora, duracaoMin: dur, semanas, fisioId, roomId };
    const n = editarSerie(appt.serieId!, patch);
    toast(`Série atualizada: ${n} sessões regeneradas a partir de hoje`);
    onClose();
  };

  const cancelar = () => {
    if (!armed) { setArmed(true); return; }
    const n = cancelarSerie(appt.serieId!);
    toast(`Série cancelada: ${n} sessões futuras removidas — histórico preservado`, 'warn');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Editar série recorrente · ${appt.tipo}`} wide>
      <p className="font-mono text-[11px] text-fog mb-4">
        Alterações valem <span className="text-amber">de hoje em diante</span> — sessões passadas não são tocadas.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Dias da semana">
          <div className="flex gap-1.5 flex-wrap">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((w, i) => (
              <button key={w} type="button" onClick={() => toggleDia(i + 1)}
                className={`px-2.5 py-1.5 border font-mono text-[11px] transition-colors ${diasSel.includes(i + 1) ? 'bg-mint text-ink border-mint font-semibold' : 'border-line text-fog hover:text-paper'}`}>
                {w}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Duração da série (semanas)">
          <Select value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
            {[2, 4, 6, 8, 10, 12].map((s) => <option key={s} value={s}>{s} semanas</option>)}
          </Select>
        </Field>
        <Field label="Início"><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
        <Field label="Duração (min)">
          <Select value={dur} onChange={(e) => setDur(Number(e.target.value))}>
            {[30, 40, 50, 60].map((d2) => <option key={d2} value={d2}>{d2} min</option>)}
          </Select>
        </Field>
        <Field label="Fisioterapeuta">
          <Select value={fisioId} onChange={(e) => setFisioId(e.target.value)}>
            {fisios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Select>
        </Field>
        <Field label="Sala / equipamento">
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </Select>
        </Field>
      </div>

      <div className="mt-4 border border-line bg-deep p-3.5">
        <p className="font-mono text-[10.5px] uppercase tracking-wide text-fog mb-2">Preview · próximas {preview.length} sessões</p>
        {preview.length ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.map((p) => (
              <span key={p} className="font-mono text-[11px] border border-mint/30 text-mint px-2 py-0.5 bg-mint/5">{p}</span>
            ))}
            <span className="font-mono text-[11px] text-fog px-1 py-0.5">…</span>
          </div>
        ) : (
          <p className="font-mono text-[11px] text-pulse">Selecione ao menos um dia da semana.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-line">
        <Btn onClick={aplicar} disabled={!diasSel.length}>Aplicar novo padrão</Btn>
        <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
        <Btn variant={armed ? 'danger' : 'ghost'} className={armed ? '' : '!border-pulse/40 !text-pulse hover:!bg-pulse/10'} onClick={cancelar}>
          {armed ? 'Confirmar cancelamento da série' : 'Cancelar série futura'}
        </Btn>
      </div>
    </Modal>
  );
}
