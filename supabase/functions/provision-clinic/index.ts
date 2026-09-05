import { createClient, type User } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

type ProvisionPayload = {
  idempotency_key?: string;
  access_request_id?: string;
  clinic?: { name?: string; cnpj?: string };
  owner?: { email?: string; name?: string; temporary_password?: string };
};

const normalized = (value: string | undefined) => value?.trim() ?? '';

async function findProvisioningUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  requestId: string,
): Promise<User | null> {
  for (let page = 1; page <= 20; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listed.error) throw listed.error;
    const match = listed.data.users.find((user) =>
      user.email?.toLowerCase() === email && user.user_metadata?.provisioning_request_id === requestId
    );
    if (match) return match;
    if (listed.data.users.length < 1000) return null;
  }
  throw new Error('Limite de busca de usuários excedido');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

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

  const { data: platformAdmin } = await admin
    .from('platform_admins')
    .select('user_id,ativo')
    .eq('user_id', authData.user.id)
    .eq('ativo', true)
    .maybeSingle();
  if (!platformAdmin) return json({ error: 'Operação restrita à administração da plataforma' }, 403);

  let payload: ProvisionPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const idempotencyKey = normalized(payload.idempotency_key);
  const accessRequestId = normalized(payload.access_request_id);
  const clinicName = normalized(payload.clinic?.name);
  const cnpj = normalized(payload.clinic?.cnpj);
  const ownerEmail = normalized(payload.owner?.email).toLowerCase();
  const ownerName = normalized(payload.owner?.name);
  const temporaryPassword = payload.owner?.temporary_password ?? '';

  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) return json({ error: 'Chave de idempotência inválida' }, 400);
  if (clinicName.length < 2 || clinicName.length > 160) return json({ error: 'Nome da clínica inválido' }, 400);
  if (cnpj && cnpj.replace(/\D/g, '').length !== 14) return json({ error: 'CNPJ inválido' }, 400);
  if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) return json({ error: 'E-mail do proprietário inválido' }, 400);
  if (ownerName.length < 2 || ownerName.length > 160) return json({ error: 'Nome do proprietário inválido' }, 400);
  if (temporaryPassword.length < 10) return json({ error: 'A senha temporária deve ter ao menos 10 caracteres' }, 400);

  let accessRequest: any = null;
  if (accessRequestId) {
    const loaded = await admin.from('clinic_access_requests').select('*').eq('id', accessRequestId).maybeSingle();
    if (loaded.error) return json({ error: 'Não foi possível validar a solicitação de acesso' }, 500);
    accessRequest = loaded.data;
    if (!accessRequest) return json({ error: 'Solicitação de acesso não encontrada' }, 404);
    if (accessRequest.status === 'provisioned' && accessRequest.provisioning_request_id) {
      const existingProvision = await admin.from('clinic_provisioning_requests').select('*').eq('id', accessRequest.provisioning_request_id).maybeSingle();
      if (existingProvision.data?.status === 'completed') {
        return json({ clinic_id: existingProvision.data.clinic_id, owner_user_id: existingProvision.data.owner_user_id, idempotent: true });
      }
    }
    if (accessRequest.status !== 'pending') return json({ error: 'Solicitação não está pendente para aprovação' }, 409);

    const accessCnpj = normalized(accessRequest.cnpj ?? '');
    if (accessRequest.clinic_name.trim() !== clinicName ||
        accessCnpj !== cnpj ||
        accessRequest.owner_email.trim().toLowerCase() !== ownerEmail ||
        accessRequest.owner_name.trim() !== ownerName) {
      return json({ error: 'Dados de aprovação divergem da solicitação original' }, 409);
    }
  }

  const requestValues = {
    idempotency_key: idempotencyKey,
    requested_by: authData.user.id,
    clinic_name: clinicName,
    cnpj: cnpj || null,
    owner_email: ownerEmail,
    owner_name: ownerName,
  };

  let { data: provision, error: requestError } = await admin
    .from('clinic_provisioning_requests')
    .insert(requestValues)
    .select('*')
    .single();

  if (requestError?.code === '23505') {
    const existing = await admin.from('clinic_provisioning_requests').select('*').eq('idempotency_key', idempotencyKey).single();
    provision = existing.data;
    requestError = existing.error;
  }
  if (requestError || !provision) return json({ error: 'Não foi possível registrar o provisionamento' }, 500);

  if (provision.requested_by !== authData.user.id || provision.clinic_name !== clinicName ||
      provision.owner_email !== ownerEmail || provision.owner_name !== ownerName || (provision.cnpj ?? '') !== cnpj) {
    return json({ error: 'Chave de idempotência já utilizada com outros dados' }, 409);
  }
  if (provision.status === 'completed') {
    if (accessRequest) {
      await admin.from('clinic_access_requests').update({
        status: 'provisioned', reviewed_by: authData.user.id, reviewed_at: new Date().toISOString(),
        provisioning_request_id: provision.id, updated_at: new Date().toISOString(),
      }).eq('id', accessRequest.id).eq('status', 'pending');
    }
    return json({ clinic_id: provision.clinic_id, owner_user_id: provision.owner_user_id, idempotent: true });
  }

  let ownerUser: User | null = null;
  let shouldCompensate = false;

  try {
    if (provision.owner_user_id) {
      const existing = await admin.auth.admin.getUserById(provision.owner_user_id);
      ownerUser = existing.data.user;
    }

    if (!ownerUser) {
      const created = await admin.auth.admin.createUser({
        email: ownerEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          nome: ownerName,
          must_change_password: true,
          provisioning_request_id: provision.id,
        },
      });
      if (created.error || !created.data.user) {
        ownerUser = await findProvisioningUser(admin, ownerEmail, provision.id);
        if (!ownerUser) throw created.error ?? new Error('Não foi possível criar o usuário proprietário');
      } else {
        ownerUser = created.data.user;
      }
      shouldCompensate = true;

      const linked = await admin.from('clinic_provisioning_requests').update({
        owner_user_id: ownerUser.id,
        status: 'auth_created',
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq('id', provision.id).select('id').single();
      if (linked.error) throw linked.error;
    }

    const completed = await admin.rpc('complete_clinic_provisioning', {
      p_request_id: provision.id,
      p_owner_user_id: ownerUser.id,
    });
    if (completed.error) throw completed.error;

    const result = Array.isArray(completed.data) ? completed.data[0] : completed.data;

    if (accessRequest) {
      const marked = await admin.from('clinic_access_requests').update({
        status: 'provisioned', review_note: null, reviewed_by: authData.user.id,
        reviewed_at: new Date().toISOString(), provisioning_request_id: provision.id,
        updated_at: new Date().toISOString(),
      }).eq('id', accessRequest.id).eq('status', 'pending').select('id').single();
      if (marked.error) throw marked.error;

      await admin.from('platform_audit_log').insert({
        actor_user_id: authData.user.id,
        action: 'CLINIC_ACCESS_REQUEST_APPROVED',
        target_type: 'clinic_access_request',
        target_id: accessRequest.id,
        entity_type: 'clinic_access_request',
        entity_key: accessRequest.id,
        detail: { provisioning_request_id: provision.id, clinic_id: result?.clinic_id, owner_email: ownerEmail },
      });
    }

    return json({ ...result, idempotent: provision.status === 'auth_created' });
  } catch (error) {
    if (shouldCompensate && ownerUser) await admin.auth.admin.deleteUser(ownerUser.id);
    await admin.from('clinic_provisioning_requests').update({
      status: 'failed',
      owner_user_id: shouldCompensate ? null : provision.owner_user_id,
      error_message: error instanceof Error ? error.message.slice(0, 500) : 'Falha no provisionamento',
      updated_at: new Date().toISOString(),
    }).eq('id', provision.id);
    await admin.from('platform_audit_log').insert({
      actor_user_id: authData.user.id,
      action: 'clinic.provision_failed',
      target_type: 'provisioning_request',
      target_id: provision.id,
      entity_type: 'provisioning_request',
      entity_key: provision.id,
      detail: { owner_email: ownerEmail, access_request_id: accessRequest?.id ?? null, error: error instanceof Error ? error.message.slice(0, 500) : 'Falha desconhecida' },
    });
    console.error('[provision-clinic]', error);
    return json({ error: 'Não foi possível provisionar a clínica com segurança' }, 400);
  }
});