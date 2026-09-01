import { supabase } from './supabaseClient';

export type WaitlistPeriod = 'manha' | 'tarde' | 'noite' | 'qualquer';
export type WaitlistStatus = 'aguardando' | 'ofertado' | 'agendado' | 'cancelado';

export interface WaitlistEntry {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string | null;
  unitId: string | null;
  preferredDays: number[];
  period: WaitlistPeriod;
  priority: number;
  notes: string;
  status: WaitlistStatus;
  offeredAt: string | null;
  bookedAppointmentId: string | null;
  createdAt: string;
}

export interface CreateWaitlistEntryInput {
  clinicId: string;
  patientId: string;
  professionalId?: string | null;
  unitId?: string | null;
  preferredDays?: number[];
  period?: WaitlistPeriod;
  priority?: number;
  notes?: string;
}

const mapEntry = (row: Record<string, unknown>): WaitlistEntry => ({
  id: String(row.id),
  clinicId: String(row.clinic_id),
  patientId: String(row.patient_id),
  professionalId: row.professional_id ? String(row.professional_id) : null,
  unitId: row.unit_id ? String(row.unit_id) : null,
  preferredDays: Array.isArray(row.preferred_days) ? row.preferred_days.map(Number) : [],
  period: (row.period ?? 'qualquer') as WaitlistPeriod,
  priority: Number(row.priority ?? 0),
  notes: row.notes ? String(row.notes) : '',
  status: (row.status ?? 'aguardando') as WaitlistStatus,
  offeredAt: row.offered_at ? String(row.offered_at) : null,
  bookedAppointmentId: row.booked_appointment_id ? String(row.booked_appointment_id) : null,
  createdAt: String(row.created_at),
});

export async function loadWaitlist(clinicId: string): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from('waitlist_entries')
    .select('*')
    .eq('clinic_id', clinicId)
    .in('status', ['aguardando', 'ofertado'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapEntry(row as Record<string, unknown>));
}

export async function createWaitlistEntry(input: CreateWaitlistEntryInput): Promise<WaitlistEntry> {
  const { data, error } = await supabase
    .from('waitlist_entries')
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      professional_id: input.professionalId ?? null,
      unit_id: input.unitId ?? null,
      preferred_days: input.preferredDays ?? [],
      period: input.period ?? 'qualquer',
      priority: input.priority ?? 0,
      notes: input.notes?.trim() || null,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapEntry(data as Record<string, unknown>);
}

export async function updateWaitlistStatus(entryId: string, status: WaitlistStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'ofertado') patch.offered_at = new Date().toISOString();

  const { error } = await supabase.from('waitlist_entries').update(patch).eq('id', entryId);
  if (error) throw error;
}

export async function claimWaitlistSlot(entryId: string, cancelledAppointmentId: string): Promise<void> {
  const { error } = await (supabase.rpc as Function)('claim_waitlist_slot', {
    p_waitlist_id: entryId,
    p_cancelled_appointment_id: cancelledAppointmentId,
  });
  if (error) throw error;
}

export const WAITLIST_PERIOD_LABEL: Record<WaitlistPeriod, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  qualquer: 'Qualquer horário',
};
