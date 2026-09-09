import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  FinancialException,
  FinancialExceptionResolution,
} from './financialExceptionResolution';

const financialMocks = vi.hoisted(() => ({
  loadPendingFinancialExceptions: vi.fn(),
  resolveAppointmentFinancialException: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  profile: {
    id: 'owner-a',
    clinic_id: 'clinic-a',
    role: 'owner',
  } as null | { id: string; clinic_id: string; role: string },
  tenantAccessState: 'active',
}));

const supabaseMocks = vi.hoisted(() => ({
  paymentsOrder: vi.fn(),
  commissionsOrder: vi.fn(),
  paymentsEq: vi.fn(),
  commissionsEq: vi.fn(),
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
    profile: authMocks.profile,
    tenantAccessState: authMocks.tenantAccessState,
  }),
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, value: string) => {
          if (table === 'payments') supabaseMocks.paymentsEq(value);
          else supabaseMocks.commissionsEq(value);
          return {
            order: table === 'payments' ? supabaseMocks.paymentsOrder : supabaseMocks.commissionsOrder,
          };
        }),
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

const pendingExceptionB: FinancialException = {
  ...pendingException,
  id: 'exception-b',
  appointmentId: 'appointment-b',
  patientId: 'patient-b',
  patientName: 'Paciente B',
};

const chargeResolution: FinancialExceptionResolution = {
  exceptionId: pendingException.id,
  appointmentId: pendingException.appointmentId,
  disposition: 'charge',
  amount: pendingException.amount,
  paymentId: 'payment-a',
  resolvedAt: '2026-09-09T09:15:00Z',
};

let latestFinance: ReturnType<typeof useFinance> | null = null;

function Probe() {
  latestFinance = useFinance();
  return null;
}

