import { supabase } from './supabaseClient';

export type AppointmentWhatsappState = {
  appointmentId: string;
  status: string;
  providerStatus: string | null;
  replyText: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
};

export async function loadAppointmentWhatsappStates(appointmentIds: string[]) {
  if (appointmentIds.length === 0) return new Map<string, AppointmentWhatsappState>();

  const { data, error } = await supabase
    .from('wa_logs')
    .select('appointment_id,status,provider_status,reply_text,sent_at,delivered_at,read_at,created_at')
    .eq('template', 'confirmacao')
    .in('appointment_id', appointmentIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const states = new Map<string, AppointmentWhatsappState>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const appointmentId = row.appointment_id ? String(row.appointment_id) : '';
    if (!appointmentId || states.has(appointmentId)) continue;
    states.set(appointmentId, {
      appointmentId,
      status: String(row.status ?? 'fila'),
      providerStatus: row.provider_status ? String(row.provider_status) : null,
      replyText: row.reply_text ? String(row.reply_text) : null,
      sentAt: row.sent_at ? String(row.sent_at) : null,
      deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
      readAt: row.read_at ? String(row.read_at) : null,
    });
  }
  return states;
}

export function appointmentWhatsappLabel(state?: AppointmentWhatsappState) {
  if (!state) return 'Confirmação não enviada';
  if (state.replyText) return `Respondido: ${state.replyText}`;
  if (state.status === 'lido' || state.readAt) return 'Lido ✓✓';
  if (state.status === 'entregue' || state.deliveredAt) return 'Entregue ✓✓';
  if (state.status === 'enviado') return 'Enviado ✓';
  if (state.status === 'falhou') return 'Falha no envio';
  if (state.status === 'fila' || state.status === 'enviando') return 'Na fila';
  return state.status;
}
