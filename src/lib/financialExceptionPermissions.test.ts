import { describe, expect, it } from 'vitest';
import {
  accessFor,
  canChargeFinancialException,
  canListFinancialExceptions,
  canWaiveFinancialException,
} from './permissions';

describe('financial exception operation matrix', () => {
  it('does not derive queue access from generic finance module access', () => {
    expect(accessFor('professional', 'financeiro')).toBe('read');
    expect(accessFor('recep', 'financeiro')).toBe('full');

    expect(canListFinancialExceptions('professional')).toBe(false);
    expect(canListFinancialExceptions('recep')).toBe(false);
    expect(canChargeFinancialException('professional')).toBe(false);
    expect(canChargeFinancialException('recep')).toBe(false);
    expect(canWaiveFinancialException('professional')).toBe(false);
    expect(canWaiveFinancialException('recep')).toBe(false);
  });

  it.each(['owner', 'admin'] as const)('%s can list, charge and waive', (role) => {
    expect(canListFinancialExceptions(role)).toBe(true);
    expect(canChargeFinancialException(role)).toBe(true);
    expect(canWaiveFinancialException(role)).toBe(true);
  });

  it('financeiro can list and charge but cannot waive', () => {
    expect(canListFinancialExceptions('financeiro')).toBe(true);
    expect(canChargeFinancialException('financeiro')).toBe(true);
    expect(canWaiveFinancialException('financeiro')).toBe(false);
  });
});
