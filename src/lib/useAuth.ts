/**
 * Hook de autenticação com Supabase Auth
 * Substitui o login mockado por autenticação real JWT
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase, type User, type Session } from './supabaseClient';
import type { Database } from './database.types';
import type { ModuleKey, Role } from './types';
import { accessFor, isRole } from './permissions';

type Profile = Database['public']['Tables']['profiles']['Row'];

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
  canAccess: (module: ModuleKey) => boolean;
}

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
        .eq('ativo', true)
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
            setUser(prof && isRole(prof.role) ? { ...session.user, profile: prof, role: prof.role } : null);
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
        setUser(prof && isRole(prof.role) ? { ...newSession.user, profile: prof, role: prof.role } : null);
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
        if (!prof || !isRole(prof.role)) {
          await supabase.auth.signOut();
          throw new Error('Usuário sem perfil ativo e válido');
        }
        setUser({ ...data.user, profile: prof, role: prof.role });
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
  const canAccess = useCallback((module: ModuleKey): boolean => {
    if (!user?.role) return false;
    return accessFor(user.role, module) !== 'none';
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
