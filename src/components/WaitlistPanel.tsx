import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { queueWaitlistOffer } from '../lib/messageOutbox';
import { resolveClinicId } from '../lib/repository';
import {
  claimWaitlistSlot, createWaitlistEntry, loadWaitlist, updateWaitlistEntry, updateWaitlistStatus,
  WAITLIST_PERIOD_LABEL, type WaitlistEntry, type WaitlistPeriod,
} from '../lib/waitlist';
import { useApp, patientName, userName } from '../lib/store';
import type { Appointment, Room, Unidade } from '../lib/types';
import { Btn, Card, Field, Select, Input } from '../lib/ui';
import { WaitlistEntryCard, entryMatchesSlot } from './waitlist/WaitlistEntryCard';

interface Props { unidades: Unidade[]; rooms: Room[]; onRecovered: () => void }
const dayLabels = [{ value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }];

export function WaitlistPanel({ unidades, rooms, onRecovered }: Props) {
  const { user, users, patients, appointments, toast } = useApp();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [clinicId, setClinicId] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const refresh = async (id = clinicId) => { if (id) setEntries(await loadWaitlist(id)); };
  useEffect(() => {
    if (!user?.id || !canManage) return;
    resolveClinicId(user.id).then((id) => { setClinicId(id); return refresh(id); }).catch((error) => {
      console.error('[MedicsPro] lista de espera:', error); toast('Não foi possível carregar a lista de espera.', 'warn');
    });
  }, [user?.id, canManage]);

  const releasedSlots = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return appointments.filter((item) => item.status === 'cancelado' && item.data >= today)
      .filter((cancelled) => !appointments.some((active) => active.status !== 'cancelado' && active.id !== cancelled.id
        && active.data === cancelled.data && active.inicio === cancelled.inicio
        && active.fisioId === cancelled.fisioId && active.roomId === cancelled.roomId))
      .sort((a, b) => `${a.data}${a.inicio}`.localeCompare(`${b.data}${b.inicio}`)).slice(0, 8);
  }, [appointments]);

  const matchFor = (entry: WaitlistEntry) => releasedSlots.find((slot) => entryMatchesSlot(entry, slot, rooms));
  const matchedEntries = entries.filter((entry) => !!matchFor(entry)).length;
  const resetForm = () => { setEditingId(null); setPatientId(''); setProfessionalId(''); setUnitId(''); setPeriod('qualquer'); setPriority(1); setPreferredDays([]); setNotes(''); };
  const startEdit = (entry: WaitlistEntry) => {
    setExpanded(true); setEditingId(entry.id); setPatientId(entry.patientId); setProfessionalId(entry.professionalId ?? '');
    setUnitId(entry.unitId ?? ''); setPeriod(entry.period); setPriority(entry.priority); setPreferredDays(entry.preferredDays); setNotes(entry.notes);
  };

  const saveEntry = async () => {
    if (!clinicId || !patientId || !canManage) return;
    setBusy(true);
    try {
      const values = { professionalId: professionalId || null, unitId: unitId || null, preferredDays, period, priority, notes };
      if (editingId) await updateWaitlistEntry(editingId, values);
      else await createWaitlistEntry({ clinicId, patientId, ...values });
      await refresh(); resetForm(); toast(editingId ? 'Preferências da lista de espera atualizadas.' : 'Paciente incluído na lista de espera.');
    } catch (error) {
      console.error('[MedicsPro] salvar lista de espera:', error); toast('Não foi possível salvar a lista de espera.', 'warn');
    } finally { setBusy(false); }
  };

  const removeEntry = async (id: string) => {
    setBusy(true);
    try { await updateWaitlistStatus(id, 'cancelado'); await refresh(); if (editingId === id) resetForm(); toast('Paciente removido da lista de espera.'); }
    catch (error) { console.error('[MedicsPro] remover lista de espera:', error); toast('Não foi possível remover a entrada.', 'warn'); }
    finally { setBusy(false); }
  };

  const recoverSlot = async (entry: WaitlistEntry, slot: Appointment) => {
    setBusy(true);
    try { await claimWaitlistSlot(entry.id, slot.id); toast(`Vaga preenchida com ${patientName(patients, entry.patientId)}.`); await refresh(); onRecovered(); }
    catch (error) { console.error('[MedicsPro] recuperar vaga:', error); toast('A vaga pode ter sido ocupada por outro usuário.', 'warn'); }
    finally { setBusy(false); }
  };

  const offerSlot = async (entry: WaitlistEntry, slot: Appointment) => {
    setBusy(true);
    try {
      await queueWaitlistOffer(entry.id, slot.id);
      await refresh();
      toast(`Oferta enfileirada para ${patientName(patients, entry.patientId)}. O envio será feito pelo canal configurado.`);
    } catch (error) {
      console.error('[MedicsPro] ofertar vaga:', error);
      toast('Não foi possível enfileirar a oferta. Verifique opt-in e disponibilidade da vaga.', 'warn');
    } finally { setBusy(false); }
  };

  if (!canManage) return null;
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full p-4 flex flex-wrap items-center gap-3 text-left hover:bg-raise/30">
        <div className="flex-1"><h2 className="font-display font-bold text-[15px]">Lista de espera</h2><p className="text-fog text-[11px]">Pacientes aguardando uma oportunidade compatível.</p></div>
        {matchedEntries > 0 && <span className="font-mono text-[10px] text-mint border border-mint/50 px-2 py-1">⚡ {matchedEntries} vaga{matchedEntries > 1 ? 's' : ''} recuperável{matchedEntries > 1 ? 'is' : ''}</span>}
        <span className="font-mono text-[10px] text-fog border border-line px-2 py-1">{entries.length} aguardando</span>
        <span className="font-mono text-[11px] text-mint">{expanded ? 'Fechar ↑' : 'Gerenciar ↓'}</span>
      </button>

      {expanded && <div className="border-t border-line p-4 space-y-4">
        <div className="border border-line bg-deep/50 p-3 space-y-3">
          <div className="flex justify-between gap-2"><div><p className="text-[12px] font-semibold">{editingId ? 'Editar preferências' : 'Adicionar paciente à espera'}</p><p className="text-[10px] text-fog">Quanto mais flexível, maior a chance de recuperar uma vaga.</p></div>{editingId && <Btn variant="ghost" onClick={resetForm}>Cancelar edição</Btn>}</div>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Paciente"><Select value={patientId} disabled={!!editingId} onChange={(e) => setPatientId(e.target.value)}><option value="">Selecionar…</option>{patients.filter((p) => p.status !== 'alta' && !p.anonimizado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
            <Field label="Profissional preferido"><Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}><option value="">Qualquer profissional</option>{professionals.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
            <Field label="Unidade preferida"><Select value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">Qualquer unidade</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</Select></Field>
            <Field label="Período"><Select value={period} onChange={(e) => setPeriod(e.target.value as WaitlistPeriod)}>{Object.entries(WAITLIST_PERIOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Prioridade"><Select value={priority} onChange={(e) => setPriority(Number(e.target.value))}><option value={0}>Normal</option><option value={1}>Preferencial</option><option value={2}>Alta</option><option value={3}>Urgente operacional</option></Select></Field>
            <Field label="Observação"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: aceita encaixe com 1h de antecedência" /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-fog">Dias:</span>{dayLabels.map((day) => { const active = preferredDays.includes(day.value); return <button key={day.value} type="button" onClick={() => setPreferredDays((prev) => active ? prev.filter((v) => v !== day.value) : [...prev, day.value])} className={`border px-2 py-1 text-[10px] ${active ? 'border-mint text-mint bg-mint/10' : 'border-line text-fog'}`}>{day.label}</button>; })}<Btn className="ml-auto" onClick={saveEntry} disabled={!patientId || busy}>{editingId ? 'Salvar preferências' : 'Adicionar à espera'}</Btn></div>
        </div>

        <div className="space-y-2">
          {entries.map((entry) => {
            const patient = patients.find((item) => item.id === entry.patientId);
            return <WaitlistEntryCard key={entry.id} entry={entry} patientName={patientName(patients, entry.patientId)} patientOptIn={!!patient?.optInWhats} users={users} unidades={unidades} matchingSlot={matchFor(entry)} busy={busy} onEdit={() => startEdit(entry)} onRemove={() => removeEntry(entry.id)} onClaim={(slot) => recoverSlot(entry, slot)} onOffer={(slot) => offerSlot(entry, slot)} />;
          })}
          {entries.length === 0 && <div className="border border-dashed border-line p-6 text-center"><p className="text-[12px] text-paper">Nenhum paciente aguardando encaixe.</p><p className="text-[10px] text-fog mt-1">Adicione apenas quem realmente aceita antecipação ou horários alternativos.</p></div>}
        </div>

        {releasedSlots.length > 0 && <div className="border-t border-line pt-3"><p className="font-mono text-[10px] uppercase tracking-wider text-amber mb-2">Vagas liberadas ainda sem candidato</p>{releasedSlots.filter((slot) => !entries.some((entry) => entryMatchesSlot(entry, slot, rooms))).map((slot) => <div key={slot.id} className="text-[11px] text-fog py-1">{slot.data} · {slot.inicio}–{slot.fim} · {userName(users, slot.fisioId)} — nenhum paciente compatível.</div>)}</div>}
      </div>}
    </Card>
  );
}
