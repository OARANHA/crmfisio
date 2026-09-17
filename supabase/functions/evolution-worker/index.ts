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

type ClinicLifecycleRow = {
  id: string;
  lifecycle_status: string;
  deleted_at: string | null;
};

const clinicActive = (row: ClinicLifecycleRow | null | undefined) =>
  Boolean(row && !row.deleted_at && row.lifecycle_status === 'active');

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
  if (!workerSecret) {
    console.error('[evolution-worker] EVOLUTION_WORKER_SECRET ausente');
    return json({ error: 'Worker interno não configurado' }, 503);
  }
  if (req.headers.get('x-worker-secret') !== workerSecret) {
    return json({ error: 'Worker não autorizado' }, 401);
  }

  // This function uses service_role and reserves from a global queue. It must
  // therefore be internal-only. Human clinic sessions enqueue messages through
  // tenant-scoped flows; they never execute the global delivery worker directly.
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let limit = 20;
  try {
    const body = await req.json().catch(() => ({}));
    limit = Math.max(1, Math.min(Number(body?.limit) || 20, 100));
  } catch { /* usa o padrão */ }

  // Legacy RPC name retained, but stale `enviando` rows are now quarantined as
  // DELIVERY_UNCERTAIN. They are never blindly returned to the delivery queue.
  await admin.rpc('requeue_stale_messages', { p_minutes: 10 });
  const { data, error } = await admin.rpc('claim_message_outbox', { p_limit: limit });
  if (error) {
    console.error('[evolution-worker] claim:', error);
    return json({ error: 'Não foi possível reservar a fila' }, 500);
  }

  const rows = (data ?? []) as QueueRow[];
  const clinicIds = [...new Set(rows.map((row) => row.clinic_id).filter(Boolean))];
  const entitlementAllowedByClinic = new Map<string, boolean>();
  const lifecycleByClinic = new Map<string, ClinicLifecycleRow>();
  if (clinicIds.length) {
    const [entitlementResults, clinicResult] = await Promise.all([
      Promise.all(clinicIds.map(async (clinicId) => {
        const { data: allowed, error: entitlementError } = await admin.rpc('clinic_entitlement_allowed', {
          p_clinic_id: clinicId,
          p_entitlement_key: 'whatsapp.access',
        });
        return { clinicId, allowed: allowed === true, error: entitlementError };
      })),
      admin
        .from('clinics')
        .select('id,lifecycle_status,deleted_at')
        .in('id', clinicIds),
    ]);

    const entitlementFailure = entitlementResults.find((result) => result.error);
    if (entitlementFailure) {
      console.error('[evolution-worker] queue entitlements:', entitlementFailure.error);
      return json({ error: 'Não foi possível validar os módulos WhatsApp da fila' }, 503);
    }
    if (clinicResult.error) {
      console.error('[evolution-worker] queue clinics:', clinicResult.error);
      return json({ error: 'Não foi possível validar as clínicas da fila' }, 503);
    }

    for (const result of entitlementResults) entitlementAllowedByClinic.set(result.clinicId, result.allowed);
    for (const row of (clinicResult.data ?? []) as ClinicLifecycleRow[]) lifecycleByClinic.set(row.id, row);
  }

  const results: Array<{ id: string; status: 'enviado' | 'falhou'; providerMessageId?: string }> = [];
  let blocked = 0;

  for (const row of rows) {
    if (!clinicActive(lifecycleByClinic.get(row.clinic_id))) {
      blocked += 1;
      await admin.from('wa_logs').update({
        status: 'fila',
        scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        provider_status: 'CLINIC_BLOCKED',
        error_message: 'Clínica suspensa ou indisponível',
      }).eq('id', row.id);
      continue;
    }

    if (entitlementAllowedByClinic.get(row.clinic_id) !== true) {
      blocked += 1;
      await admin.from('wa_logs').update({
        status: 'fila',
        scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        provider_status: 'ENTITLEMENT_BLOCKED',
        error_message: 'Módulo WhatsApp temporariamente não liberado para esta clínica',
      }).eq('id', row.id);
      continue;
    }

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

    let deliveryAccepted = false;
    let acceptedProviderMessageId: string | null = null;
    let definitiveProviderFailure = false;

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
        definitiveProviderFailure = true;
        const reason = String(payload.message ?? payload.error ?? rawText ?? `HTTP ${response.status}`).slice(0, 800);
        throw new Error(reason);
      }

      const key = payload.key as Record<string, unknown> | undefined;
      acceptedProviderMessageId = key?.id ? String(key.id) : null;
      const providerStatus = payload.status ? String(payload.status) : 'ACCEPTED';
      const now = new Date().toISOString();
      deliveryAccepted = true;

      const { error: updateError } = await admin.from('wa_logs').update({
        status: 'enviado',
        provider: 'evolution',
        provider_message_id: acceptedProviderMessageId,
        provider_event: 'SEND_MESSAGE',
        provider_status: providerStatus,
        sent_at: now,
        failed_at: null,
        error_message: null,
      }).eq('id', row.id);
      if (updateError) throw updateError;

      results.push({ id: row.id, status: 'enviado', ...(acceptedProviderMessageId ? { providerMessageId: acceptedProviderMessageId } : {}) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha desconhecida no provedor';
      console.error('[evolution-worker] envio:', row.id, reason);

      if (deliveryAccepted) {
        // Provider acceptance is known. Retry only the local persistence; never
        // send the WhatsApp request again. If this also fails, the row remains
        // `enviando` and the stale quarantine/webhook reconciliation takes over.
        const { error: recoveryError } = await admin.from('wa_logs').update({
          status: 'enviado',
          provider: 'evolution',
          provider_message_id: acceptedProviderMessageId,
          provider_event: 'SEND_MESSAGE',
          provider_status: 'ACCEPTED_RECOVERED',
          sent_at: new Date().toISOString(),
          failed_at: null,
          error_message: null,
        }).eq('id', row.id);

        if (!recoveryError) {
          results.push({ id: row.id, status: 'enviado', ...(acceptedProviderMessageId ? { providerMessageId: acceptedProviderMessageId } : {}) });
          continue;
        }

        console.error('[evolution-worker] persistência pós-aceite:', row.id, recoveryError);
        results.push({ id: row.id, status: 'falhou' });
        continue;
      }

      const uncertain = !definitiveProviderFailure;
      await admin.from('wa_logs').update({
        status: 'falhou',
        failed_at: new Date().toISOString(),
        error_message: uncertain
          ? `Resultado do envio incerto: ${reason}`.slice(0, 800)
          : reason.slice(0, 800),
        provider_status: uncertain ? 'DELIVERY_UNCERTAIN' : 'ERROR',
      }).eq('id', row.id);
      results.push({ id: row.id, status: 'falhou' });
    }
  }

  return json({
    processed: results.length,
    sent: results.filter((item) => item.status === 'enviado').length,
    failed: results.filter((item) => item.status === 'falhou').length,
    blocked,
    results,
  });
});
