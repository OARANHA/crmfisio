import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeRpcStatus(message: string): { status: number; error: string } {
  if (message.includes('clinical_instrument_patient_delivery_not_authorized')
      || message.includes('clinical_instrument_patient_delivery_encounter_invalid')
      || message.includes('clinical_instrument_patient_delivery_patient_invalid')) {
    return { status: 403, error: 'Você não pode enviar este instrumento neste atendimento.' };
  }
  if (message.includes('clinical_instrument_patient_delivery_whatsapp_opt_in_required')) {
    return { status: 409, error: 'O paciente precisa autorizar comunicações por WhatsApp antes do envio.' };
  }
  if (message.includes('clinical_instrument_patient_delivery_phone_required')) {
    return { status: 409, error: 'O paciente não possui telefone válido para receber o instrumento.' };
  }
  if (message.includes('clinical_instrument_patient_delivery_idempotency_conflict')) {
    return { status: 409, error: 'A solicitação de envio já foi usada com outro contexto.' };
  }
  if (message.includes('clinical_instrument_patient_delivery_contract_unavailable')
      || message.includes('clinical_instrument_patient_delivery_invalid_')) {
    return { status: 400, error: 'Este instrumento não está disponível para envio ao paciente.' };
  }
  return { status: 500, error: 'Não foi possível preparar o envio do instrumento.' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicAppUrl = (Deno.env.get('MEDICSPRO_PUBLIC_APP_URL') ?? '').replace(/\/$/, '');
  if (!supabaseUrl || !serviceRole || !/^https:\/\//i.test(publicAppUrl)) {
    return json({ error: 'Entrega de instrumentos não configurada no servidor' }, 503);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return json({ error: 'Sessão ausente' }, 401);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(tokenMatch[1]);
  if (authError || !authData.user) return json({ error: 'Sessão inválida' }, 401);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const appointmentId = typeof body?.appointmentId === 'string' ? body.appointmentId.trim() : '';
  const instrumentKey = typeof body?.instrumentKey === 'string' ? body.instrumentKey.trim().toLowerCase() : '';
  const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
  const expiresHours = Math.max(1, Math.min(Number(body?.expiresHours) || 48, 168));

  if (!UUID_RE.test(appointmentId) || !UUID_RE.test(requestId) || !instrumentKey) {
    return json({ error: 'Atendimento, instrumento ou chave de solicitação inválida' }, 400);
  }

  const { data, error } = await admin.rpc('enqueue_clinical_instrument_patient_delivery', {
    p_actor_user_id: authData.user.id,
    p_appointment_id: appointmentId,
    p_instrument_key: instrumentKey,
    p_request_id: requestId,
    p_expires_hours: expiresHours,
    p_public_app_url: publicAppUrl,
  });
  if (error) {
    console.error('[clinical-instrument-patient-delivery] enqueue:', {
      actor: authData.user.id,
      appointmentId,
      instrumentKey,
      code: error.code,
      message: error.message,
    });
    const safe = safeRpcStatus(error.message ?? '');
    return json({ error: safe.error }, safe.status);
  }

  return json({ delivery: data });
});
