import { useEffect, useMemo, useState } from 'react';
import { format, getISODay, parseISO } from 'date-fns';
import { resolveClinicId } from '../lib/repository';
import {
  claimWaitlistSlot,
  createWaitlistEntry,
  loadWaitlist,
  updateWaitlistStatus,
  WAITLIST_PERIOD_LABEL,
  type WaitlistEntry,
  type WaitlistPeriod,
} from '../lib/waitlist';
import { useApp, patientName, userName } from '../lib/store';
import type { Appointment, Room, Unidade } from '../lib/types';
import { Btn, Card, Field, Select, Input } from '../lib/ui';

interface Props {
  unidades: Unidade[];
  rooms: Room[];
  onRecovered: () => void;
}

const dayLabels = [
  { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' },
];

const periodForHour = (value: string): WaitlistPeriod => {
  const hour = Number(value.slice(0, 2));
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
};

export function WaitlistPanel({ unidades, rooms, onRecovered }: Props) {
  const { user, users, patients, appointments, toast } = useApp();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [clinicId, setClinicId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [period, setPeriod] = useState<WaitlistPeriod>('qualquer');
  const [priority, setPriority] = useState(1);
  const [preferredDays, setPreferredDays] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'recep';
  const professionals = users.filter((item) => item.role === 'fisio' && item.ativo);

  const refresh = async (resolvedClinicId?: string) => {
    const id = resolvedClinicId ?? clinicId;
    if (!id) return;
    setEntries(await loadWaitlist(id));
  };

  useEffect(() => {
    if (!user?.id || !canManage) return;
    resolveClinicId(user.id)
      .then((id) => {
        setClinicId(id);
        return refresh(id);
      })
      .catch((error) => {
        console.error('[MedicsPro] lista de espera:', error);
        toast('Não foi possível carregar a lista de espera.', 'warn');
      });
  }, [user?.id, canManage]);

  const releasedSlots = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return appointments
      .filter((item) => item.status === 'cancelado' && item.data >= today)
      .filter((cancelled) => !appointments.some((active) =>
        active.status !== 'cancelado'
        && active.id !== cancelled.id
        && active.data === cancelled.data
        && active.inicio === cancelled.inicio
        && active.fisioId === cancelled.fisioId
        && active.roomId === cancelled.roomId
      ))
      .sort((a, b) => `${a.data}${a.inicio}`.localeCompare(`${b.data}${b.inicio}`))
      .slice(0, 8);
  }, [appointments]);

  const matchesSlot = (entry: WaitlistEntry, slot: Appointment) => {
    const isoDay = getISODay(parseISO(slot.data));
    const slotPeriod = periodForHour(slot.inicio);
    const slotUnitId = rooms.find((room) => room.id === slot.roomId)?.unidadeId ?? null;
    if (entry.preferredDays.length > 0 && !entry.preferredDays.includes(isoDay)) return false;
    if (entry.period !== 'qualquer' && entry.period !== slotPeriod) return false;
    if (entry.professionalId && entry.professionalId !== slot.fisioId) return false;
    if (entry.unitId && entry.unitId !== slotUnitId) return false;
    return true;
  };

  const addEntry = async () => {
    if (!clinicId || !patientId || !canManage) return;
    setBusy(true);
    try {
      await createWaitlistEntry({
        clinicId,
        patientId,
        professionalId: professionalId || null,
        unitId: unitId || null,
        preferredDays,
        period,
        priority,
        notes,
      });
      setPatientId(''); setNotes(''); setPreferredDays([]); setPriority(1); setPeriod('qualquer');
      await refresh();
      toast('Paciente incluído na lista de espera.');
    } catch (error) {
      console.error('[MedicsPro] incluir lista de espera:', error);
      toast('Não foi possível incluir o paciente na lista de espera.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const cancelEntry = async (id: string) => {
    setBusy(true);
    try {
      await updateWaitlistStatus(id, 'cancelado');
      await refresh();
      toast('Entrada removida da lista de espera.');
    } catch (error) {
      console.error('[MedicsPro] remover lista de espera:', error);
      toast('Não foi possível remover a entrada.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const recoverSlot = async (entry: WaitlistEntry, slot: Appointment) => {
    setBusy(true);
    try {
      await claimWaitlistSlot(entry.id, slot.id);
      toast(`Vaga preenchida com ${patientName(patients, entry.patientId)}.`);
      await refresh();
      onRecovered();
    } catch (error) {
      console.error('[MedicsPro] recuperar vaga:', error);
      toast('A vaga não pôde ser preenchida. Ela pode ter sido ocupada por outro usuário.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  if (!canManage) return null;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg">Lista de espera & vagas liberadas</h2>
          <p className="text-fog text-[12px]">Transforme cancelamentos em encaixes antes que o horário fique ocioso.</p>
        </div>
        <span className="font-mono text-[10px] text-mint">{entries.length} aguardando</span>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Paciente">
          <Select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Selecionar…</option>
            {patients.filter((p) => p.status !== 'alta' && !p.anonimizado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
        <Field label="Profissional preferido">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Qualquer profissional</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
        <Field label="Unidade preferida">
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">Qualquer unidade</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
        </Field>
        <Field label="Período">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as WaitlistPeriod)}>
            {Object.entries(WAITLIST_PERIOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Prioridade">
          <Select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            <option value={0}>Normal</option><option value={1}>Preferencial</option><option value={2}>Alta</option><option value={3}>Urgente operacional</option>
          </Select>
        </Field>
        <Field label="Observação">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: aceita encaixe com 1h de antecedência" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-fog">Dias:</span>
        {dayLabels.map((day) => {
          const active = preferredDays.includes(day.value);
          return <button key={day.value} type="button" onClick={() => setPreferredDays((prev) => active ? prev.filter((v) => v !== day.value) : [...prev, day.value])} className={`border px-2 py-1 text-[10px] ${active ? 'border-mint text-mint bg-mint/10' : 'border-line text-fog'}`}>{day.label}</button>;
        })}
        <Btn className="ml-auto" onClick={addEntry} disabled={!patientId || busy}>Adicionar à espera</Btn>
      </div>

      {releasedSlots.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-amber">Vagas liberadas</p>
          {releasedSlots.map((slot) => {
            const candidates = entries.filter((entry) => matchesSlot(entry, slot));
            const best = candidates[0];
            return (
              <div key={slot.id} className="border border-line bg-deep p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-[200px]">
                  <p className="text-[12px] font-semibold">{slot.data} · {slot.inicio}–{slot.fim}</p>
                  <p className="font-mono text-[10px] text-fog">{userName(users, slot.fisioId)} · {slot.tipo}</p>
                </div>
                <div className="flex-1 text-[11px] text-fog">{best ? `${patientName(patients, best.patientId)} é o melhor encaixe entre ${candidates.length} candidato(s).` : 'Nenhum paciente da espera combina com esse horário.'}</div>
                {best && <Btn onClick={() => recoverSlot(best, slot)} disabled={busy}>Preencher vaga</Btn>}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        {entries.slice(0, 10).map((entry) => (
          <div key={entry.id} className="border border-line/70 px-3 py-2 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <p className="text-[12px] font-semibold">{patientName(patients, entry.patientId)}</p>
              <p className="font-mono text-[10px] text-fog">{WAITLIST_PERIOD_LABEL[entry.period]} · prioridade {entry.priority} {entry.professionalId ? `· ${userName(users, entry.professionalId)}` : ''}</p>
            </div>
            <Btn variant="ghost" onClick={() => cancelEntry(entry.id)} disabled={busy}>Remover</Btn>
          </div>
        ))}
        {entries.length === 0 && <p className="text-[11px] text-fog">Nenhum paciente aguardando encaixe.</p>}
      </div>
    </Card>
  );
}
