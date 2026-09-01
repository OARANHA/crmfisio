import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const pickText = (item: Record<string, unknown>) => {
  const message = (item.message ?? {}) as Record<string, unknown>;
  if (typeof message.conversation === 'string') return message.conversation;
  const extended = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (typeof extended?.text === 'string') return extended.text;
  const image = message.imageMessage as Record<string, unknown> | undefined;
  if (typeof image?.caption === 'string') return image.caption;
  const video = message.videoMessage as Record<string, unknown> | undefined;
  if (typeof video?.caption === 'string') return video.caption;
  return null;
};

const normalizeEventType = (value: unknown) => String(value ?? 'UNKNOWN')
  .trim()
  .toUpperCase()
  .replace(/[.\-\s]+/g, '_');

const statusUpdate = (raw: unknown) => {
  if (typeof raw === 'number') {
    if (raw >= 4) return { status: 'lido', field: 'read_at' };
    if (raw === 3) return { status: 'entregue', field: 'delivered_at' };
    if (raw === 2) return { status: 'enviado', field: 'sent_at' };
    if (raw === 0) return { status: 'falhou', field: 'failed_at' };
    return null;
  }
  const value = String(raw ?? '').toUpperCase();
  if (!value) return null;
  if (value.includes('READ') || value.includes('PLAYED')) return { status: 'lido', field: 'read_at' };
  if (value.includes('DELIVERY') || value.includes('DELIVERED')) return { status: 'entregue', field: 'delivered_at' };
  if (value.includes('SERVER_ACK') || value === 'SENT' || value.includes('ACCEPTED')) return { status: 'enviado', field: 'sent_at' };
  if (value.includes('ERROR') || value.includes('FAIL')) return { status: 'falhou', field: 'failed_at' };
  return null;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET');
  if (!supabaseUrl || !serviceRole || !webhookSecret) return json({ error: 'Webhook não configurado' }, 503);
  if (req.headers.get('x-webhook-secret') !== webhookSecret) return json({ error: 'Webhook não autorizado' }, 401);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rawEventType = payload.event ?? payload.type ?? 'UNKNOWN';
  const eventType = normalizeEventType(rawEventType);
  const instanceName = String(payload.instance ?? payload.instanceName ?? 'medicspro');
  const rawData = payload.data ?? payload;
  const items = Array.isArray(rawData) ? rawData : [rawData];
  let recorded = 0;
  let updated = 0;
  let inboundProcessed = 0;
  const inboundActions: string[] = [];

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as Record<string, unknown>;
    const key = (item.key ?? {}) as Record<string, unknown>;
    const eventMessageId = key.id ? String(key.id) : item.messageId ? String(item.messageId) : null;
    // Evolution 2.3.x usa messageId como ID interno do registro de mensagem nos eventos
    // messages.update e keyId como o ID real retornado pelo WhatsApp no sendText.
    const whatsappMessageId = item.keyId ? String(item.keyId) : key.id ? String(key.id) : null;
    const remoteJid = key.remoteJid ? String(key.remoteJid) : item.remoteJid ? String(item.remoteJid) : null;
    const fromMe = typeof key.fromMe === 'boolean' ? key.fromMe : typeof item.fromMe === 'boolean' ? item.fromMe : null;
    const messageText = pickText(item);

    let log: { id: string; clinic_id: string; status: string } | null = null;
    const correlationIds = [...new Set([whatsappMessageId, eventMessageId].filter(Boolean))] as string[];
    for (const correlationId of correlationIds) {
      const { data } = await admin
        .from('wa_logs')
        .select('id,clinic_id,status')
        .eq('provider_message_id', correlationId)
        .maybeSingle();
      if (data) {
        log = data as typeof log;
        break;
      }
    }

    const rawStatus = item.status ?? (item.update as Record<string, unknown> | undefined)?.status ?? item.messageStatus;
    const { data: eventRow, error: eventError } = await admin.from('wa_events').insert({
      clinic_id: log?.clinic_id ?? null,
      wa_log_id: log?.id ?? null,
      provider: 'evolution',
      instance_name: instanceName,
      event_type: eventType,
      provider_message_id: whatsappMessageId ?? eventMessageId,
      remote_jid: remoteJid,
      from_me: fromMe,
      message_text: messageText,
      payload: { event: eventType, provider_event: rawEventType, instance: instanceName, data: item, event_message_id: eventMessageId },
    }).select('id').maybeSingle();
    if (!eventError) recorded += 1;

    if (eventType === 'MESSAGES_UPSERT' && fromMe === false && remoteJid && messageText) {
      const { data: inbound, error: inboundError } = await admin.rpc('process_whatsapp_inbound', {
        p_remote_jid: remoteJid,
        p_message_text: messageText,
      });
      if (!inboundError && inbound) {
        inboundProcessed += 1;
        const action = String((inbound as Record<string, unknown>).action ?? 'unknown');
        inboundActions.push(action);
        if (eventRow?.id) {
          const linkedLogId = (inbound as Record<string, unknown>).wa_log_id;
          const patientId = (inbound as Record<string, unknown>).patient_id;
          let clinicId: string | null = null;
          if (linkedLogId) {
            const { data: linked } = await admin.from('wa_logs').select('clinic_id').eq('id', linkedLogId).maybeSingle();
            clinicId = linked?.clinic_id ?? null;
          }
          await admin.from('wa_events').update({
            wa_log_id: linkedLogId ?? null,
            clinic_id: clinicId,
            payload: {
              event: eventType,
              provider_event: rawEventType,
              instance: instanceName,
              data: item,
              inbound_action: action,
              patient_id: patientId ?? null,
              event_message_id: eventMessageId,
            },
          }).eq('id', eventRow.id);
        }
      } else if (inboundError) {
        console.error('[evolution-webhook] inbound:', inboundError);
      }
    }

    if (!log) continue;
    const now = new Date().toISOString();
    const transition = statusUpdate(rawStatus);
    const patch: Record<string, unknown> = {
      provider_event: eventType,
      provider_status: rawStatus === undefined ? null : String(rawStatus),
    };

    if (eventType === 'SEND_MESSAGE' && ['fila', 'enviando'].includes(log.status)) {
      patch.status = 'enviado';
      patch.sent_at = now;
    }
    if (transition) {
      patch.status = transition.status;
      patch[transition.field] = now;
      if (transition.status === 'falhou') patch.error_message = `Evolution reportou status ${String(rawStatus)}`;
    }

    if (Object.keys(patch).length > 2 || patch.provider_status !== null) {
      const { error } = await admin.from('wa_logs').update(patch).eq('id', log.id);
      if (!error) updated += 1;
    }
  }

  return json({ ok: true, event: eventType, recorded, updated, inboundProcessed, inboundActions });
});
