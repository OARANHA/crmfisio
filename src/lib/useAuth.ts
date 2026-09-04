/**
 * Hook de autenticação com Supabase Auth.
 * Mantém a identidade autenticada separada do vínculo com clínica para que
 * platform_admin possa operar o SaaS sem receber acesso implícito a tenants.
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
  principal: User | null;
  session: Session | null;
  profile: Profile | null;
  platformAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  canAccess: (module: ModuleKey) => boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [principal, setPrincipal] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .eq('ativo', true)
        .single();

      if (error || !data) return null;
      return data as Profile;
    } catch (e) {
      console.error('[useAuth] Erro ao buscar perfil:', e);
      return null;
    }
  }, []);

  const fetchPlatformAdmin = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('platform-admin-session', { body: {} });
      if (error) return false;
      return data?.platformAdmin === true;
    } catch (e) {
      console.error('[useAuth] Erro ao validar platform_admin:', e);
      return false;
    }
  }, []);

  const hydrateIdentity = useCallback(async (authUser: User | null) => {
    setPrincipal(authUser);
    if (!authUser) {
      setUser(null);
      setProfile(null);
      setPlatformAdmin(false);
      return;
    }

    const [prof, isPlatformAdmin] = await Promise.all([
      fetchProfile(authUser.id),
      fetchPlatformAdmin(),
    ]);

    setPlatformAdmin(isPlatformAdmin);
    setProfile(prof);
    setUser(prof && isRole(prof.role) ? { ...authUser, profile: prof, role: prof.role } : null);
  }, [fetchPlatformAdmin, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(currentSession);
        await hydrateIdentity(currentSession?.user ?? null);
      } catch (e) {
        console.error('[useAuth] Erro na inicialização:', e);
        if (mounted) {
          setPrincipal(null);
          setUser(null);
          setProfile(null);
          setPlatformAdmin(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      await hydrateIdentity(newSession?.user ?? null);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateIdentity]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Sessão não criada');

      const [prof, isPlatformAdmin] = await Promise.all([
        fetchProfile(data.user.id),
        fetchPlatformAdmin(),
      ]);

      if ((!prof || !isRole(prof.role)) && !isPlatformAdmin) {
        await supabase.auth.signOut();
        throw new Error('Usuário sem perfil ativo ou acesso à plataforma');
      }

      setPrincipal(data.user);
      setPlatformAdmin(isPlatformAdmin);
      setProfile(prof);
      setUser(prof && isRole(prof.role) ? { ...data.user, profile: prof, role: prof.role } : null);
      return { error: null };
    } catch (e) {
      console.error('[signIn] Erro:', e);
      return { error: e instanceof Error ? e : new Error('Erro ao fazer login') };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setPrincipal(null);
    setUser(null);
    setSession(null);
    setProfile(null);
    setPlatformAdmin(false);
  };

  const canAccess = useCallback((module: ModuleKey): boolean => {
    if (!user?.role) return false;
    return accessFor(user.role, module) !== 'none';
  }, [user?.role]);

  return {
    user,
    principal,
    session,
    profile,
    platformAdmin,
    loading,
    signIn,
    signOut,
    canAccess,
  };
}

export type { AuthUser, Profile, Role };
