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

type TeamPayload = {
  action: 'create' | 'update' | 'set_active' | 'reset_password';
  id?: string;
  email?: string;
  password?: string;
  nome?: string;
  role?: 'admin' | 'fisio' | 'recep' | 'financeiro';
  telefone?: string;
  professional_type?: string;
  council_type?: string;
  council_state?: string;
  registro?: string;
  especialidade?: string;
  cor?: string;
  ativo?: boolean;
  unit_ids?: string[];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return json({ error: 'Configuração do servidor incompleta' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sessão ausente' }, 401);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Sessão inválida' }, 401);

  const { data: caller, error: callerError } = await admin
    .from('profiles')
    .select('id,clinic_id,role,ativo')
    .eq('id', authData.user.id)
    .single();

  if (callerError || !caller?.ativo || !['owner', 'admin'].includes(caller.role)) {
    return json({ error: 'Apenas administradores podem gerenciar a equipe' }, 403);
  }

  let payload: TeamPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const syncUnits = async (profileId: string, unitIds: string[] | undefined) => {
    if (!unitIds) return;
    const uniqueIds = [...new Set(unitIds.filter(Boolean))];
    const { error: deleteError } = await admin.from('profile_units').delete().eq('profile_id', profileId).eq('clinic_id', caller.clinic_id);
    if (deleteError) throw deleteError;
    if (uniqueIds.length === 0) return;

    const { data: validUnits, error: unitsError } = await admin
      .from('units')
      .select('id')
      .eq('clinic_id', caller.clinic_id)
      .eq('ativo', true)
      .in('id', uniqueIds);
    if (unitsError) throw unitsError;
    if ((validUnits ?? []).length !== uniqueIds.length) throw new Error('Uma ou mais unidades são inválidas para esta clínica');

    const { error: insertError } = await admin.from('profile_units').insert(uniqueIds.map((unitId) => ({
      profile_id: profileId,
      unit_id: unitId,
      clinic_id: caller.clinic_id,
    })));
    if (insertError) throw insertError;
  };

  try {
    if (payload.action === 'create') {
      if (!payload.email || !payload.password || !payload.nome || !payload.role) {
        return json({ error: 'Nome, e-mail, perfil e senha inicial são obrigatórios' }, 400);
      }
      if (payload.password.length < 8) return json({ error: 'A senha inicial deve ter ao menos 8 caracteres' }, 400);
      if (!['admin', 'fisio', 'recep', 'financeiro'].includes(payload.role)) return json({ error: 'Perfil de acesso inválido' }, 400);

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        email_confirm: true,
        user_metadata: { nome: payload.nome.trim(), must_change_password: true },
      });
      if (createError || !created.user) throw createError ?? new Error('Não foi possível criar o usuário');

      const profile = {
        id: created.user.id,
        clinic_id: caller.clinic_id,
        email: payload.email.trim().toLowerCase(),
        nome: payload.nome.trim(),
        role: payload.role,
        registro: payload.registro?.trim() || null,
        cor: payload.cor || '#9ab8c9',
        ativo: true,
        telefone: payload.telefone?.trim() || null,
        professional_type: payload.professional_type?.trim() || null,
        council_type: payload.council_type?.trim() || null,
        council_state: payload.council_state?.trim().toUpperCase() || null,
        especialidade: payload.especialidade?.trim() || null,
        must_change_password: true,
      };

      const { error: profileError } = await admin.from('profiles').insert(profile);
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }
      await syncUnits(created.user.id, payload.unit_ids ?? []);
      return json({ id: created.user.id, email: profile.email, created: true });
    }

    if (!payload.id) return json({ error: 'Usuário não informado' }, 400);

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id,clinic_id,role')
      .eq('id', payload.id)
      .eq('clinic_id', caller.clinic_id)
      .single();
    if (targetError || !target) return json({ error: 'Usuário não pertence à clínica' }, 404);
    if (target.id === caller.id && payload.action === 'set_active' && payload.ativo === false) {
      return json({ error: 'Você não pode desativar o próprio usuário' }, 400);
    }

    if (payload.action === 'update') {
      const updates: Record<string, unknown> = {};
      if (payload.nome !== undefined) updates.nome = payload.nome.trim();
      if (payload.role !== undefined) {
        if (!['admin', 'fisio', 'recep', 'financeiro'].includes(payload.role)) return json({ error: 'Perfil de acesso inválido' }, 400);
        updates.role = payload.role;
      }
      if (payload.telefone !== undefined) updates.telefone = payload.telefone.trim() || null;
      if (payload.professional_type !== undefined) updates.professional_type = payload.professional_type.trim() || null;
      if (payload.council_type !== undefined) updates.council_type = payload.council_type.trim() || null;
      if (payload.council_state !== undefined) updates.council_state = payload.council_state.trim().toUpperCase() || null;
      if (payload.registro !== undefined) updates.registro = payload.registro.trim() || null;
      if (payload.especialidade !== undefined) updates.especialidade = payload.especialidade.trim() || null;
      if (payload.cor !== undefined) updates.cor = payload.cor;

      if (Object.keys(updates).length > 0) {
        const { error } = await admin.from('profiles').update(updates).eq('id', target.id).eq('clinic_id', caller.clinic_id);
        if (error) throw error;
      }
      await syncUnits(target.id, payload.unit_ids);
      return json({ id: target.id, updated: true });
    }

    if (payload.action === 'set_active') {
      const { error } = await admin.from('profiles').update({ ativo: !!payload.ativo }).eq('id', target.id).eq('clinic_id', caller.clinic_id);
      if (error) throw error;
      if (!payload.ativo) await admin.auth.admin.signOut(target.id, 'global').catch(() => undefined);
      return json({ id: target.id, ativo: !!payload.ativo });
    }

    if (payload.action === 'reset_password') {
      if (!payload.password || payload.password.length < 8) return json({ error: 'A nova senha deve ter ao menos 8 caracteres' }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.id, {
        password: payload.password,
        user_metadata: { must_change_password: true },
      });
      if (error) throw error;
      await admin.from('profiles').update({ must_change_password: true }).eq('id', target.id).eq('clinic_id', caller.clinic_id);
      return json({ id: target.id, password_reset: true });
    }

    return json({ error: 'Ação inválida' }, 400);
  } catch (error) {
    console.error('[admin-team]', error);
    return json({ error: error instanceof Error ? error.message : 'Falha ao gerenciar equipe' }, 400);
  }
});
