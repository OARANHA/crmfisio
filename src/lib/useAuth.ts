/**
 * Hook de autenticação com Supabase Auth
 * Substitui o login mockado por autenticação real JWT
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase, type User, type Session } from './supabaseClient';
import type { Database } from './database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Role = Profile['role'];

interface AuthUser extends User {
  profile?: Profile;
  role: Role;
}

interface UseAuthReturn {
  user: AuthUser | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  canAccess: (module: string) => boolean;
}

// Matriz RBAC espelhada do store.tsx
const ACCESS_MATRIX: Record<Role, Record<string, 'full' | 'read' | 'none'>> = {
  owner: { dashboard: 'full', agenda: 'full', pacientes: 'full', clinico: 'full', financeiro: 'full', crm: 'full', mensagens: 'full', relatorios: 'full', config: 'full' },
  admin: { dashboard: 'full', agenda: 'full', pacientes: 'full', clinico: 'read', financeiro: 'full', crm: 'full', mensagens: 'full', relatorios: 'full', config: 'full' },
  fisio: { dashboard: 'read', agenda: 'full', pacientes: 'full', clinico: 'full', financeiro: 'read', crm: 'read', mensagens: 'read', relatorios: 'read', config: 'none' },
  recep: { dashboard: 'none', agenda: 'full', pacientes: 'full', clinico: 'none', financeiro: 'full', crm: 'full', mensagens: 'full', relatorios: 'none', config: 'none' },
  financeiro: { dashboard: 'read', agenda: 'read', pacientes: 'read', clinico: 'none', financeiro: 'full', crm: 'read', mensagens: 'read', relatorios: 'read', config: 'none' },
};

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Buscar perfil do usuário no banco
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.warn('[useAuth] Perfil não encontrado:', error);
        return null;
      }

      return data as Profile;
    } catch (e) {
      console.error('[useAuth] Erro ao buscar perfil:', e);
      return null;
    }
  }, []);

  // Carregar sessão inicial
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        
        if (session?.user) {
          const prof = await fetchProfile(session.user.id);
          if (mounted) {
            setUser({
              ...session.user,
              profile: prof || undefined,
              role: (prof?.role as Role) || 'fisio',
            });
            setProfile(prof);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (e) {
        console.error('[useAuth] Erro na inicialização:', e);
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      
      setSession(newSession);
      
      if (newSession?.user) {
        const prof = await fetchProfile(newSession.user.id);
        setUser({
          ...newSession.user,
          profile: prof || undefined,
          role: (prof?.role as Role) || 'fisio',
        });
        setProfile(prof);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Login com email/senha
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const prof = await fetchProfile(data.user.id);
        setUser({
          ...data.user,
          profile: prof || undefined,
          role: (prof?.role as Role) || 'fisio',
        });
        setProfile(prof);
      }

      return { error: null };
    } catch (e) {
      console.error('[signIn] Erro:', e);
      return { error: e instanceof Error ? e : new Error('Erro ao fazer login') };
    }
  };

  // Logout
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  // Verificar acesso por módulo
  const canAccess = useCallback((module: string): boolean => {
    if (!user?.role) return false;
    const access = ACCESS_MATRIX[user.role]?.[module];
    return access !== 'none';
  }, [user?.role]);

  return {
    user,
    session,
    profile,
    loading,
    signIn,
    signOut,
    canAccess,
  };
}

export type { AuthUser, Profile, Role };
