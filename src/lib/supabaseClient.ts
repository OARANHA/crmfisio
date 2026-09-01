import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados');
}

// O arquivo database.types.ts atual foi escrito manualmente e não contém toda a
// estrutura de metadados esperada pelas versões recentes do supabase-js. Tipar o
// client com ele fazia as operações de tabela inferirem `never`, mascarando erros
// reais no typecheck. Mantemos o client sem generic por enquanto e usamos os tipos
// de domínio/repository explicitamente. A próxima regeneração deve vir do schema
// real (`supabase gen types`) antes de reativar o generic Database aqui.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:8000',
  supabaseAnonKey || 'dummy-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'x-application-name': 'medicspro-crmfisio',
      },
    },
  }
);

export type { User, Session, AuthResponse } from '@supabase/supabase-js';
