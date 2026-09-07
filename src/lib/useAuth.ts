/**
 * Autenticação canônica da aplicação com Supabase Auth.
 *
 * O estado de sessão/perfil é resolvido uma única vez pelo AuthProvider e
 * compartilhado por todos os consumidores. Isso evita múltiplas assinaturas
 * independentes de onAuthStateChange e consultas duplicadas de perfil/tenant.
 */

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase, type User, type Session } from './supabaseClient';
import type { Database } from './database.types';
import type { ModuleKey, Role } from './types';
import { accessFor, isRole } from './permissions';

type Profile = Database['public']['Tables']['profiles']['Row'];
export type TenantAccessState = 'active' | 'suspended' | 'inactive_profile' | 'clinic_unavailable' | 'no_profile' | 'unauthenticated' | 'unknown';

interface AuthUser extends User {
  profile?: Profile;
  role: Role;
}

interface UseAuthReturn {
  user: AuthUser | null;
  session: Session | null;
  profile: Profile | null;
  tenantAccessState: TenantAccessState;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  canAccess: (module: ModuleKey) => boolean;
}

const AuthContext = createContext<UseAuthReturn | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenantAccessState, setTenantAccessState] = useState<TenantAccessState>('unknown');
  const [loading, setLoading] = useState(true);
  const resolutionVersion = useRef(0);
  const actionVersion = useRef(0);
  const sessionUserId = useRef<string | null>(null);

  const fetchTenantAccessState = useCallback(async (): Promise<TenantAccessState> => {
    try {
      const { data, error } = await (supabase as any).rpc('current_tenant_access_state');
      if (error) {
        console.warn('[useAuth] Estado de acesso da clínica indisponível:', error);
        return 'unknown';
      }
      const value = String(data ?? 'unknown') as TenantAccessState;
      return ['active', 'suspended', 'inactive_profile', 'clinic_unavailable', 'no_profile', 'unauthenticated'].includes(value)
        ? value
        : 'unknown';
    } catch (e) {
      console.error('[useAuth] Erro ao resolver estado da clínica:', e);
      return 'unknown';
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any).rpc('current_active_profile');
      if (error || !data) {
        console.warn('[useAuth] Perfil ativo não encontrado:', error);
        return null;
      }
      return data as Profile;
    } catch (e) {
      console.error('[useAuth] Erro ao buscar perfil ativo:', e);
      return null;
    }
  }, []);

  const resolveSessionUser = useCallback(async (nextSession: Session | null) => {
    const request = ++resolutionVersion.current;
    const nextUserId = nextSession?.user.id ?? null;
    if (sessionUserId.current !== nextUserId) {
      setUser(null);
      setProfile(null);
      setTenantAccessState(nextUserId ? 'unknown' : 'unauthenticated');
    }
    sessionUserId.current = nextUserId;
    setSession(nextSession);
    if (!nextSession?.user) {
      setTenantAccessState('unauthenticated');
      setUser(null);
      setProfile(null);
      return null;
    }

    const accessState = await fetchTenantAccessState();
    if (request !== resolutionVersion.current) return null;
    if (accessState !== 'active') {
      setTenantAccessState(accessState);
      setUser(null);
      setProfile(null);
      return { request, accessState, profile: null };
    }

    const prof = await fetchProfile();
    if (request !== resolutionVersion.current) return null;
    const validProfile = prof && prof.id === nextSession.user.id && isRole(prof.role) ? prof : null;
    setTenantAccessState(accessState);
    setUser(validProfile ? { ...nextSession.user, profile: validProfile, role: validProfile.role } : null);
    setProfile(validProfile);
    return { request, accessState, profile: validProfile };
  }, [fetchProfile, fetchTenantAccessState]);

  useEffect(() => {
    let mounted = true;
    const initialVersion = resolutionVersion.current;

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted || initialVersion !== resolutionVersion.current) return;
        await resolveSessionUser(initialSession);
      } catch (e) {
        console.error('[useAuth] Erro na inicialização:', e);
        if (mounted && initialVersion === resolutionVersion.current) {
          setUser(null);
          setProfile(null);
          setTenantAccessState('unknown');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      if (_event === 'SIGNED_OUT') actionVersion.current += 1;
      await resolveSessionUser(newSession);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      resolutionVersion.current += 1;
      actionVersion.current += 1;
      subscription.unsubscribe();
    };
  }, [resolveSessionUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const action = ++actionVersion.current;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (action !== actionVersion.current) return { error: null };
      if (error) throw error;

      if (data.user) {
        const resolved = await resolveSessionUser(data.session);
        if (!resolved || resolved.request !== resolutionVersion.current || action !== actionVersion.current) return { error: null };
        if (resolved.accessState === 'suspended') return { error: null };
        if (resolved.accessState !== 'active' || !resolved.profile || !isRole(resolved.profile.role)) {
          await supabase.auth.signOut();
          throw new Error('Usuário sem perfil ativo e válido');
        }
      }
      return { error: null };
    } catch (e) {
      console.error('[signIn] Erro:', e);
      return { error: e instanceof Error ? e : new Error('Erro ao fazer login') };
    }
  }, [resolveSessionUser]);

  const signOut = useCallback(async () => {
    actionVersion.current += 1;
    await resolveSessionUser(null);
    await supabase.auth.signOut();
  }, [resolveSessionUser]);

  const canAccess = useCallback((module: ModuleKey): boolean => {
    if (!user?.role) return false;
    return accessFor(user.role, module) !== 'none';
  }, [user?.role]);

  const value = useMemo<UseAuthReturn>(() => ({
    user,
    session,
    profile,
    tenantAccessState,
    loading,
    signIn,
    signOut,
    canAccess,
  }), [user, session, profile, tenantAccessState, loading, signIn, signOut, canAccess]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): UseAuthReturn {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}

export type { AuthUser, Profile, Role };
