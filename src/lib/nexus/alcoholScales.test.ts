import { describe, expect, it } from 'vitest';
import { calculateScale } from './scaleRuntime';
import { AUDIT_DEFINITION, AUDITC_DEFINITION, CAGE_DEFINITION } from './alcoholScales';

const answersFor = (definition: typeof AUDIT_DEFINITION, values: Record<string, number>) => Object.fromEntries(
  definition.questions.map((question) => [question.id, values[question.id] ?? question.options[0].value]),
);

describe('AUDIT Nexus Runtime', () => {
  it.each([
    [7, 'low'],
    [8, 'moderate'],
    [15, 'moderate'],
    [16, 'high'],
    [19, 'high'],
    [20, 'severe'],
  ])('preserva os cortes do AUDIT em %s', (score, severity) => {
    const values: Record<string, number> = {};
    let remaining = score;
    for (const question of AUDIT_DEFINITION.questions) {
      const allowed = question.options.map((o) => o.value).sort((a, b) => b - a);
      const selected = allowed.find((value) => value <= remaining) ?? 0;
      values[question.id] = selected;
      remaining -= selected;
    }
    const result = calculateScale(AUDIT_DEFINITION, answersFor(AUDIT_DEFINITION, values));
    expect(result.totalScore).toBe(score);
    expect(result.severity).toBe(severity);
  });

  it('preserva os três domínios estruturados', () => {
    const result = calculateScale(AUDIT_DEFINITION, answersFor(AUDIT_DEFINITION, { q1: 1, q4: 2, q7: 3 }));
    expect(result.structuredData).toEqual({ consumoScore: 1, dependenciaScore: 2, problemasScore: 3 });
  });
});

describe('AUDIT-C Nexus Runtime', () => {
  it('preserva o comportamento atual >=4 universal', () => {
    const three = calculateScale(AUDITC_DEFINITION, { q1: 1, q2: 1, q3: 1 });
    const four = calculateScale(AUDITC_DEFINITION, { q1: 2, q2: 1, q3: 1 });
    expect(three.severity).toBe('low');
    expect(four.severity).toBe('moderate');
    expect(four.structuredData).toEqual({ clinicalReviewRequired: 'audit-c-sex-specific-cutoff-divergence' });
  });
});

describe('CAGE Nexus Runtime', () => {
  it('usa corte >=2', () => {
    expect(calculateScale(CAGE_DEFINITION, { q1: 1, q2: 0, q3: 0, q4: 0 }).severity).toBe('low');
    expect(calculateScale(CAGE_DEFINITION, { q1: 1, q2: 1, q3: 0, q4: 0 }).severity).toBe('high');
  });
});
