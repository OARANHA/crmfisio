import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialException } from './financialExceptionResolution';

const financialMocks = vi.hoisted(() => ({
  loadPendingFinancialExceptions: vi.fn(),
  resolveAppointmentFinancialException: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  paymentsOrder: vi.fn(),
  commissionsOrder: vi.fn(),
}));

vi.mock('./financialExceptionResolution', async () => {
  const actual = await vi.importActual<typeof import('./financialExceptionResolution')>('./financialExceptionResolution');
  return {
    ...actual,
    loadPendingFinancialExceptions: financialMocks.loadPendingFinancialExceptions,
    resolveAppointmentFinancialException: financialMocks.resolveAppointmentFinancialException,
  };
});

vi.mock('./repository', () => ({
  closeMonthlyCommissions: vi.fn(),
  insertPayment: vi.fn(),
  markCommissionPaid: vi.fn(),
  mapPayment: vi.fn((row: unknown) => row),
  updatePayment: vi.fn(),
}));

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    profile: {
      id: 'owner-a',
      clinic_id: 'clinic-a',
      role: 'owner',
    },
    tenantAccessState: 'active',
  }),
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: table === 'payments' ? supabaseMocks.paymentsOrder : supabaseMocks.commissionsOrder,
        })),
      })),
    })),
  },
}));

import { FinanceProvider, useFinance } from './financeContext';

const pendingException: FinancialException = {
  id: 'exception-a',
  appointmentId: 'appointment-a',
  patientId: 'patient-a',
  patientName: 'Paciente A',
  appointmentDate: '2026-09-09',
  appointmentStart: '10:00:00',
  reasonCode: 'package_exhausted',
  amount: 10000,
  sourcePackageId: null,
  packageName: null,
  detectedAt: '2026-09-09T09:00:00Z',
};

let latestFinance: ReturnType<typeof useFinance> | null = null;

function Probe() {
  latestFinance = useFinance();
  return null;
}

describe('FinanceProvider financial exception refresh behavior', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    latestFinance = null;
    financialMocks.loadPendingFinancialExceptions.mockReset();
    financialMocks.resolveAppointmentFinancialException.mockReset();
    supabaseMocks.paymentsOrder.mockReset();
    supabaseMocks.commissionsOrder.mockReset();
    supabaseMocks.paymentsOrder.mockResolvedValue({ data: [], error: null });
    supabaseMocks.commissionsOrder.mockResolvedValue({ data: [], error: null });
    financialMocks.loadPendingFinancialExceptions.mockResolvedValue([pendingException]);
  });

  it('updates the queue error state when a manual refresh fails and allows the caller to handle the rejection', async () => {
    await act(async () => {
      renderer = create(
        <FinanceProvider>
          <Probe />
        </FinanceProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestFinance?.financialExceptions).toEqual([pendingException]);
    expect(latestFinance?.financialExceptionsError).toBeNull();

    financialMocks.loadPendingFinancialExceptions.mockRejectedValueOnce(new Error('queue unavailable'));

    await act(async () => {
      await latestFinance?.refreshFinancialExceptions().catch(() => undefined);
    });

    expect(latestFinance?.financialExceptions).toEqual([pendingException]);
    expect(latestFinance?.financialExceptionsError).toBe('Não foi possível carregar as pendências de cobertura.');
    expect(latestFinance?.financialExceptionsLoading).toBe(false);

    renderer?.unmount();
  });
});
