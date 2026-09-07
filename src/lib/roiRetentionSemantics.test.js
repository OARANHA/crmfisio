import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('../components/MonthlyRoiRetention.tsx', import.meta.url)), 'utf8');

describe('recovery and continuity report semantics', () => {
  it('does not present pipeline plus realized as one revenue total', () => {
    expect(source).not.toContain('totalAttributed');
    expect(source).not.toContain('Impacto atribuído total');
    expect(source).toContain('Realizado e pipeline não são somados como receita');
  });

  it('does not call a current risk snapshot historical retention or ROI', () => {
    expect(source).not.toContain('Retenção protegida');
    expect(source).not.toContain('ROI e retenção MedicsPro');
    expect(source).toContain('Recuperação de receita e continuidade');
    expect(source).toContain('não é uma taxa histórica de retenção');
  });

  it('scopes churn counters to the active treatment base', () => {
    expect(source).toContain('const treatmentIds = new Set');
    expect(source).toContain('const treatmentRisks = risks.filter');
    expect(source).toContain('risk.patientId');
    expect(source).toContain('calculateLowRiskShare(treatment.length, high.length, medium.length)');
  });

  it('does not claim automation causality when the event only proves observed recovery', () => {
    expect(source).toContain('eventos registram recuperação observada pelo sistema');
    expect(source).toContain('não atribui o resultado exclusivamente à automação');
    expect(source).not.toContain('resultado financeiro atribuído às ações de recuperação');
  });
});
