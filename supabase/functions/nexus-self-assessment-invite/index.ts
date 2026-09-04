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

const SUPPORTED: Record<string, { ruleVersion: string; label: string }> = {
  phq9: { ruleVersion: 'nexus-2026-09-03', label: 'PHQ-9' },
  gad7: { ruleVersion: 'nexus-2026-09-03', label: 'GAD-7' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const publicAppUrl = (Deno.env.get('MEDICSPRO_PUBLIC_APP_URL') ?? '').replace(/\/$/, '');

  if (!supabaseUrl || !serviceRole || !anonKey || !publicAppUrl) {
    return json({ error: 'Convite Nexus não configurado no servidor' }, 503);
  }
  if (!/^https:\/\//i.test(publicAppUrl)) {
    return json({ error: 'MEDICSPRO_PUBLIC_APP_URL inválida' }, 503);
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sessão ausente' }, 401);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Sessão inválida' }, 401);

  const body = await req.json().catch(() => ({}));
  const patientId = String(body?.patientId ?? '');
  const scaleKey = String(body?.scaleKey ?? '').trim();
  const appointmentId = body?.appointmentId ? String(body.appointmentId) : null;
  const expiresHours = Math.max(1, Math.min(Number(body?.expiresHours) || 48, 168));
  const supported = SUPPORTED[scaleKey];

  if (!patientId || !supported) {
    return json({ error: 'Paciente ou instrumento não suportado' }, 400);
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,clinic_id,nome,ativo')
    .eq('id', authData.user.id)
    .single();
  if (profileError || !profile?.ativo || !profile.clinic_id) {
    return json({ error: 'Perfil profissional inválido' }, 403);
  }

  const { data: patient, error: patientError } = await admin
    .from('patients')
    .select('id,clinic_id,nome,telefone,opt_in_whats,deleted_at,anonimizado')
    .eq('id', patientId)
    .eq('clinic_id', profile.clinic_id)
    .single();
  if (patientError || !patient || patient.deleted_at || patient.anonimizado) {
    return json({ error: 'Paciente inválido para esta clínica' }, 404);
  }
  if (!patient.opt_in_whats) return json({ error: 'Paciente sem opt-in para WhatsApp' }, 409);
  if (!String(patient.telefone ?? '').replace(/\D/g, '')) return json({ error: 'Paciente sem telefone válido' }, 409);

  const { data: inviteData, error: inviteError } = await userClient.rpc('create_nexus_self_assessment_invite', {
    p_patient_id: patientId,
    p_scale_key: scaleKey,
    p_rule_version: supported.ruleVersion,
    p_appointment_id: appointmentId,
    p_expires_hours: expiresHours,
  });
  if (inviteError) {
    console.error('[nexus-self-assessment-invite] create:', inviteError);
    return json({ error: inviteError.message || 'Não foi possível criar convite' }, 403);
  }

  const invite = Array.isArray(inviteData) ? inviteData[0] : inviteData;
  if (!invite?.invite_id || !invite?.token) return json({ error: 'Convite Nexus não retornado' }, 500);

  const link = `${publicAppUrl}/autoavaliacao/${encodeURIComponent(invite.token)}`;
  const firstName = String(patient.nome ?? '').trim().split(/\s+/)[0] || 'Olá';
  const message = `${firstName}, seu profissional enviou a autoavaliação ${supported.label}.\n\nAcesse o link seguro abaixo para responder:\n${link}\n\nO link é individual e expira automaticamente.`;

  const { data: waLog, error: queueError } = await admin
    .from('wa_logs')
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      appointment_id: appointmentId,
      self_assessment_invite_id: invite.invite_id,
      template: 'nexus_autoavaliacao',
      mensagem: message,
      enviado_em: new Date().toISOString(),
      status: 'fila',
      scheduled_for: new Date().toISOString(),
      created_by: authData.user.id,
    })
    .select('id,status,scheduled_for')
    .single();

  if (queueError || !waLog) {
    console.error('[nexus-self-assessment-invite] queue:', queueError);
    await admin
      .from('nexus_self_assessment_invites')
      .update({ status: 'revoked', revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', invite.invite_id)
      .is('submitted_at', null);
    return json({ error: 'Convite criado, mas não foi possível enfileirar o WhatsApp' }, 500);
  }

  return json({
    inviteId: invite.invite_id,
    waLogId: waLog.id,
    scaleKey,
    ruleVersion: supported.ruleVersion,
    expiresAt: invite.expires_at,
    status: waLog.status,
  });
});