const flushEffects = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('FinanceProvider financial exception refresh behavior', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    latestFinance = null;
    authMocks.profile = { id: 'owner-a', clinic_id: 'clinic-a', role: 'owner' };
    authMocks.tenantAccessState = 'active';
    financialMocks.loadPendingFinancialExceptions.mockReset();
    financialMocks.resolveAppointmentFinancialException.mockReset();
    supabaseMocks.paymentsOrder.mockReset();
    supabaseMocks.commissionsOrder.mockReset();
    supabaseMocks.paymentsEq.mockReset();
    supabaseMocks.commissionsEq.mockReset();
    supabaseMocks.paymentsOrder.mockResolvedValue({ data: [], error: null });
    supabaseMocks.commissionsOrder.mockResolvedValue({ data: [], error: null });
    financialMocks.loadPendingFinancialExceptions.mockResolvedValue([pendingException]);
  });

  const mountProvider = async () => {
    await act(async () => {
      renderer = create(
        <FinanceProvider>
          <Probe />
        </FinanceProvider>,
      );
      await flushEffects();
    });
  };

  const rerenderProvider = async () => {
    await act(async () => {
      renderer?.update(
        <FinanceProvider>
          <Probe />
        </FinanceProvider>,
      );
      await flushEffects();
    });
  };

  const beginPendingCharge = async () => {
    let confirmPersisted!: (resolution: FinancialExceptionResolution) => void;
    financialMocks.resolveAppointmentFinancialException.mockImplementationOnce(
      () => new Promise<FinancialExceptionResolution>((resolve) => {
        confirmPersisted = resolve;
      }),
    );

    let command!: ReturnType<NonNullable<typeof latestFinance>['resolveFinancialException']>;
    await act(async () => {
      command = latestFinance!.resolveFinancialException(pendingException.id, 'charge');
      await Promise.resolve();
    });
    return { command, confirmPersisted };
  };

  it('updates the queue error state when a manual refresh fails and allows the caller to handle the rejection', async () => {
    await mountProvider();

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

  it('keeps a clinic A CHARGE persisted but discards every old projection after switching to clinic B', async () => {
    financialMocks.loadPendingFinancialExceptions
      .mockResolvedValueOnce([pendingException])
      .mockResolvedValue([pendingExceptionB]);
    await mountProvider();
    const { command, confirmPersisted } = await beginPendingCharge();

    authMocks.profile = { id: 'owner-b', clinic_id: 'clinic-b', role: 'owner' };
    await rerenderProvider();

    expect(latestFinance?.financialExceptions).toEqual([pendingExceptionB]);
    const financeCallsBeforeConfirmation = supabaseMocks.paymentsOrder.mock.calls.length;
    const queueCallsBeforeConfirmation = financialMocks.loadPendingFinancialExceptions.mock.calls.length;

    let result!: Awaited<typeof command>;
    await act(async () => {
      confirmPersisted(chargeResolution);
      result = await command;
      await flushEffects();
    });

    expect(result.resolution).toEqual(chargeResolution);
    expect(result.projection).toEqual({ finance: 'skipped_stale', queue: 'skipped_stale' });
    expect(result.projectionWarning).toBeNull();
    expect(latestFinance?.financialExceptions).toEqual([pendingExceptionB]);
    expect(supabaseMocks.paymentsOrder).toHaveBeenCalledTimes(financeCallsBeforeConfirmation);
    expect(financialMocks.loadPendingFinancialExceptions).toHaveBeenCalledTimes(queueCallsBeforeConfirmation);
    expect(supabaseMocks.paymentsEq.mock.calls.at(-1)?.[0]).toBe('clinic-b');

    renderer?.unmount();
  });

  it('discards the old projection after changing user and role while the command is pending', async () => {
    financialMocks.loadPendingFinancialExceptions
      .mockResolvedValueOnce([pendingException])
      .mockResolvedValue([pendingExceptionB]);
    await mountProvider();
    const { command, confirmPersisted } = await beginPendingCharge();

    authMocks.profile = { id: 'finance-b', clinic_id: 'clinic-a', role: 'financeiro' };
    await rerenderProvider();

    const financeCallsBeforeConfirmation = supabaseMocks.paymentsOrder.mock.calls.length;
    const queueCallsBeforeConfirmation = financialMocks.loadPendingFinancialExceptions.mock.calls.length;

    let result!: Awaited<typeof command>;
    await act(async () => {
      confirmPersisted(chargeResolution);
      result = await command;
      await flushEffects();
    });

    expect(result.projectionWarning).toBeNull();
    expect(result.projection.queue).toBe('skipped_stale');
    expect(latestFinance?.financialExceptions).toEqual([pendingExceptionB]);
    expect(supabaseMocks.paymentsOrder).toHaveBeenCalledTimes(financeCallsBeforeConfirmation);
    expect(financialMocks.loadPendingFinancialExceptions).toHaveBeenCalledTimes(queueCallsBeforeConfirmation);

    renderer?.unmount();
  });

  it('keeps the persisted command successful and skips old projections after logout', async () => {
    await mountProvider();
    const { command, confirmPersisted } = await beginPendingCharge();

    authMocks.profile = null;
    authMocks.tenantAccessState = 'unauthenticated';
    await rerenderProvider();

    const financeCallsBeforeConfirmation = supabaseMocks.paymentsOrder.mock.calls.length;
    const queueCallsBeforeConfirmation = financialMocks.loadPendingFinancialExceptions.mock.calls.length;

    let result!: Awaited<typeof command>;
    await act(async () => {
      confirmPersisted(chargeResolution);
      result = await command;
      await flushEffects();
    });

    expect(result.resolution).toEqual(chargeResolution);
    expect(result.projectionWarning).toBeNull();
    expect(result.projection).toEqual({ finance: 'skipped_stale', queue: 'skipped_stale' });
    expect(latestFinance?.financialExceptions).toEqual([]);
    expect(supabaseMocks.paymentsOrder).toHaveBeenCalledTimes(financeCallsBeforeConfirmation);
    expect(financialMocks.loadPendingFinancialExceptions).toHaveBeenCalledTimes(queueCallsBeforeConfirmation);

    renderer?.unmount();
  });

  it('keeps the persisted command successful and skips old projections when tenant access is lost', async () => {
    await mountProvider();
    const { command, confirmPersisted } = await beginPendingCharge();

    authMocks.tenantAccessState = 'suspended';
    await rerenderProvider();

    const financeCallsBeforeConfirmation = supabaseMocks.paymentsOrder.mock.calls.length;
    const queueCallsBeforeConfirmation = financialMocks.loadPendingFinancialExceptions.mock.calls.length;

    let result!: Awaited<typeof command>;
    await act(async () => {
      confirmPersisted(chargeResolution);
      result = await command;
      await flushEffects();
    });

    expect(result.resolution).toEqual(chargeResolution);
    expect(result.projectionWarning).toBeNull();
    expect(result.projection).toEqual({ finance: 'skipped_stale', queue: 'skipped_stale' });
    expect(latestFinance?.financialExceptions).toEqual([]);
    expect(supabaseMocks.paymentsOrder).toHaveBeenCalledTimes(financeCallsBeforeConfirmation);
    expect(financialMocks.loadPendingFinancialExceptions).toHaveBeenCalledTimes(queueCallsBeforeConfirmation);

    renderer?.unmount();
  });
});
