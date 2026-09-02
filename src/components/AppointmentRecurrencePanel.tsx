import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { createAppointmentSeries, previewAppointmentSeries, type RecurrencePreviewSlot } from '../lib/appointmentRecurrence';
import { loadInfrastructure } from '../lib/infrastructure';
import { resolveClinicId } from '../lib/repository';
import { useApp } from '../lib/store';
import type { Room, Unidade } from '../lib/types';
import { Btn, Card, Field, Input, Select } from '../lib/ui';

const DAYS = [
  [1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [7, 'Dom'],
] as const;

export function AppointmentRecurrencePanel() {
  const { user, users, patients, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [units, setUnits] = useState<Unidade[]>([]);
  const [patientId, setPatientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [type, setType] = useState('Cinesioterapia');
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState('08:00');
  const [duration, setDuration] = useState(50);
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(addDays(new Date(), 28), 'yyyy-MM-dd'));
  const [value, setValue] = useState(120);
  const [preview, setPreview] = useState<RecurrencePreviewSlot[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id || !open) return;
    resolveClinicId(user.id).then(loadInfrastructure).then((data) => {
      if (!active) return;
      setRooms(data.rooms);
      setUnits(data.unidades);
      if (!unitId && data.unidades[0]) {
        setUnitId(data.unidades[0].id);
        setRoomId(data.rooms.find((room) => room.unidadeId === data.unidades[0].id)?.id ?? '');
      }
    }).catch((error) => {
      console.error('[MedicsPro] recorrência/infraestrutura:', error);
      toast('Não foi possível carregar a estrutura da clínica.', 'warn');
    });
    return () => { active = false; };
  }, [user?.id, open]);

  const professionals = users.filter((item) => item.role === 'fisio' && item.ativo);
  const availableRooms = useMemo(() => rooms.filter((room) => room.unidadeId === unitId), [rooms, unitId]);
  const ready = patientId && professionalId && roomId && weekdays.length > 0 && startDate && endDate && endDate >= startDate;
  const input = () => ({
    pacienteId: patientId,
    fisioId: professionalId,
    roomId,
    tipo: type,
    diasSemana: weekdays,
    hora: time,
    duracaoMin: duration,
    dataInicio: startDate,
    dataFim: endDate,
    valor: Math.round(value * 100),
  });

  const doPreview = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const slots = await previewAppointmentSeries(input());
      setPreview(slots);
      if (slots.length === 0) toast('Nenhuma ocorrência cai nos dias escolhidos.', 'warn');
    } catch (error) {
      console.error('[MedicsPro] prévia recorrência:', error);
      toast('Não foi possível calcular a prévia da série. A migration pode ainda não estar aplicada.', 'warn');
    } finally { setBusy(false); }
  };

  const create = async () => {
    if (!ready || preview.length === 0) return;
    setBusy(true);
    try {
      const result = await createAppointmentSeries(input(), true);
      toast(`Série criada: ${result.created} sessão(ões)${result.skipped ? `, ${result.skipped} conflito(s) ignorado(s)` : ''}.`);
      setPreview([]);
      setOpen(false);
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      console.error('[MedicsPro] criar recorrência:', error);
      toast('Não foi possível criar a série recorrente.', 'warn');
    } finally { setBusy(false); }
  };

  if (user?.role === 'fisio') return null;

  const available = preview.filter((slot) => slot.available).length;
  const conflicts = preview.length - available;

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold">Agendamento recorrente</p>
          <p className="font-mono text-[10px] text-fog mt-0.5">Crie a série no banco somente depois de revisar todos os horários.</p>
        </div>
        <Btn variant="ghost" onClick={() => { setOpen((value) => !value); setPreview([]); }}>{open ? 'Fechar' : 'Nova série'}</Btn>
      </div>

      {open && <div className="mt-4 space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Paciente"><Select value={patientId} onChange={(event) => { setPatientId(event.target.value); setPreview([]); }}><option value="">Selecionar…</option>{patients.filter((p) => p.status !== 'alta' && !p.anonimizado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
          <Field label="Profissional"><Select value={professionalId} onChange={(event) => { setProfessionalId(event.target.value); setPreview([]); }}><option value="">Selecionar…</option>{professionals.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
          <Field label="Unidade"><Select value={unitId} onChange={(event) => { const id = event.target.value; setUnitId(id); setRoomId(rooms.find((room) => room.unidadeId === id)?.id ?? ''); setPreview([]); }}><option value="">Selecionar…</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}</Select></Field>
          <Field label="Sala / recurso"><Select value={roomId} onChange={(event) => { setRoomId(event.target.value); setPreview([]); }}><option value="">Selecionar…</option>{availableRooms.map((room) => <option key={room.id} value={room.id}>{room.nome}</option>)}</Select></Field>
          <Field label="Tipo"><Select value={type} onChange={(event) => { setType(event.target.value); setPreview([]); }}>{['Avaliação','Cinesioterapia','Eletroterapia','RPG','Neurofuncional','Pilates','Tração'].map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Horário"><Input type="time" value={time} onChange={(event) => { setTime(event.target.value); setPreview([]); }} /></Field>
          <Field label="Duração"><Select value={duration} onChange={(event) => { setDuration(Number(event.target.value)); setPreview([]); }}>{[30,40,50,60,90].map((item) => <option key={item} value={item}>{item} min</option>)}</Select></Field>
          <Field label="Valor por sessão (R$)"><Input type="number" min={0} value={value} onChange={(event) => setValue(Number(event.target.value))} /></Field>
          <Field label="Início"><Input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPreview([]); }} /></Field>
          <Field label="Fim"><Input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPreview([]); }} /></Field>
        </div>

        <div>
          <p className="font-mono text-[9px] uppercase text-fog mb-2">Dias da semana</p>
          <div className="flex flex-wrap gap-2">{DAYS.map(([day, label]) => {
            const checked = weekdays.includes(day);
            return <button key={day} type="button" onClick={() => { setWeekdays((current) => checked ? current.filter((item) => item !== day) : [...current, day].sort()); setPreview([]); }} className={`border px-3 py-2 font-mono text-[10px] ${checked ? 'border-mint bg-mint/10 text-mint' : 'border-line text-fog'}`}>{label}</button>;
          })}</div>
        </div>

        <div className="flex justify-end"><Btn disabled={!ready || busy} onClick={doPreview}>{busy ? 'Calculando…' : 'Pré-visualizar série'}</Btn></div>

        {preview.length > 0 && <div className="border border-line bg-deep/50 p-3 space-y-3">
          <div className="flex flex-wrap gap-4 font-mono text-[10px]"><span className="text-mint">{available} disponíveis</span><span className={conflicts ? 'text-pulse' : 'text-fog'}>{conflicts} conflito(s)</span><span className="text-fog">{preview.length} ocorrências previstas</span></div>
          <div className="max-h-56 overflow-auto space-y-1">
            {preview.map((slot) => <div key={`${slot.data}-${slot.inicio}`} className="flex items-center justify-between gap-3 border-b border-line/40 py-1.5 text-[11px]"><span className="font-mono">{new Date(`${slot.data}T12:00:00`).toLocaleDateString('pt-BR')} · {slot.inicio}–{slot.fim}</span><span className={slot.available ? 'text-mint' : 'text-pulse'}>{slot.available ? 'Disponível' : slot.conflictDetail}</span></div>)}
          </div>
          <p className="font-mono text-[9.5px] text-fog">Ao confirmar, horários com conflito são ignorados; os demais são criados em uma única série persistente.</p>
          <div className="flex justify-end"><Btn disabled={busy || available === 0} onClick={create}>{busy ? 'Criando…' : `Criar ${available} sessão(ões)`}</Btn></div>
        </div>}
      </div>}
    </Card>
  );
}
