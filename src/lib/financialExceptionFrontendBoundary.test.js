import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const financeContext = readFileSync(fileURLToPath(new URL('./financeContext.tsx', import.meta.url)), 'utf8');
const command = readFileSync(fileURLToPath(new URL('./financialExceptionCommand.ts', import.meta.url)), 'utf8');
const repository = readFileSync(fileURLToPath(new URL('./financialExceptionResolution.ts', import.meta.url)), 'utf8');
const permissions = readFileSync(fileURLToPath(new URL('./permissions.ts', import.meta.url)), 'utf8');
const queue = readFileSync(fileURLToPath(new URL('../components/FinancialExceptionQueue.tsx', import.meta.url)), 'utf8');
const page = readFileSync(fileURLToPath(new URL('../pages/FinanceiroOperational.tsx', import.meta.url)), 'utf8');

const refreshStart = financeContext.indexOf('const refreshFinancialExceptions = useCallback');
const resolveStart = financeContext.indexOf('const resolveFinancialException = useCallback');
const refreshBlock = financeContext.slice(refreshStart, resolveStart);
const resolveBlock = financeContext.slice(resolveStart, financeContext.indexOf('const addTransaction', resolveStart));

describe('financial exception frontend boundary', () => {
  it('never derives queue authority from generic finance access', () => {
    expect(permissions).toContain("export const canListFinancialExceptions");
    expect(permissions).toContain("role === 'owner' || role === 'admin' || role === 'financeiro'");
    expect(financeContext).toContain('!canListFinancialExceptions(profileRole)');
    expect(financeContext.indexOf('!canListFinancialExceptions(profileRole)')).toBeLessThan(
      financeContext.indexOf('await loadPendingFinancialExceptions()'),
    );
    expect(queue).toContain('if (!canListFinancialExceptions(role)) return null;');
  });

  it('uses exact list/charge/waive operation predicates in the surface', () => {
    expect(queue).toContain('canChargeFinancialException(role)');
    expect(queue).toContain('canWaiveFinancialException(role)');
    expect(permissions).toContain("export const canWaiveFinancialException");
    expect(permissions).toContain("role === 'owner' || role === 'admin';");
  });

  it('keeps queue loading failure isolated from payments and commissions', () => {
    expect(refreshStart).toBeGreaterThan(-1);
    expect(resolveStart).toBeGreaterThan(refreshStart);
    expect(refreshBlock).toContain("setFinancialExceptionsError('Não foi possível carregar as pendências de cobertura.')");
    expect(refreshBlock).not.toContain('setTransactions(');
    expect(refreshBlock).not.toContain('setCommissions(');
  });

  it('removes a resolved item locally only after persisted RPC confirmation', () => {
    const commandStart = command.indexOf('const resolution = await dependencies.resolve');
    const persistedStart = command.indexOf('dependencies.onPersisted(resolution)');
    expect(commandStart).toBeGreaterThan(-1);
    expect(persistedStart).toBeGreaterThan(commandStart);
    expect(resolveBlock).toContain('setFinancialExceptions((current) => current.filter((item) => item.id !== persisted.exceptionId))');
  });

  it('treats post-COMMIT refreshes as independent projection work', () => {
    expect(command).toContain('Promise.allSettled');
    expect(command).toContain("financeProjection.status === 'fulfilled' ? 'fresh' : 'stale'");
    expect(command).toContain("queueProjection.status === 'fulfilled' ? 'fresh' : 'stale'");
    expect(command).toContain('projectionWarning');
    expect(resolveBlock).toContain('executeFinancialExceptionCommand');
  });

  it('gates persisted local projection and refresh callbacks by the same context epoch', () => {
    expect(resolveBlock).toContain('const commandGeneration = financialExceptionGeneration.current;');
    expect(resolveBlock).toContain('isProjectionCurrent: () => commandGeneration === financialExceptionGeneration.current');
    expect(command).toContain('if (!dependencies.isProjectionCurrent())');
    expect(command).toContain("queue: 'skipped_stale'");
    expect(command).toContain('projectionWarning: null');
  });

  it('requires a non-empty WAIVE reason before and at the RPC boundary', () => {
    expect(repository).toContain("disposition === 'waived' && !normalizedReason");
    expect(repository).toContain('Informe o motivo da cortesia.');
    expect(queue).toContain('Motivo da cortesia · obrigatório');
    expect(queue).toContain('disabled={!waiveReason.trim() || resolvingId === waiveTarget.id}');
  });

  it('never fabricates a local payment for WAIVE', () => {
    expect(repository).not.toContain("tipo: 'receber'");
    expect(queue).not.toContain('addTransaction');
    expect(resolveBlock).not.toContain('setTransactions(');
  });

  it('clears stale queue state across user, clinic, role or access transitions', () => {
    expect(financeContext).toContain('financialExceptionGeneration.current += 1;');
    expect(financeContext).toContain('setFinancialExceptions([]);');
    expect(financeContext).toContain('[clinicId, profileId, profileRole, tenantAccessState]');
  });

  it('handles manual refresh rejection and distinguishes projection warning from command failure', () => {
    expect(queue).toContain('void refreshFinancialExceptions().catch(() => undefined);');
    expect(queue).toContain('if (outcome.projectionWarning)');
    expect(queue).toContain("toast(outcome.projectionWarning, 'warn');");
    expect(queue).toContain('Não foi possível gerar a cobrança desta pendência.');
    expect(queue).toContain('Não foi possível registrar a cortesia. A pendência permanece aberta.');
  });

  it('keeps the queue owned by FinanceProvider and surfaced only by Financeiro', () => {
    expect(financeContext).toContain('financialExceptions: FinancialException[];');
    expect(financeContext).toContain('refreshFinancialExceptions: () => Promise<void>;');
    expect(financeContext).toContain('resolveFinancialException: (');
    expect(page).toContain('<FinancialExceptionQueue />');
    expect(queue).toContain('Pendências de cobertura · ${financialExceptions.length}');
    expect(queue).toContain('financialExceptionReasonLabel(item.reasonCode)');
    expect(queue).toContain('item.patientName');
    expect(queue).toContain('item.packageName');
    expect(queue).toContain('item.detectedAt');
  });
});
