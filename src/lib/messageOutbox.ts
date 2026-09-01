import { supabase } from './supabaseClient';

export type MessageTemplate = 'confirmacao' | 'nps' | 'reativacao' | 'vaga_espera';
export type MessageStatus = 'fila' | 'enviando' | 'enviado' | 'entregue' | 'lido' | 'falhou' | 'cancelado';

export interface MessageOutboxRow {
  id: string;
  patientId: string;
  template: MessageTemplate;
  message: string;
  status: MessageStatus;
  createdAt: string;
  scheduledFor: string;
  provider: string | null;
  errorMessage: string | null;
}

export interface MessageTemplateRow {
  id: string;
  template: MessageTemplate;
  body: string;
  active: boolean;
}

const mapLog = (row: Record<string, unknown>): MessageOutboxRow => ({
  id: String(row.id),
  patientId: String(row.patient_id),
  template: row.template as MessageTemplate,
  message: String(row.mensagem ?? ''),
  status: row.status as MessageStatus,
  createdAt: String(row.created_at ?? row.enviado_em),
  scheduledFor: String(row.scheduled_for ?? row.enviado_em),
  provider: row.provider ? String(row.provider) : null,
  errorMessage: row.error_message ? String(row.error_message) : null,
});

export async function ensureMessageTemplates(): Promise<void> {
  const { error } = await (supabase.rpc as Function)('ensure_default_message_templates');
  if (error) throw error;
}

export async function loadMessageTemplates(clinicId: string): Promise<MessageTemplateRow[]> {
  await ensureMessageTemplates();
  const { data, error } = await supabase
    .from('message_templates' as never)
    .select('*')
    .eq('clinic_id', clinicId)
    .order('template');
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    template: row.template as MessageTemplate,
    body: String(row.body ?? ''),
    active: Boolean(row.ativo),
  }));
}

export async function saveMessageTemplate(id: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('message_templates' as never)
    .update({ body: body.trim() } as never)
    .eq('id', id);
  if (error) throw error;
}

export async function loadMessageOutbox(clinicId: string): Promise<MessageOutboxRow[]> {
  const { data, error } = await supabase
    .from('wa_logs')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(250);
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapLog);
}

export async function queueAppointmentConfirmations(hours = 48): Promise<number> {
  const { data, error } = await (supabase.rpc as Function)('queue_appointment_confirmations', { p_hours: hours });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function queueWaitlistOffer(waitlistId: string, cancelledAppointmentId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as Function)('queue_waitlist_offer', {
    p_waitlist_id: waitlistId,
    p_cancelled_appointment_id: cancelledAppointmentId,
  });
  if (error) throw error;
  return String(data);
}
