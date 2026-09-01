import { getISODay, parseISO } from 'date-fns';
import { Btn } from '../../lib/ui';
import { WAITLIST_PERIOD_LABEL, type WaitlistEntry, type WaitlistPeriod } from '../../lib/waitlist';
import type { Appointment, Room, Unidade, User } from '../../lib/types';

const DAY: Record<number, string> = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 7: 'Dom' };
const PRIORITY: Record<number, string> = { 0: 'Normal', 1: 'Preferencial', 2: 'Alta', 3: 'Urgente operacional' };
const slotPeriod = (time: string): WaitlistPeriod => Number(time.slice(0, 2)) < 12 ? 'manha' : Number(time.slice(0, 2)) < 18 ? 'tarde' : 'noite';

export function entryMatchesSlot(entry: WaitlistEntry, slot: Appointment, rooms: Room[]) {
  const unitId = rooms.find((room) => room.id === slot.roomId)?.unidadeId ?? null;
  if (entry.preferredDays.length && !entry.preferredDays.includes(getISODay(parseISO(slot.data)))) return false;
  if (entry.period !== 'qualquer' && entry.period !== slotPeriod(slot.inicio)) return false;
  if (entry.professionalId && entry.professionalId !== slot.fisioId) return false;
  if (entry.unitId && entry.unitId !== unitId) return false;
  return true;
}

interface Props {
  entry: WaitlistEntry;
  patientName: string;
  users: User[];
  unidades: Unidade[];
  matchingSlot?: Appointment;
  busy: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onClaim: (slot: Appointment) => void;
}

export function WaitlistEntryCard({ entry, patientName, users, unidades, matchingSlot, busy, onEdit, onRemove, onClaim }: Props) {
  const professional = entry.professionalId ? users.find((item) => item.id === entry.professionalId)?.nome : 'Qualquer profissional';
  const unit = entry.unitId ? unidades.find((item) => item.id === entry.unitId)?.nome : 'Qualquer unidade';
  const days = entry.preferredDays.length ? entry.preferredDays.map((day) => DAY[day]).join(', ') : 'Qualquer dia';
  return (
    <div className={`border p-3 space-y-3 ${matchingSlot ? 'border-mint/60 bg-mint/[0.04]' : 'border-line/70 bg-deep/40'}`}>
      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2"><p className="text-[12px] font-semibold">{patientName}</p><span className={`font-mono text-[9px] px-1.5 py-0.5 border ${matchingSlot ? 'text-mint border-mint/50' : 'text-amber border-amber/40'}`}>{matchingSlot ? 'VAGA ENCONTRADA' : 'AGUARDANDO OPORTUNIDADE'}</span></div>
          <p className="text-[11px] text-fog mt-1">{matchingSlot ? `${matchingSlot.data} · ${matchingSlot.inicio}–${matchingSlot.fim}` : 'Nenhuma vaga compatível disponível no momento.'}</p>
        </div>
        <div className="flex gap-2">{matchingSlot && <Btn onClick={() => onClaim(matchingSlot)} disabled={busy}>Agendar agora</Btn>}<Btn variant="ghost" onClick={onEdit} disabled={busy}>Editar preferências</Btn><Btn variant="ghost" onClick={onRemove} disabled={busy}>Remover</Btn></div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 font-mono text-[10px] text-fog">
        <span>Profissional: <b className="text-paper font-normal">{professional}</b></span><span>Unidade: <b className="text-paper font-normal">{unit}</b></span><span>Quando: <b className="text-paper font-normal">{days} · {WAITLIST_PERIOD_LABEL[entry.period]}</b></span><span>Prioridade: <b className="text-paper font-normal">{PRIORITY[entry.priority] ?? entry.priority}</b></span>
      </div>
      {entry.notes && <p className="text-[10px] text-fog">Observação: {entry.notes}</p>}
    </div>
  );
}
