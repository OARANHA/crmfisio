import { describe, expect, it } from 'vitest';
import { calculateMeem, MEEM_QUESTIONS, type MeemAnswerMap } from './meem';

const answersForTotal = (target: number): MeemAnswerMap => {
  const answers: MeemAnswerMap = {};
  let remaining = target;
  for (const question of MEEM_QUESTIONS) {
    const value = Math.min(question.max, remaining);
    answers[question.id] = value;
    remaining -= value;
  }
  return answers;
};

describe('Nexus MEEM', () => {
  it('preserva score máximo 30', () => {
    const result = calculateMeem(answersForTotal(30), 'years_12_plus');
    expect(result.totalScore).toBe(30);
    expect(result.contextualStatus).toBe('preserved');
  });

  it('mantém classificação histórica do Nexus e corte contextual separado', () => {
    const result = calculateMeem(answersForTotal(27), 'years_9_11');
    expect(result.classification).toContain('Preservado na Maioria');
    expect(result.contextualCutoff).toBe(28);
    expect(result.contextualStatus).toBe('below_cutoff');
  });

  it('aplica os cortes Brucki por escolaridade sem recalcular score', () => {
    const score24 = answersForTotal(24);
    expect(calculateMeem(score24, 'illiterate').contextualStatus).toBe('preserved');
    expect(calculateMeem(score24, 'years_1_4').contextualStatus).toBe('below_cutoff');
  });

  it('rejeita aplicação incompleta', () => {
    expect(() => calculateMeem({}, 'illiterate')).toThrow(/incompleto/i);
  });
});
