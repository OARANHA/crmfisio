import { useCallback, useMemo } from 'react';
import { accessFor } from './permissions';
import type { Access, ModuleKey, User } from './types';
import { useAuth } from './useAuth';

/**
 * Canonical projection of authenticated Supabase identity into the operational
 * clinic user shape used by the product UI.
 */
export function useCurrentClinicUser(): User | null {
  const { user: authUser, profile, tenantAccessState } = useAuth();

  return useMemo<User | null>(() => {
    if (!authUser || !profile || tenantAccessState !== 'active') return null;
    return {
      id: authUser.id,
      nome: profile.nome || authUser.email?.split('@')[0] || 'Usuário',
      email: authUser.email || '',
      role: profile.role,
      registro: profile.registro || '',
      cor: profile.cor || '#cbd5e1',
      ativo: profile.ativo,
    };
  }, [authUser, profile, tenantAccessState]);
}

export function useCurrentUserAccess() {
  const user = useCurrentClinicUser();
  const access = useCallback((module: ModuleKey): Access => accessFor(user?.role, module), [user?.role]);
  const canView = useCallback((module: ModuleKey) => access(module) !== 'none', [access]);
  return { user, access, canView };
}
