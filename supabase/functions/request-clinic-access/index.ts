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

type Payload = {
  clinic_name?: string;
  cnpj?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  website?: string;
};

const normalized = (value: string | undefined) => value?.trim() ?? '';
const normalizedCnpj = (value: string) => value.replace(/\D/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return json({ error: 'Configuração do servidor incompleta' }, 500);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  // Honeypot: accept silently so automated abuse gets no useful signal.
  if (normalized(payload.website)) return json({ accepted: true });

  const clinicName = normalized(payload.clinic_name);
  const rawCnpj = normalized(payload.cnpj);
  const cnpjDigits = normalizedCnpj(rawCnpj);
  const ownerName = normalized(payload.owner_name);
  const ownerEmail = normalized(payload.owner_email).toLowerCase();
  const ownerPhone = normalized(payload.owner_phone);

  if (clinicName.length < 2 || clinicName.length > 160) return json({ error: 'Nome da clínica inválido' }, 400);
  if (rawCnpj && cnpjDigits.length !== 14) return json({ error: 'CNPJ inválido' }, 400);
  if (ownerName.length < 2 || ownerName.length > 160) return json({ error: 'Nome do responsável inválido' }, 400);
  if (!/^\S+@\S+\.\S+$/.test(ownerEmail) || ownerEmail.length > 254) return json({ error: 'E-mail inválido' }, 400);
  if (ownerPhone.length > 40) return json({ error: 'Telefone inválido' }, 400);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fail quietly for repeated public submissions. This limits queue abuse without
  // storing caller IP addresses or exposing useful anti-abuse signals to bots.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentEmailCount, error: emailCountError } = await admin
    .from('clinic_access_requests')
    .select('id', { count: 'exact', head: true })
    .ilike('owner_email', ownerEmail)
    .gte('created_at', oneDayAgo);
  if (emailCountError) return json({ error: 'Não foi possível registrar a solicitação' }, 500);
  if ((recentEmailCount ?? 0) >= 3) return json({ accepted: true });

  if (cnpjDigits) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentCnpjRows, error: cnpjCountError } = await admin
      .from('clinic_access_requests')
      .select('cnpj')
      .gte('created_at', sevenDaysAgo)
      .not('cnpj', 'is', null)
      .limit(200);
    if (cnpjCountError) return json({ error: 'Não foi possível registrar a solicitação' }, 500);
    const repeatedCnpjCount = (recentCnpjRows ?? []).filter((row) => normalizedCnpj(String(row.cnpj ?? '')) === cnpjDigits).length;
    if (repeatedCnpjCount >= 3) return json({ accepted: true });
  }

  // Pending requests are idempotent by owner email OR normalized CNPJ. Do not
  // require both to match, otherwise trivial formatting/data variations can fill
  // the review queue with duplicates.
  const pendingByEmail = await admin
    .from('clinic_access_requests')
    .select('public_id')
    .eq('status', 'pending')
    .ilike('owner_email', ownerEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingByEmail.error) return json({ error: 'Não foi possível registrar a solicitação' }, 500);
  if (pendingByEmail.data) return json({ accepted: true, request_id: pendingByEmail.data.public_id, duplicate: true });

  if (cnpjDigits) {
    const pendingCnpjRows = await admin
      .from('clinic_access_requests')
      .select('public_id,cnpj')
      .eq('status', 'pending')
      .not('cnpj', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (pendingCnpjRows.error) return json({ error: 'Não foi possível registrar a solicitação' }, 500);
    const duplicateByCnpj = (pendingCnpjRows.data ?? []).find((row) => normalizedCnpj(String(row.cnpj ?? '')) === cnpjDigits);
    if (duplicateByCnpj) return json({ accepted: true, request_id: duplicateByCnpj.public_id, duplicate: true });
  }

  const inserted = await admin
    .from('clinic_access_requests')
    .insert({
      clinic_name: clinicName,
      cnpj: cnpjDigits || null,
      owner_name: ownerName,
      owner_email: ownerEmail,
      owner_phone: ownerPhone || null,
    })
    .select('public_id')
    .single();

  if (inserted.error || !inserted.data) {
    console.error('[request-clinic-access]', inserted.error);
    return json({ error: 'Não foi possível registrar a solicitação' }, 500);
  }

  return json({ accepted: true, request_id: inserted.data.public_id }, 201);
});