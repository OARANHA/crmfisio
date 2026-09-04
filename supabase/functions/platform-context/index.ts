import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return json({ error: 'Configuração do servidor incompleta' }, 500);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sessão ausente' }, 401);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Sessão inválida' }, 401);

  const { data: platformAdmin, error: platformAdminError } = await admin
    .from('platform_admins')
    .select('user_id,ativo')
    .eq('user_id', authData.user.id)
    .eq('ativo', true)
    .maybeSingle();

  if (platformAdminError) {
    console.error('[platform-context] platform admin:', platformAdminError);
    return json({ error: 'Não foi possível validar a administração da plataforma' }, 500);
  }
  if (!platformAdmin) return json({ error: 'Operação restrita à administração da plataforma' }, 403);

  const [clinicsResult, requestsResult, auditResult] = await Promise.all([
    admin
      .from('clinics')
      .select('id,name,cnpj,created_at,deleted_at')
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .from('clinic_provisioning_requests')
      .select('id,clinic_name,cnpj,owner_email,owner_name,status,error_message,clinic_id,created_at,completed_at')
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('platform_audit_log')
      .select('id,action,target_type,target_id,detail,created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (clinicsResult.error || requestsResult.error || auditResult.error) {
    console.error('[platform-context] load:', {
      clinics: clinicsResult.error,
      requests: requestsResult.error,
      audit: auditResult.error,
    });
    return json({ error: 'Não foi possível carregar o console da plataforma' }, 500);
  }

  const clinics = clinicsResult.data ?? [];
  const activeClinics = clinics.filter((clinic) => !clinic.deleted_at);
  const requests = requestsResult.data ?? [];

  return json({
    actor: {
      id: authData.user.id,
      email: authData.user.email ?? '',
    },
    summary: {
      active_clinics: activeClinics.length,
      total_clinics: clinics.length,
      pending_provisioning: requests.filter((request) => request.status !== 'completed').length,
      failed_provisioning: requests.filter((request) => request.status === 'failed').length,
    },
    clinics,
    provisioning_requests: requests,
    audit: auditResult.data ?? [],
  });
});
