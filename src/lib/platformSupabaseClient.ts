import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Platform Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados');
}

/**
 * Control-plane Supabase client.
 *
 * Platform Admin intentionally uses a dedicated auth storage key so signing in
 * to a clinic account in the same browser/origin does not overwrite the
 * platform session (and vice-versa).
 */
export const platformSupabase = createClient(
  supabaseUrl || 'http://localhost:8000',
  supabaseAnonKey || 'dummy-key',
  {
    auth: {
      storageKey: 'medicspro-platform-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-application-name': 'medicspro-platform-admin',
      },
    },
  },
);
