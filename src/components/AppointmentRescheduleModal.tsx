import { useMemo, useState } from 'react';
import { conflictLabel, findAppointmentConflicts } from '../lib/appointmentConflicts';
import { useApp, patientName, userName } from '../lib/store';
import type { Appointment, Room, Unidade } from '../lib/types';
import { Btn, Field, Input, Modal, Select } from '../lib/ui';

const toMin = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export interface ReschedulePreset {
  data: string;
  inicio: string;
  reason?: string;
}

interface Props {
  appointment: Appointment | null;
  rooms: Room[];
  unidades: Unidade[];
  preset?: ReschedulePreset | null;
  onClose: () => void;
  onConfirm: (payload: { data: string; inicio: string; fim: string; fisioId: string; roomId: string; reason: string; isFitIn: boolean }) => void;
  busy?: boolean;
}

export function AppointmentRescheduleModal({ appointment, rooms, unidades, preset, onClose, onConfirm, busy = false }: Props) {
  const { users, patients, appointments } = useApp();
  const [key, setKey] = useState('');
  const [data, setData] = useState('');
  const [inicio, setInicio] = useState('08:00');
  const [duracao, setDuracao] = useState(50);
  const [fisioId, setFisioId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('Solicitação do paciente');
  const [isFitIn, setIsFitIn] = useState(false);

  const stateKey = appointment ? `${appointment.id}:${preset?.data ?? ''}:${preset?.inicio ?? ''}` : '';
  if (appointment && stateKey !== key) {
    setKey(stateKey);
    setData(preset?.data ?? appointment.data);
    setInicio(preset?.inicio ?? appointment.inicio);
    setDuracao(Math.max(15, toMin(appointment.fim) - toMin(appointment.inicio)));
    setFisioId(appointment.fisioId);
    const room = rooms.find((item) => item.id === appointment.roomId);
    setUnitId(room?.unidadeId ?? '');
    setRoomId(appointment.roomId);
    setReason(preset?.reason ?? 'Solicitação do paciente');
    setIsFitIn(Boolean(appointment.isFitIn));
  }

  const fim = toHHMM(toMin(inicio) + duracao);
  const availableRooms = rooms.filter((room) => !unitId || room.unidadeId === unitId);
  const fisios = users.filter((user) => user.role === 'fisio');
  const conflicts = useMemo(() => {
    if (!appointment || !data || !inicio || !fisioId || !roomId) return [];
    return findAppointmentConflicts(appointments, {
      pacienteId: appointment.pacienteId,
      fisioId,
      roomId,
      data,
      inicio,
      fim,
    }, appointment.id);
  }, [appointment, appointments, data, inicio, fim, fisioId, roomId]);

  return (
    <Modal open={!!appointment} onClose={onClose} title="Remarcar sessão" wide>
      {appointment && (
        <div className="space-y-4">
          <div className="border border-line bg-deep p-3 text-[12px]">
            <span className="font-mono text-[9px] uppercase text-fog block">Paciente</span>
            {patientName(patients, appointment.pacienteId)}
            {preset && <p className="font-mono text-[10px] text-mint mt-1">Movido pela agenda para {preset.data} às {preset.inicio}. Revise antes de confirmar.</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
            <Field label="Início"><Input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Field>
            <Field label="Duração"><Select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))}>{[30,40,50,60,90].map((d) => <option key={d} value={d}>{d} min</option>)}</Select></Field>
            <Field label="Profissional"><Select value={fisioId} onChange={(e) => setFisioId(e.target.value)}>{fisios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</Select></Field>
            <Field label="Unidade"><Select value={unitId} onChange={(e) => { const id = e.target.value; setUnitId(id); setRoomId(rooms.find((room) => room.unidadeId === id)?.id ?? ''); }}>{unidades.map((unit) => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}</Select></Field>
            <Field label="Sala / recurso"><Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>{availableRooms.map((room) => <option key={room.id} value={room.id}>{room.nome}</option>)}</Select></Field>
            <Field label="Motivo da remarcação"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: solicitação do paciente" /></Field>
            <label className="border border-line bg-deep px-3 py-2 text-[12px] flex items-center gap-2">
              <input type="checkbox" checked={isFitIn} onChange={(e) => setIsFitIn(e.target.checked)} />
              Marcar como encaixe
            </label>
          </div>

          {conflicts.length > 0 && (
            <div className="border border-pulse/40 bg-pulse/[0.05] p-4 space-y-1">
              <p className="font-display font-semibold text-pulse">Novo horário indisponível</p>
              {conflicts.map(({ kind, appointment: conflict }, index) => (
                <p key={`${kind}-${conflict.id}-${index}`} className="text-[11.5px]">
                  <span className="text-pulse">{conflictLabel(kind)}</span>{' '}
                  <span className="font-mono text-fog">{conflict.inicio}–{conflict.fim} · {patientName(patients, conflict.pacienteId)} · {userName(users, conflict.fisioId)}</span>
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={onClose}>Voltar</Btn>
            <Btn disabled={busy || !data || !fisioId || !roomId || !reason.trim() || conflicts.length > 0} onClick={() => onConfirm({ data, inicio, fim, fisioId, roomId, reason: reason.trim(), isFitIn })}>
              {busy ? 'Remarcando…' : 'Confirmar remarcação'}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
