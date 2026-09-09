import { describe, expect, it, vi } from 'vitest';
import { executeFinancialExceptionCommand } from './financialExceptionCommand';
import type { FinancialExceptionResolution } from './financialExceptionResolution';

const chargeResolution: FinancialExceptionResolution = {
  exceptionId: 'exception-charge',
  appointmentId: 'appointment-charge',
  disposition: 'charge',
  amount: 15000,
  paymentId: 'payment-charge',
  resolvedAt: '2026-09-09T09:00:00Z',
};

const waiveResolution: FinancialExceptionResolution = {
  exceptionId: 'exception-waive',
  appointmentId: 'appointment-waive',
  disposition: 'waived',
  amount: 12000,
  paymentId: null,
  resolvedAt: '2026-09-09T09:01:00Z',
};

const currentProjection = () => true;

describe('financial exception command/projection boundary', () => {
  it('keeps CHARGE successful when finance refresh fails after persisted RPC confirmation', async () => {
    const onPersisted = vi.fn();
    const result = await executeFinancialExceptionCommand('exception-charge', 'charge', null, {
      resolve: vi.fn().mockResolvedValue(chargeResolution),
      isProjectionCurrent: currentProjection,
      onPersisted,
      refreshFinance: vi.fn().mockRejectedValue(new Error('payments projection unavailable')),
      refreshQueue: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.resolution).toEqual(chargeResolution);
    expect(result.projection).toEqual({ finance: 'stale', queue: 'fresh' });
    expect(result.projectionWarning).toContain('Cobrança registrada');
    expect(result.projectionWarning).not.toContain('Não foi possível gerar');
    expect(onPersisted).toHaveBeenCalledWith(chargeResolution);
  });

  it('keeps CHARGE successful when queue refresh fails after persisted RPC confirmation', async () => {
    const result = await executeFinancialExceptionCommand('exception-charge', 'charge', null, {
      resolve: vi.fn().mockResolvedValue(chargeResolution),
      isProjectionCurrent: currentProjection,
      onPersisted: vi.fn(),
      refreshFinance: vi.fn().mockResolvedValue(undefined),
      refreshQueue: vi.fn().mockRejectedValue(new Error('queue projection unavailable')),
    });

    expect(result.resolution).toEqual(chargeResolution);
    expect(result.projection).toEqual({ finance: 'fresh', queue: 'stale' });
    expect(result.projectionWarning).toContain('Cobrança registrada');
  });

  it('keeps WAIVE successful when queue refresh fails and never says the pending item remains open', async () => {
    const result = await executeFinancialExceptionCommand('exception-waive', 'waived', 'Cortesia administrativa', {
      resolve: vi.fn().mockResolvedValue(waiveResolution),
      isProjectionCurrent: currentProjection,
      onPersisted: vi.fn(),
      refreshFinance: vi.fn(),
      refreshQueue: vi.fn().mockRejectedValue(new Error('queue projection unavailable')),
    });

    expect(result.resolution).toEqual(waiveResolution);
    expect(result.projection).toEqual({ finance: 'not_required', queue: 'stale' });
    expect(result.projectionWarning).toContain('Cortesia registrada');
    expect(result.projectionWarning).not.toContain('permanece aberta');
  });

  it('keeps RPC failure as a real command failure and does not start projection refreshes', async () => {
    const commandError = new Error('rpc failed');
    const onPersisted = vi.fn();
    const refreshFinance = vi.fn();
    const refreshQueue = vi.fn();

    await expect(executeFinancialExceptionCommand('exception-charge', 'charge', null, {
      resolve: vi.fn().mockRejectedValue(commandError),
      isProjectionCurrent: currentProjection,
      onPersisted,
      refreshFinance,
      refreshQueue,
    })).rejects.toBe(commandError);

    expect(onPersisted).not.toHaveBeenCalled();
    expect(refreshFinance).not.toHaveBeenCalled();
    expect(refreshQueue).not.toHaveBeenCalled();
  });

  it('does not remove or project an item before the RPC confirms persistence', async () => {
    let confirmPersisted!: (resolution: FinancialExceptionResolution) => void;
    const command = vi.fn(() => new Promise<FinancialExceptionResolution>((resolve) => {
      confirmPersisted = resolve;
    }));
    const onPersisted = vi.fn();
    const refreshFinance = vi.fn().mockResolvedValue(undefined);
    const refreshQueue = vi.fn().mockResolvedValue(undefined);

    const pending = executeFinancialExceptionCommand('exception-charge', 'charge', null, {
      resolve: command,
      isProjectionCurrent: currentProjection,
      onPersisted,
      refreshFinance,
      refreshQueue,
    });

    expect(command).toHaveBeenCalledOnce();
    expect(onPersisted).not.toHaveBeenCalled();
    expect(refreshFinance).not.toHaveBeenCalled();
    expect(refreshQueue).not.toHaveBeenCalled();

    confirmPersisted(chargeResolution);
    await expect(pending).resolves.toMatchObject({ resolution: chargeResolution });

    expect(onPersisted).toHaveBeenCalledWith(chargeResolution);
    expect(refreshFinance).toHaveBeenCalledOnce();
    expect(refreshQueue).toHaveBeenCalledOnce();
  });

  it('returns persisted success without projection or warning when the context epoch changed while the RPC was in flight', async () => {
    let confirmPersisted!: (resolution: FinancialExceptionResolution) => void;
    let current = true;
    const onPersisted = vi.fn();
    const refreshFinance = vi.fn().mockResolvedValue(undefined);
    const refreshQueue = vi.fn().mockResolvedValue(undefined);

    const pending = executeFinancialExceptionCommand('exception-charge', 'charge', null, {
      resolve: vi.fn(() => new Promise<FinancialExceptionResolution>((resolve) => {
        confirmPersisted = resolve;
      })),
      isProjectionCurrent: () => current,
      onPersisted,
      refreshFinance,
      refreshQueue,
    });

    current = false;
    confirmPersisted(chargeResolution);

    await expect(pending).resolves.toEqual({
      resolution: chargeResolution,
      projection: { finance: 'skipped_stale', queue: 'skipped_stale' },
      projectionWarning: null,
    });
    expect(onPersisted).not.toHaveBeenCalled();
    expect(refreshFinance).not.toHaveBeenCalled();
    expect(refreshQueue).not.toHaveBeenCalled();
  });
});
