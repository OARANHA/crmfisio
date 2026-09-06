import { Fragment, type ReactNode } from 'react';
import { useAuth } from './useAuth';

/**
 * All clinic providers and their consumers share one session lifetime.
 * Old loads, mutations and rollbacks retain setters for the unmounted tree;
 * they cannot populate the next clinic's state (including shell and toasts).
 * Token refreshes deliberately do not change this key or discard open forms.
 * This is client state isolation, not a replacement for RLS/RPC authorization.
 */
export function ClinicDataBoundary({ children }: { children: ReactNode }) {
  const { session, profile, tenantAccessState } = useAuth();
  const scope = JSON.stringify([
    session?.user.id ?? null,
    profile?.id ?? null,
    profile?.clinic_id ?? null,
    profile?.role ?? null,
    profile?.ativo ?? null,
    tenantAccessState,
  ]);
  return <Fragment key={scope}>{children}</Fragment>;
}
