import { describe, expect, it } from 'vitest';
import { calculateScale } from './scaleRuntime';
import { HCL32_DEFINITION } from './hcl32';

const answersWith = (positiveIds: string[]) => Object.fromEntries(
  HCL32_DEFINITION.questions.map((question) => [question.id, positiveIds.includes(question.id) ? 1 : 0]),
);

describe('HCL-32 Nexus', () => {
  it('classifica 0-13 como rastreio negativo', () => {
    const result = calculateScale(HCL32_DEFINITION, answersWith(HCL32_DEFINITION.questions.slice(0, 13).map((q) => q.id)));
    expect(result.totalScore).toBe(13);
    expect(result.severity).toBe('low');
  });

  it('classifica 14-17 como faixa moderada internacional', () => {
    const result = calculateScale(HCL32_DEFINITION, answersWith(HCL32_DEFINITION.questions.slice(0, 14).map((q) => q.id)));
    expect(result.totalScore).toBe(14);
    expect(result.severity).toBe('moderate');
  });

  it('usa o corte brasileiro a partir de 18', () => {
    const result = calculateScale(HCL32_DEFINITION, answersWith(HCL32_DEFINITION.questions.slice(0, 18).map((q) => q.id)));
    expect(result.totalScore).toBe(18);
    expect(result.severity).toBe('high');
    expect(result.classification).toContain('Corte Brasileiro');
  });

  it('preserva os dois subdomínios no resultado estruturado', () => {
    const result = calculateScale(HCL32_DEFINITION, answersWith(['q1', 'q2', 'q7', 'q8']));
    expect(result.structuredData).toEqual({ activationScore: 2, riskScore: 2 });
  });

  it('rejeita instrumento incompleto', () => {
    expect(() => calculateScale(HCL32_DEFINITION, { q1: 1 })).toThrow(/incompleto/i);
  });
});
