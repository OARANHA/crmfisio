import { describe, expect, it } from 'vitest';
import { calculatePhq9, isPhq9Complete, type Phq9Answers } from './phq9';

const answers = (...values: number[]): Phq9Answers => Object.fromEntries(
  values.map((value, index) => [`q${index + 1}`, value]),
) as Phq9Answers;

describe('Nexus PHQ-9', () => {
  it('rejects incomplete answers', () => {
    expect(isPhq9Complete({ q1: 0, q2: 1 })).toBe(false);
    expect(() => calculatePhq9({ q1: 0, q2: 1 })).toThrow(/incompleto/i);
  });

  it.each([
    [0, 'Sintomas depressivos mínimos ou ausentes', 'low'],
    [4, 'Sintomas depressivos mínimos ou ausentes', 'low'],
    [5, 'Depressão leve', 'low'],
    [9, 'Depressão leve', 'low'],
    [10, 'Depressão moderada', 'moderate'],
    [14, 'Depressão moderada', 'moderate'],
    [15, 'Depressão moderadamente grave', 'high'],
    [19, 'Depressão moderadamente grave', 'high'],
    [20, 'Depressão grave', 'severe'],
    [27, 'Depressão grave', 'severe'],
  ])('preserves Nexus cutoffs for score %i', (score, classification, severity) => {
    const values = Array(9).fill(0);
    let remaining = score;
    for (let index = 0; index < values.length && remaining > 0; index += 1) {
      const value = Math.min(3, remaining);
      values[index] = value;
      remaining -= value;
    }
    const result = calculatePhq9(answers(...values));
    expect(result.totalScore).toBe(score);
    expect(result.classification).toBe(classification);
    expect(result.severity).toBe(severity);
  });

  it('creates suicide-risk signal whenever item 9 is positive', () => {
    const result = calculatePhq9(answers(0, 0, 0, 0, 0, 0, 0, 0, 1));
    expect(result.totalScore).toBe(1);
    expect(result.hasSuicideRiskFlag).toBe(true);
    expect(result.recommendations[0]).toMatch(/C-SSRS/i);
  });

  it('does not create suicide-risk signal when item 9 is zero', () => {
    const result = calculatePhq9(answers(1, 1, 1, 1, 1, 1, 1, 1, 0));
    expect(result.hasSuicideRiskFlag).toBe(false);
  });

  it('keeps SOAP output deterministic', () => {
    const result = calculatePhq9(answers(1, 2, 0, 3, 1, 0, 2, 1, 0));
    expect(result.soapText).toBe('PHQ-9: 10/27 pts (Depressão moderada) | Respostas: [1, 2, 0, 3, 1, 0, 2, 1, 0] | Fonte: Kroenke et al., 2001 (Validação BR: Osório, 2009)');
  });
});
