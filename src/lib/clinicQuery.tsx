import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Role } from './types';

export function createClinicQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function ClinicQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createClinicQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function agendaQueryKey(scope: {
  clinicId: string | null;
  userId: string | null;
  role: Role | null;
}) {
  return ['clinic', 'agenda', 'v1', scope.clinicId, scope.userId, scope.role] as const;
}

export function patientQueryKey(scope: {
  clinicId: string | null;
  userId: string | null;
  role: Role | null;
}) {
  return ['clinic', 'patients', 'v1', scope.clinicId, scope.userId, scope.role] as const;
}
