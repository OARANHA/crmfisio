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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return json({ error: 'Administração da plataforma não configurada' }, 503);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sessão ausente' }, 401);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Sessão inválida' }, 401);

  const { data: membership, error: membershipError } = await admin
    .from('platform_admins')
    .select('user_id,ativo')
    .eq('user_id', authData.user.id)
    .eq('ativo', true)
    .maybeSingle();
  if (membershipError || !membership) return json({ error: 'Acesso de plataforma negado' }, 403);

  const { data: clinics, error: clinicsError } = await admin
    .from('clinics')
    .select('id,name,cnpj,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (clinicsError) return json({ error: 'Não foi possível carregar clínicas' }, 500);

  const clinicIds = (clinics ?? []).map((clinic) => clinic.id);
  const [ownersResult, automationResult] = await Promise.all([
    clinicIds.length
      ? admin.from('profiles').select('clinic_id,nome,email,ativo').in('clinic_id', clinicIds).eq('role', 'owner')
      : Promise.resolve({ data: [], error: null }),
    clinicIds.length
      ? admin.from('automation_settings').select('clinic_id,active').in('clinic_id', clinicIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ownersResult.error) return json({ error: 'Não foi possível carregar owners' }, 500);
  if (automationResult.error) return json({ error: 'Não foi possível carregar automações' }, 500);

  const ownersByClinic = new Map((ownersResult.data ?? []).map((owner) => [owner.clinic_id, owner]));
  const automationByClinic = new Map((automationResult.data ?? []).map((settings) => [settings.clinic_id, settings]));

  const rows = (clinics ?? []).map((clinic) => {
    const owner = ownersByClinic.get(clinic.id);
    const automation = automationByClinic.get(clinic.id);
    return {
      id: clinic.id,
      name: clinic.name,
      cnpj: clinic.cnpj,
      createdAt: clinic.created_at,
      owner: owner ? { name: owner.nome, email: owner.email, active: owner.ativo } : null,
      automationActive: automation?.active === true,
    };
  });

  const summary = {
    clinics: rows.length,
    activeOwners: rows.filter((row) => row.owner?.active).length,
    automationEnabled: rows.filter((row) => row.automationActive).length,
    automationPaused: rows.filter((row) => !row.automationActive).length,
  };

  return json({ summary, clinics: rows });
});
