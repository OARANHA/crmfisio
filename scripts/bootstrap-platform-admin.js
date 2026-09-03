#!/usr/bin/env node

/**
 * Bootstrap único da administração da plataforma.
 * O usuário deve existir previamente no Supabase Auth. Este script não cria
 * clínicas, profiles ou usuários e nunca deve ser executado no browser.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();

if (!url || !serviceRole || !email) {
  console.error('Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e PLATFORM_ADMIN_EMAIL.');
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let selectedUser = null;
for (let page = 1; page <= 20 && !selectedUser; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  selectedUser = data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 1000) break;
}

if (!selectedUser) {
  console.error(`Usuário Auth não encontrado: ${email}`);
  process.exit(1);
}

const { error } = await admin.from('platform_admins').upsert({
  user_id: selectedUser.id,
  ativo: true,
  updated_at: new Date().toISOString(),
}, { onConflict: 'user_id' });

if (error) throw error;
console.log(`Platform admin ativado: ${email} (${selectedUser.id})`);
