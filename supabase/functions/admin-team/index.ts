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
  action: 'create' | 'update' | 'set_active' | 'reset_password' | 'change_own_password';
  id?: string;
  email?: string;
  password?: string;
  nome?: string;
  role?: 'admin' | 'professional' | 'recep' | 'financeiro';
  telefone?: string;
  professional_type?: string;
  council_type?: string;
  council_state?: string;
  registro?: string;
  especialidade?: string;
  cor?: string;
  ativo?: boolean;
  unit_ids?: string[];
  capability_keys?: string[];
};

const allowedManagedRoles = new Set(['admin', 'professional', 'recep', 'financeiro']);
const managedClinicalCapabilities = [
  'clinical.attend',
  'clinical.timeline.read',
  'clinical.evolution.write',
  'clinical.assessment.apply',
  'clinical.body_map',
  'clinical.documents',
] as const;
const managedClinicalCapabilitySet = new Set<string>(managedClinicalCapabilities);

const normalizeCapabilityKeys = (value: unknown): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !managedClinicalCapabilitySet.has(item))) {
    throw new Error('Permissões clínicas inválidas');
  }
  return [...new Set(value)];
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
    .select('id,clinic_id,role,ativo,must_change_password')
    .eq('id', authData.user.id)
    .single();

  if (callerError || !caller?.ativo) return json({ error: 'Usuário sem perfil ativo' }, 403);

  const { data: callerClinic, error: callerClinicError } = await admin
    .from('clinics')
    .select('id,lifecycle_status,deleted_at')
    .eq('id', caller.clinic_id)
    .single();

  if (callerClinicError || !callerClinic || callerClinic.deleted_at || callerClinic.lifecycle_status !== 'active') {
    return json({ error: 'Clínica suspensa ou indisponível', code: 'clinic_not_active' }, 403);
  }

  let payload: TeamPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  if (caller.must_change_password && payload.action !== 'change_own_password') {
    return json({ error: 'Troca de senha obrigatória antes de continuar', code: 'password_change_required' }, 403);
  }

  const syncClinicalCapabilities = async (profileId: string, requested: unknown) => {
    if (requested === undefined) return;
    const selected = normalizeCapabilityKeys(requested);
    const rows = managedClinicalCapabilities.map((capabilityKey) => ({
      clinic_id: caller.clinic_id,
      professional_id: profileId,
      capability_key: capabilityKey,
      granted: selected.includes(capabilityKey),
    }));
    const { error } = await admin
      .from('professional_capabilities')
      .upsert(rows, { onConflict: 'clinic_id,professional_id,capability_key' });
    if (error) throw error;
  };

  try {
    if (payload.action === 'change_own_password') {
      if (!payload.password || payload.password.length < 8) return json({ error: 'A nova senha deve ter ao menos 8 caracteres' }, 400);

      const currentMetadata = authData.user.user_metadata ?? {};
      const { error: passwordError } = await admin.auth.admin.updateUserById(caller.id, {
        password: payload.password,
        user_metadata: { ...currentMetadata, must_change_password: false },
      });
      if (passwordError) throw passwordError;

      const { error: profileError } = await admin
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', caller.id)
        .eq('clinic_id', caller.clinic_id);
      if (profileError) throw profileError;
      return json({ id: caller.id, password_changed: true, must_change_password: false });
    }

    if (!['owner', 'admin'].includes(caller.role)) return json({ error: 'Apenas administradores podem gerenciar a equipe' }, 403);

    if (payload.capability_keys !== undefined) normalizeCapabilityKeys(payload.capability_keys);

    if (payload.action === 'create') {
      if (!payload.email || !payload.password || !payload.nome || !payload.role) {
        return json({ error: 'Nome, e-mail, perfil e senha inicial são obrigatórios' }, 400);
      }
      if (payload.password.length < 8) return json({ error: 'A senha inicial deve ter ao menos 8 caracteres' }, 400);
      if (!allowedManagedRoles.has(payload.role)) return json({ error: 'Perfil de acesso inválido' }, 400);
      if (payload.unit_ids && !Array.isArray(payload.unit_ids)) return json({ error: 'Unidades inválidas' }, 400);

      const email = payload.email.trim().toLowerCase();
      const nome = payload.nome.trim();
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { nome, must_change_password: true },
      });
      if (createError || !created.user) throw createError ?? new Error('Não foi possível criar o usuário');

      const { error: profileError } = await admin.rpc('admin_create_team_profile_atomic', {
        p_profile_id: created.user.id,
        p_clinic_id: caller.clinic_id,
        p_email: email,
        p_nome: nome,
        p_role: payload.role,
        p_registro: payload.registro?.trim() || null,
        p_cor: payload.cor || '#9ab8c9',
        p_ativo: true,
        p_telefone: payload.telefone?.trim() || null,
        p_professional_type: payload.professional_type?.trim() || null,
        p_council_type: payload.council_type?.trim() || null,
        p_council_state: payload.council_state?.trim().toUpperCase() || null,
        p_especialidade: payload.especialidade?.trim() || null,
        p_must_change_password: true,
        p_unit_ids: payload.unit_ids ?? [],
      });

      if (profileError) {
        const { error: compensationError } = await admin.auth.admin.deleteUser(created.user.id);
        if (compensationError) {
          console.error('[admin-team] create compensation failed', { userId: created.user.id, profileError, compensationError });
          throw new Error('Falha ao criar perfil e ao compensar usuário de autenticação; intervenção administrativa necessária.');
        }
        throw profileError;
      }

      try {
        await syncClinicalCapabilities(created.user.id, payload.capability_keys);
      } catch (capabilityError) {
        await admin.from('profiles').delete().eq('id', created.user.id).eq('clinic_id', caller.clinic_id);
        await admin.auth.admin.deleteUser(created.user.id);
        throw capabilityError;
      }

      return json({ id: created.user.id, email, created: true });
    }

    if (!payload.id) return json({ error: 'Usuário não informado' }, 400);

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id,clinic_id,role,nome,telefone,professional_type,council_type,council_state,registro,especialidade,cor')
      .eq('id', payload.id)
      .eq('clinic_id', caller.clinic_id)
      .single();
    if (targetError || !target) return json({ error: 'Usuário não pertence à clínica' }, 404);
    if (target.role === 'owner' && target.id !== caller.id) return json({ error: 'O proprietário não pode ser alterado por outro usuário' }, 403);
    if (target.id === caller.id && payload.action === 'set_active' && payload.ativo === false) return json({ error: 'Você não pode desativar o próprio usuário' }, 400);

    if (payload.action === 'update') {
      if (payload.unit_ids && !Array.isArray(payload.unit_ids)) return json({ error: 'Unidades inválidas' }, 400);

      if (target.role === 'owner') {
        if (payload.role !== undefined || payload.unit_ids !== undefined) {
          return json({ error: 'O papel proprietário e suas unidades não podem ser alterados por este fluxo' }, 403);
        }
        const updates: Record<string, unknown> = {};
        if (payload.nome !== undefined) updates.nome = payload.nome.trim();
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
        await syncClinicalCapabilities(target.id, payload.capability_keys);
        return json({ id: target.id, updated: true });
      }

      const nextRole = payload.role ?? target.role;
      if (!allowedManagedRoles.has(nextRole)) return json({ error: 'Perfil de acesso inválido' }, 400);
      const nextName = payload.nome !== undefined ? payload.nome.trim() : target.nome;
      if (!nextName) return json({ error: 'Nome é obrigatório' }, 400);

      const { error } = await admin.rpc('admin_update_team_profile_atomic', {
        p_profile_id: target.id,
        p_clinic_id: caller.clinic_id,
        p_nome: nextName,
        p_role: nextRole,
        p_registro: payload.registro !== undefined ? payload.registro.trim() || null : target.registro,
        p_cor: payload.cor !== undefined ? payload.cor : target.cor,
        p_telefone: payload.telefone !== undefined ? payload.telefone.trim() || null : target.telefone,
        p_professional_type: payload.professional_type !== undefined ? payload.professional_type.trim() || null : target.professional_type,
        p_council_type: payload.council_type !== undefined ? payload.council_type.trim() || null : target.council_type,
        p_council_state: payload.council_state !== undefined ? payload.council_state.trim().toUpperCase() || null : target.council_state,
        p_especialidade: payload.especialidade !== undefined ? payload.especialidade.trim() || null : target.especialidade,
        p_unit_ids: payload.unit_ids ?? null,
      });
      if (error) throw error;
      await syncClinicalCapabilities(target.id, payload.capability_keys);
      return json({ id: target.id, updated: true });
    }

    if (payload.action === 'set_active') {
      const { error } = await admin.from('profiles').update({ ativo: !!payload.ativo }).eq('id', target.id).eq('clinic_id', caller.clinic_id);
      if (error) throw error;
      return json({ id: target.id, ativo: !!payload.ativo });
    }

    if (payload.action === 'reset_password') {
      if (!payload.password || payload.password.length < 8) return json({ error: 'A nova senha deve ter ao menos 8 caracteres' }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.id, { password: payload.password, user_metadata: { must_change_password: true } });
      if (error) throw error;
      const { error: profileError } = await admin.from('profiles').update({ must_change_password: true }).eq('id', target.id).eq('clinic_id', caller.clinic_id);
      if (profileError) throw profileError;
      return json({ id: target.id, password_reset: true });
    }

    return json({ error: 'Ação inválida' }, 400);
  } catch (error) {
    console.error('[admin-team]', error);
    return json({ error: error instanceof Error ? error.message : 'Falha ao gerenciar equipe' }, 400);
  }
});
