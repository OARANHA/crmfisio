import type {
  FinancialExceptionDisposition,
  FinancialExceptionResolution,
} from './financialExceptionResolution';

export type FinancialExceptionProjectionState = 'fresh' | 'stale' | 'not_required';

export interface FinancialExceptionCommandResult {
  resolution: FinancialExceptionResolution;
  projection: {
    finance: FinancialExceptionProjectionState;
    queue: Exclude<FinancialExceptionProjectionState, 'not_required'>;
  };
  projectionWarning: string | null;
}

interface FinancialExceptionCommandDependencies {
  resolve: (
    exceptionId: string,
    disposition: FinancialExceptionDisposition,
    reason?: string | null,
  ) => Promise<FinancialExceptionResolution>;
  onPersisted: (resolution: FinancialExceptionResolution) => void;
  refreshFinance: () => Promise<void>;
  refreshQueue: () => Promise<void>;
}

const projectionWarning = (
  disposition: FinancialExceptionDisposition,
  finance: FinancialExceptionProjectionState,
  queue: 'fresh' | 'stale',
): string | null => {
  if (finance !== 'stale' && queue !== 'stale') return null;

  if (disposition === 'waived') {
    return 'Cortesia registrada, mas a fila de pendências não pôde ser atualizada. Atualize novamente para ver o estado mais recente.';
  }

  if (finance === 'stale' && queue === 'stale') {
    return 'Cobrança registrada, mas a lista de recebíveis e a fila de pendências não puderam ser atualizadas. Atualize novamente para ver o estado mais recente.';
  }

  if (finance === 'stale') {
    return 'Cobrança registrada, mas a lista de recebíveis não pôde ser atualizada. A cobrança já foi persistida; atualize novamente para ver o estado mais recente.';
  }

  return 'Cobrança registrada, mas a fila de pendências não pôde ser atualizada. Atualize novamente para ver o estado mais recente.';
};

export async function executeFinancialExceptionCommand(
  exceptionId: string,
  disposition: FinancialExceptionDisposition,
  reason: string | null | undefined,
  dependencies: FinancialExceptionCommandDependencies,
): Promise<FinancialExceptionCommandResult> {
  // COMMAND: only this awaited call decides whether the financial operation
  // persisted. Any rejection here is a real command failure.
  const resolution = await dependencies.resolve(exceptionId, disposition, reason);

  // This is intentionally after persisted confirmation, so removing the
  // resolved exception locally is not an optimistic update.
  dependencies.onPersisted(resolution);

  // PROJECTION: refresh failures after COMMIT must never turn the persisted
  // financial command into a rejected operation.
  if (disposition === 'charge') {
    const [financeProjection, queueProjection] = await Promise.allSettled([
      dependencies.refreshFinance(),
      dependencies.refreshQueue(),
    ]);
    const finance = financeProjection.status === 'fulfilled' ? 'fresh' : 'stale';
    const queue = queueProjection.status === 'fulfilled' ? 'fresh' : 'stale';
    return {
      resolution,
      projection: { finance, queue },
      projectionWarning: projectionWarning(disposition, finance, queue),
    };
  }

  const [queueProjection] = await Promise.allSettled([dependencies.refreshQueue()]);
  const queue = queueProjection.status === 'fulfilled' ? 'fresh' : 'stale';
  return {
    resolution,
    projection: { finance: 'not_required', queue },
    projectionWarning: projectionWarning(disposition, 'not_required', queue),
  };
}
