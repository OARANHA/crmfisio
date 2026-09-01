import { useMemo, useState } from 'react';
import { findAppointmentConflicts, conflictLabel } from '../lib/appointmentConflicts';
import { useApp, patientName, userName } from '../lib/store';
import type { Appointment, Room, Unidade } from '../lib/types';
import { Btn, Field, Input, Modal, Select } from '../lib/ui';

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export type CreateAt = {
  dia: string;
  hora: string;
  patientId?: string;
  fisioId?: string;
  roomId?: string;
  duracaoMin?: number;
  isFitIn?: boolean;
} | null;

interface Props {
  creating: CreateAt;
  onClose: () => void;
  rooms: Room[];
  unidades: Unidade[];
  prefillPatientId?: string;
  onSave: (appointment: Omit<Appointment, 'id'>) => void;
}

export function AppointmentCreateModal({ creating, onClose, rooms, unidades, prefillPatientId, onSave }: Props) {
  const { user, users, patients, appointments } = useApp();
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
  const [isFitIn, setIsFitIn] = useState(false);
  const [key, setKey] = useState('');

  const createKey = creating
    ? [creating.dia, creating.hora, creating.patientId, creating.fisioId, creating.roomId, creating.isFitIn ? 'fit' : 'normal'].join('-')
    : '';

  if (creating && createKey !== key) {
    setKey(createKey);
    setDia(creating.dia);
    setHora(creating.hora);
    setPacienteId(creating.patientId ?? prefillPatientId ?? '');
    const initialRoomId = creating.roomId ?? '';
    const initialRoom = rooms.find((r) => r.id === initialRoomId);
    const firstUnit = initialRoom?.unidadeId ?? unidades[0]?.id ?? '';
    setUnitId(firstUnit);
    setRoomId(initialRoomId || rooms.find((r) => r.unidadeId === firstUnit)?.id || '');
    setFisioId(user?.role === 'fisio' ? user.id : (creating.fisioId ?? ''));
    setDuracao(creating.duracaoMin ?? 50);
    setIsFitIn(Boolean(creating.isFitIn));
  }

  const fim = toHHMM(toMin(hora) + duracao);
  const availableRooms = rooms.filter((r) => !unitId || r.unidadeId === unitId);
  const conflicts = useMemo(() => {
    if (!pacienteId || !fisioId || !roomId || !dia || !hora) return [];
    return findAppointmentConflicts(appointments, {
      pacienteId,
      fisioId,
      roomId,
      data: dia,
      inicio: hora,
      fim,
    });
  }, [appointments, pacienteId, fisioId, roomId, dia, hora, fim]);

  const uniqueConflicts = conflicts.filter((item, index, all) =>
    all.findIndex((other) => other.kind === item.kind && other.appointment.id === item.appointment.id) === index
  );

  const save = () => {
    if (!pacienteId || !fisioId || !roomId || !dia || conflicts.length > 0) return;
    onSave({
      pacienteId,
      fisioId,
      roomId,
      data: dia,
      inicio: hora,
      fim,
      status: 'agendado',
      tipo,
      valor: Math.round(valor * 100),
      pacoteId: null,
      serieId: null,
      notas: '',
      isFitIn,
    });
  };

  return (
    <Modal open={!!creating} onClose={onClose} title={isFitIn ? 'Novo encaixe' : 'Nova sessão'} wide>
      {isFitIn && (
        <div className="mb-4 border border-mint/35 bg-mint/[0.06] p-3 text-[12px] text-mint">
          Vaga recuperada da lista de espera. Confirme os dados antes de agendar.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Paciente">
          <Select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
            <option value="">Selecionar…</option>
            {patients.filter((p) => p.status !== 'alta' && !p.anonimizado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
        <Field label="Profissional">
          <Select value={fisioId} disabled={user?.role === 'fisio'} onChange={(e) => setFisioId(e.target.value)}>
            <option value="">Selecionar…</option>
            {fisios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Select>
        </Field>
        <Field label="Unidade">
          <Select value={unitId} onChange={(e) => {
            const id = e.target.value;
            setUnitId(id);
            setRoomId(rooms.find((r) => r.unidadeId === id)?.id ?? '');
          }}>
            <option value="">Selecionar…</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
        </Field>
        <Field label="Sala / equipamento">
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Selecionar…</option>
            {availableRooms.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </Select>
        </Field>
        <Field label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value)}>{['Avaliação','Cinesioterapia','Eletroterapia','RPG','Neurofuncional','Pilates','Tração'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Data"><Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Field>
        <Field label="Início"><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
        <Field label="Duração"><Select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))}>{[30,40,50,60,90].map((d) => <option key={d} value={d}>{d} min</option>)}</Select></Field>
        <Field label="Valor (R$)"><Input type="number" min={0} value={valor} onChange={(e) => setValor(Number(e.target.value))} /></Field>
        <div className="border border-line bg-deep px-3 py-2 text-[12px]">
          <span className="font-mono text-[9px] uppercase text-fog block">Término previsto</span>
          {fim}
        </div>
      </div>

      {uniqueConflicts.length > 0 && (
        <div className="mt-4 border border-pulse/40 bg-pulse/[0.05] p-4 space-y-2">
          <p className="font-display font-semibold text-pulse">Horário indisponível</p>
          {uniqueConflicts.map(({ kind, appointment }) => (
            <div key={`${kind}-${appointment.id}`} className="text-[12px] text-paper/90">
              <span className="text-pulse">• {conflictLabel(kind)}</span>{' '}
              <span className="font-mono text-fog">{appointment.inicio}–{appointment.fim} · {patientName(patients, appointment.pacienteId)} · {userName(users, appointment.fisioId)}</span>
            </div>
          ))}
          <p className="font-mono text-[10.5px] text-fog">Altere profissional, sala, data ou horário para continuar.</p>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save} disabled={!pacienteId || !fisioId || !roomId || conflicts.length > 0}>{isFitIn ? 'Confirmar encaixe' : 'Agendar sessão'}</Btn>
      </div>
    </Modal>
  );
}
