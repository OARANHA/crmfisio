import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

type TickResult = {
  run_id: string;
  queued_confirmations: number;
  queued_nps: number;
  expired_waitlist_offers: number;
  clinics_processed: number;
};

type WorkerResult = {
  processed?: number;
  sent?: number;
  failed?: number;
  error?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const workerSecret = Deno.env.get('EVOLUTION_WORKER_SECRET');
  const automationSecret = Deno.env.get('MEDICSPRO_AUTOMATION_SECRET');

  if (!supabaseUrl || !serviceRole || !anonKey || !workerSecret || !automationSecret) {
    return json({ error: 'Automação MedicsPro não configurada no servidor' }, 503);
  }

  if (req.headers.get('x-automation-secret') !== automationSecret) {
    return json({ error: 'Automação não autorizada' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let runId: string | null = null;
  try {
    const { data, error } = await admin.rpc('run_whatsapp_automation_tick');
    if (error) throw error;

    const tick = (data ?? {}) as TickResult;
    runId = tick.run_id ?? null;

    let queuedWaitlistOffers = 0;
    let queuedReactivations = 0;
    if (runId) {
      const { data: waitlistData, error: waitlistError } = await admin.rpc('run_waitlist_auto_recovery_tick', { p_run_id: runId });
      if (waitlistError) throw waitlistError;
      queuedWaitlistOffers = Number(waitlistData ?? 0);

      const { data: reactivationData, error: reactivationError } = await admin.rpc('run_reactivation_auto_tick', { p_run_id: runId });
      if (reactivationError) throw reactivationError;
      queuedReactivations = Number(reactivationData ?? 0);
    }

    const workerResponse = await fetch(`${supabaseUrl}/functions/v1/evolution-worker`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
        'x-worker-secret': workerSecret,
      },
      body: JSON.stringify({ limit: 100 }),
    });

    const workerPayload = await workerResponse.json().catch(() => ({})) as WorkerResult;
    if (!workerResponse.ok || workerPayload.error) {
      throw new Error(workerPayload.error ?? `Worker HTTP ${workerResponse.status}`);
    }

    if (runId) {
      await admin.from('automation_runs').update({
        finished_at: new Date().toISOString(),
        queued_waitlist_offers: queuedWaitlistOffers,
        queued_reactivations: queuedReactivations,
        worker_processed: Number(workerPayload.processed ?? 0),
        worker_sent: Number(workerPayload.sent ?? 0),
        worker_failed: Number(workerPayload.failed ?? 0),
        status: 'completed',
        error_message: null,
      }).eq('id', runId);
    }

    return json({
      ok: true,
      ...tick,
      queued_waitlist_offers: queuedWaitlistOffers,
      queued_reactivations: queuedReactivations,
      worker: {
        processed: Number(workerPayload.processed ?? 0),
        sent: Number(workerPayload.sent ?? 0),
        failed: Number(workerPayload.failed ?? 0),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida na automação';
    console.error('[medicspro-automation]', message);

    if (runId) {
      await admin.from('automation_runs').update({
        finished_at: new Date().toISOString(),
        status: 'failed',
        error_message: message.slice(0, 800),
      }).eq('id', runId);
    }

    return json({ error: message }, 500);
  }
});
