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
  const cnpj = normalized(payload.cnpj);
  const ownerName = normalized(payload.owner_name);
  const ownerEmail = normalized(payload.owner_email).toLowerCase();
  const ownerPhone = normalized(payload.owner_phone);

  if (clinicName.length < 2 || clinicName.length > 160) return json({ error: 'Nome da clínica inválido' }, 400);
  if (cnpj && cnpj.replace(/\D/g, '').length !== 14) return json({ error: 'CNPJ inválido' }, 400);
  if (ownerName.length < 2 || ownerName.length > 160) return json({ error: 'Nome do responsável inválido' }, 400);
  if (!/^\S+@\S+\.\S+$/.test(ownerEmail) || ownerEmail.length > 254) return json({ error: 'E-mail inválido' }, 400);
  if (ownerPhone.length > 40) return json({ error: 'Telefone inválido' }, 400);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let duplicateQuery = admin
    .from('clinic_access_requests')
    .select('public_id')
    .eq('status', 'pending')
    .ilike('owner_email', ownerEmail)
    .limit(1);
  if (cnpj) duplicateQuery = duplicateQuery.eq('cnpj', cnpj);
  const duplicate = await duplicateQuery.maybeSingle();
  if (duplicate.error) return json({ error: 'Não foi possível registrar a solicitação' }, 500);
  if (duplicate.data) return json({ accepted: true, request_id: duplicate.data.public_id, duplicate: true });

  const inserted = await admin
    .from('clinic_access_requests')
    .insert({
      clinic_name: clinicName,
      cnpj: cnpj || null,
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