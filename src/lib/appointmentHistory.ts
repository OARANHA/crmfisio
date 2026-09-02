import { supabase } from './supabaseClient';

export interface AppointmentHistoryItem {
  id: string;
  kind: 'status' | 'reschedule';
  at: string;
  label: string;
  detail: string;
}

const statusLabel = (value: unknown) => String(value ?? '').split('_').join(' ');

export async function loadAppointmentHistory(appointmentId: string): Promise<AppointmentHistoryItem[]> {
  const historyQuery = await (supabase.from as Function)('appointment_status_history')
    .select('id,from_status,to_status,changed_at')
    .eq('appointment_id', appointmentId)
    .order('changed_at', { ascending: false });
  if (historyQuery.error) throw historyQuery.error;

  const appointmentQuery = await (supabase.from as Function)('appointments')
    .select('id,data,inicio,fim,status,cancellation_reason,rescheduled_from_id,created_at,updated_at')
    .eq('id', appointmentId)
    .single();
  if (appointmentQuery.error) throw appointmentQuery.error;

  const childQuery = await (supabase.from as Function)('appointments')
    .select('id,data,inicio,fim,status,cancellation_reason,rescheduled_from_id,created_at')
    .eq('rescheduled_from_id', appointmentId)
    .order('created_at', { ascending: false });
  if (childQuery.error) throw childQuery.error;

  const current = appointmentQuery.data as Record<string, unknown>;
  const items: AppointmentHistoryItem[] = ((historyQuery.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    kind: 'status',
    at: String(row.changed_at),
    label: `${statusLabel(row.from_status)} → ${statusLabel(row.to_status)}`,
    detail: 'Alteração de status registrada na trilha operacional.',
  }));

  if (current.rescheduled_from_id) {
    const parentQuery = await (supabase.from as Function)('appointments')
      .select('id,data,inicio,fim,created_at')
      .eq('id', current.rescheduled_from_id)
      .maybeSingle();
    if (!parentQuery.error && parentQuery.data) {
      const parent = parentQuery.data as Record<string, unknown>;
      items.push({
        id: `from-${String(parent.id)}`,
        kind: 'reschedule',
        at: String(current.created_at ?? current.updated_at),
        label: 'Sessão remarcada para este horário',
        detail: `${String(parent.data)} ${String(parent.inicio).slice(0, 5)} → ${String(current.data)} ${String(current.inicio).slice(0, 5)}`,
      });
    }
  }

  for (const child of (childQuery.data ?? []) as Record<string, unknown>[]) {
    items.push({
      id: `to-${String(child.id)}`,
      kind: 'reschedule',
      at: String(child.created_at),
      label: 'Sessão remarcada',
      detail: `${String(current.data)} ${String(current.inicio).slice(0, 5)} → ${String(child.data)} ${String(child.inicio).slice(0, 5)}${current.cancellation_reason ? ` · ${String(current.cancellation_reason)}` : ''}`,
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
