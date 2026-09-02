import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { findAvailability, type AvailabilitySearch } from '../lib/agendaAvailability';
import type { Appointment, Room, Unidade, User } from '../lib/types';
import { Btn, Card, Select } from '../lib/ui';

interface Props {
  open: boolean;
  appointments: Appointment[];
  rooms: Room[];
  unidades: Unidade[];
  fisios: User[];
  defaultFisioId: string;
  defaultUnitId: string;
  onClose: () => void;
  onChoose: (slot: { dia: string; hora: string; fisioId: string; roomId: string }) => void;
}

export function AppointmentFinderPanel({ open, appointments, rooms, unidades, fisios, defaultFisioId, defaultUnitId, onClose, onChoose }: Props) {
  const [search, setSearch] = useState<AvailabilitySearch>({ durationMin: 60, period: 'qualquer', daysAhead: 7, fisioId: defaultFisioId, unitId: defaultUnitId, roomId: 'all' });
  const slots = useMemo(() => findAvailability({ appointments, rooms, fisioIds: fisios.map((item) => item.id), search }), [appointments, rooms, fisios, search]);
  if (!open) return null;

  return (
    <Card className="!p-4 border-mint/30">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div>
          <p className="font-display font-bold text-lg">Encontrar horário</p>
          <p className="font-mono text-[10px] text-fog">busca sem conflito de profissional e sala/recurso</p>
        </div>
        <Btn className="ml-auto" variant="ghost" onClick={onClose}>Fechar</Btn>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-2">
        <Select value={String(search.durationMin)} onChange={(e) => setSearch((s) => ({ ...s, durationMin: Number(e.target.value) }))}>
          {[30,45,60,90,120].map((value) => <option key={value} value={value}>{value} min</option>)}
        </Select>
        <Select value={search.period} onChange={(e) => setSearch((s) => ({ ...s, period: e.target.value as AvailabilitySearch['period'] }))}>
          <option value="qualquer">Qualquer período</option><option value="manha">Manhã</option><option value="tarde">Tarde</option>
        </Select>
        <Select value={String(search.daysAhead)} onChange={(e) => setSearch((s) => ({ ...s, daysAhead: Number(e.target.value) }))}>
          <option value="3">Próximos 3 dias</option><option value="7">Próximos 7 dias</option><option value="14">Próximos 14 dias</option>
        </Select>
        <Select value={search.fisioId} onChange={(e) => setSearch((s) => ({ ...s, fisioId: e.target.value }))}>
          <option value="all">Qualquer profissional</option>{fisios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </Select>
        <Select value={search.unitId} onChange={(e) => setSearch((s) => ({ ...s, unitId: e.target.value, roomId: 'all' }))}>
          <option value="all">Qualquer unidade</option>{unidades.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </Select>
        <Select value={search.roomId} onChange={(e) => setSearch((s) => ({ ...s, roomId: e.target.value }))}>
          <option value="all">Qualquer sala</option>{rooms.filter((room) => search.unitId === 'all' || room.unidadeId === search.unitId).map((room) => <option key={room.id} value={room.id}>{room.nome}</option>)}
        </Select>
      </div>

      <div className="mt-4 grid md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto">
        {slots.length === 0 && <p className="font-mono text-[11px] text-fog">Nenhum horário livre encontrado com estes critérios.</p>}
        {slots.map((slot) => {
          const fisio = fisios.find((item) => item.id === slot.fisioId);
          const room = rooms.find((item) => item.id === slot.roomId);
          return (
            <button key={`${slot.date}-${slot.start}-${slot.fisioId}-${slot.roomId}`} onClick={() => onChoose({ dia: slot.date, hora: slot.start, fisioId: slot.fisioId, roomId: slot.roomId })}
              className="border border-line bg-deep hover:border-mint/50 hover:bg-mint/[0.04] text-left p-3 transition-colors">
              <p className="font-display font-semibold">{format(new Date(`${slot.date}T12:00:00`), "EEE, dd/MM", { locale: ptBR })} · {slot.start}</p>
              <p className="font-mono text-[10px] text-fog mt-1">{fisio?.nome ?? 'Profissional'} · {room?.nome ?? 'Sala'}</p>
              <p className="font-mono text-[9px] text-mint mt-2">usar este horário →</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
