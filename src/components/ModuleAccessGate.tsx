import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import type { ModuleKey } from '../lib/types';

type ModuleAccessGateProps = {
  module: ModuleKey;
  children: ReactNode;
};

export function ModuleAccessGate({ module, children }: ModuleAccessGateProps) {
  const { user, canView } = useApp();

  if (!user) return <Navigate to="/" replace />;

  const receptionDashboard = module === 'dashboard' && user.role === 'recep';
  if (!canView(module) && !receptionDashboard) return <Navigate to="/" replace />;

  return <>{children}</>;
}
