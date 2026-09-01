import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const normalizePhone = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`;
  if (!/^\d{12,15}$/.test(digits)) return null;
  return digits;
};

type QueueRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  waitlist_id: string | null;
  template: string;
  mensagem: string;
  telefone: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const evolutionUrl = (Deno.env.get('EVOLUTION_BASE_URL') ?? '').replace(/\/$/, '');
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
  const instance = Deno.env.get('EVOLUTION_INSTANCE') || 'medicspro';
  const workerSecret = Deno.env.get('EVOLUTION_WORKER_SECRET');

  if (!supabaseUrl || !serviceRole || !evolutionUrl || !evolutionKey) {
    return json({ error: 'Integração Evolution não configurada no servidor' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const internalAuthorized = !!workerSecret && req.headers.get('x-worker-secret') === workerSecret;
  if (!internalAuthorized) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sessão ausente' }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Sessão inválida' }, 401);

    const { data: caller } = await admin
      .from('profiles')
      .select('role,ativo')
      .eq('id', authData.user.id)
      .single();
    if (!caller?.ativo || !['owner', 'admin', 'recep'].includes(caller.role)) {
      return json({ error: 'Perfil sem permissão para disparar mensagens' }, 403);
    }
  }

  let limit = 20;
  try {
    const body = await req.json().catch(() => ({}));
    limit = Math.max(1, Math.min(Number(body?.limit) || 20, 100));
  } catch { /* usa o padrão */ }

  await admin.rpc('requeue_stale_messages', { p_minutes: 10 });
  const { data, error } = await admin.rpc('claim_message_outbox', { p_limit: limit });
  if (error) {
    console.error('[evolution-worker] claim:', error);
    return json({ error: 'Não foi possível reservar a fila' }, 500);
  }

  const rows = (data ?? []) as QueueRow[];
  const results: Array<{ id: string; status: 'enviado' | 'falhou'; providerMessageId?: string }> = [];

  for (const row of rows) {
    const phone = normalizePhone(row.telefone ?? '');
    if (!phone) {
      await admin.from('wa_logs').update({
        status: 'falhou',
        failed_at: new Date().toISOString(),
        error_message: 'Telefone inválido ou ausente',
        provider_status: 'INVALID_PHONE',
      }).eq('id', row.id);
      results.push({ id: row.id, status: 'falhou' });
      continue;
    }

    try {
      const response = await fetch(`${evolutionUrl}/message/sendText/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: {
          apikey: evolutionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number: phone, text: row.mensagem }),
      });

      const rawText = await response.text();
      let payload: Record<string, unknown> = {};
      try { payload = rawText ? JSON.parse(rawText) : {}; } catch { payload = { raw: rawText }; }

      if (!response.ok) {
        const reason = String(payload.message ?? payload.error ?? rawText ?? `HTTP ${response.status}`).slice(0, 800);
        throw new Error(reason);
      }

      const key = payload.key as Record<string, unknown> | undefined;
      const providerMessageId = key?.id ? String(key.id) : null;
      const providerStatus = payload.status ? String(payload.status) : 'ACCEPTED';
      const now = new Date().toISOString();

      const { error: updateError } = await admin.from('wa_logs').update({
        status: 'enviado',
        provider: 'evolution',
        provider_message_id: providerMessageId,
        provider_event: 'SEND_MESSAGE',
        provider_status: providerStatus,
        sent_at: now,
        failed_at: null,
        error_message: null,
      }).eq('id', row.id);
      if (updateError) throw updateError;

      results.push({ id: row.id, status: 'enviado', ...(providerMessageId ? { providerMessageId } : {}) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha desconhecida no provedor';
      console.error('[evolution-worker] envio:', row.id, reason);
      await admin.from('wa_logs').update({
        status: 'falhou',
        failed_at: new Date().toISOString(),
        error_message: reason.slice(0, 800),
        provider_status: 'ERROR',
      }).eq('id', row.id);
      results.push({ id: row.id, status: 'falhou' });
    }
  }

  return json({
    processed: results.length,
    sent: results.filter((item) => item.status === 'enviado').length,
    failed: results.filter((item) => item.status === 'falhou').length,
    results,
  });
});
